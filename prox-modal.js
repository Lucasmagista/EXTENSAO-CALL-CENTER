// Content script da modal "Enviar PROX" (injetado pelo background junto com
// PROX MODAL.html). Cuida só da interface: cada ação vira uma mensagem para o
// background, que conversa com a Evolution API (whatsapp.hubly.software).
// Layout de duas colunas: QR/status à esquerda e lista de grupos à direita
// (só aparece depois de conectar). Sem flags globais persistentes: cada
// injeção recria a modal e o polling antigo se desliga sozinho.
// Todas as funções assíncronas conferem modalViva() depois do await: a modal
// pode ser fechada enquanto a rede responde (fetch de grupos leva até 30s) e
// getElementById devolveria null (bug do "px-busca-grupo.value").
(function () {
  "use strict";

  // Polling de QR: um por vez na página inteira (modal reaberta mata o anterior)
  if (window.__ccProxQRInterval) {
    clearInterval(window.__ccProxQRInterval);
    window.__ccProxQRInterval = null;
  }

  var cfg = { temChave: false, temPadrao: false, temManual: false, apikey: "", instancia: "", grupoId: null, grupoNome: null, texto: "prox" };
  var tentandoQR = false;
  var conectado = false;
  var carregandoGrupos = false;
  var listaAberta = true; // false = grupo fixo no card, lista recolhida
  var statusTimer = null;

  // O conteúdo da modal mora dentro de um Shadow DOM (corpo isolado do site):
  // procura primeiro no documento (cabeçalho/host) e depois dentro da sombra.
  function $(id) {
    var direto = document.getElementById(id);
    if (direto) return direto;
    var corpo = document.getElementById("cc-prox-corpo");
    return (corpo && corpo.shadowRoot) ? corpo.shadowRoot.getElementById(id) : null;
  }
  function raizConteudo() {
    var corpo = document.getElementById("cc-prox-corpo");
    return (corpo && corpo.shadowRoot) ? corpo.shadowRoot : document;
  }
  function modalViva() { return !!document.getElementById("cc-prox-modal"); }
  function setText(id, txt) { var el = $(id); if (el) el.textContent = txt; }

  function enviar(msg) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(msg, function (resp) {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(resp || { ok: false, error: "Sem resposta do fundo da extensão." });
        });
      } catch (e) {
        resolve({ ok: false, error: e.message });
      }
    });
  }

  function mostrarEtapa(id) {
    var etapas = raizConteudo().querySelectorAll(".px-etapa");
    for (var i = 0; i < etapas.length; i++) etapas[i].classList.remove("ativa");
    var alvo = $(id);
    if (alvo) alvo.classList.add("ativa");
  }

  function mostrarStatus(texto, ms) {
    var el = $("px-status");
    if (!el) return;
    el.textContent = texto || "";
    if (statusTimer) clearTimeout(statusTimer);
    if (texto) statusTimer = setTimeout(function () { el.textContent = ""; }, ms || 4000);
  }

  function mostrarErro(id, texto) {
    var el = $(id);
    if (!el) return;
    el.textContent = texto || "";
    el.classList.toggle("visivel", !!texto);
  }

  function pararQR() {
    if (window.__ccProxQRInterval) {
      clearInterval(window.__ccProxQRInterval);
      window.__ccProxQRInterval = null;
    }
    tentandoQR = false;
  }

  // Resposta "sem chave / chave recusada" → volta para o passo da API key
  function tratarChave(resp) {
    if (resp && resp.chaveInvalida) {
      pararQR();
      conectado = false;
      cfg.temChave = false;
      mostrarErro("px-erro-chave", resp.error || "API Key recusada pelo servidor.");
      mostrarEtapa("px-etapa-chave");
      var btnPadrao = $("px-btn-padrao");
      if (btnPadrao) btnPadrao.classList.toggle("oculto", !cfg.temPadrao);
      return true;
    }
    return false;
  }

  // =====================================================
  // Passo da API key (só quando o pacote não traz chave)
  // =====================================================
  function abrirChave(comErro) {
    if (!modalViva()) return;
    pararQR();
    mostrarErro("px-erro-chave", comErro || "");
    var campo = $("px-campo-chave");
    campo.value = cfg.temManual ? cfg.apikey : "";
    $("px-btn-cancelar-chave").classList.toggle("oculto", !cfg.temChave);
    $("px-btn-padrao").classList.toggle("oculto", !cfg.temPadrao);
    mostrarEtapa("px-etapa-chave");
    campo.focus();
  }

  async function salvarChave() {
    var campo = $("px-campo-chave");
    if (!campo) return;
    var chave = (campo.value || "").trim();
    if (!chave) {
      mostrarErro("px-erro-chave", "Cole a API Key do servidor.");
      return;
    }
    var btn = $("px-btn-salvar-chave");
    btn.disabled = true;
    setText("px-lbl-salvar-chave", "Verificando…");
    mostrarErro("px-erro-chave", "");
    var resp = await enviar({ type: "proxSalvarConfig", apikey: chave });
    btn.disabled = false;
    setText("px-lbl-salvar-chave", "Salvar e conectar");
    if (!modalViva()) return;
    if (!resp.ok) {
      mostrarErro("px-erro-chave", resp.error || "Falha ao salvar.");
      return;
    }
    cfg.temChave = true;
    cfg.temManual = true;
    cfg.apikey = chave;
    mostrarStatus("API Key salva.");
    await iniciarLive();
  }

  async function usarPadrao() {
    var btn = $("px-btn-padrao");
    btn.disabled = true;
    setText("px-lbl-padrao", "Aplicando…");
    var resp = await enviar({ type: "proxSalvarConfig", limparChave: true });
    btn.disabled = false;
    setText("px-lbl-padrao", "Usar a chave do pacote");
    if (!modalViva()) return;
    if (!resp.ok) {
      mostrarErro("px-erro-chave", resp.error || "Falha ao voltar para a chave do pacote.");
      return;
    }
    await recarregarConfig();
    if (!cfg.temChave) {
      mostrarErro("px-erro-chave", "Este pacote não trouxe chave embutida — cole a API Key.");
      return;
    }
    mostrarStatus("Usando a chave do pacote.");
    await iniciarLive();
  }

  async function recarregarConfig() {
    var resp = await enviar({ type: "proxLerConfig" });
    if (resp && resp.ok) {
      cfg = {
        temChave: !!resp.temChave,
        temPadrao: !!resp.temPadrao,
        temManual: !!resp.temManual,
        apikey: resp.apikey || "",
        instancia: resp.instancia || "",
        grupoId: resp.grupoId || null,
        grupoNome: resp.grupoNome || null,
        texto: resp.texto || "prox"
      };
    }
  }

  // =====================================================
  // Tela principal (duas colunas)
  // =====================================================
  function pintarConexao() {
    if (!modalViva()) return;
    var badge = $("px-badge");
    badge.classList.toggle("px-ok", conectado);
    var icoEspera = $("px-badge-espera");
    var icoOk = $("px-badge-ok");
    if (icoEspera) icoEspera.classList.toggle("oculto", conectado);
    if (icoOk) icoOk.classList.toggle("oculto", !conectado);
    setText("px-badge-txt", conectado ? "Conectado" : "Aguardando conexão");

    $("px-painel-qr").classList.toggle("oculto", conectado);
    $("px-painel-conectado").classList.toggle("oculto", !conectado);

    $("px-placeholder").classList.toggle("oculto", conectado);
    $("px-painel-grupos").classList.toggle("oculto", !conectado);

    if (cfg.grupoId) listaAberta = false; // grupo fixo: lista recolhida, com "Trocar grupo"
    else listaAberta = true;
    $("px-nome-grupo").textContent = cfg.grupoNome || "nenhum grupo escolhido";
    pintarEstadoLista();
    $("px-campo-texto").value = cfg.texto || "prox";
    $("px-instancia").textContent = cfg.instancia || "—";
  }

  // Estado da coluna de grupos: grupo escolhido fica fixo no card (com check)
  // e a lista fica recolhida — "Trocar grupo" reabre a lista quando quiser.
  function pintarEstadoLista() {
    if (!modalViva()) return;
    var temGrupo = !!cfg.grupoId;
    var mostrarBusca = listaAberta && conectado && !carregandoGrupos;
    $("px-busca-grupo").classList.toggle("oculto", !mostrarBusca);
    var lista = $("px-lista-grupos");
    if (lista) lista.classList.toggle("oculto", !mostrarBusca);
    var check = $("px-check-grupo");
    if (check) check.classList.toggle("oculto", !temGrupo);
    var card = $("px-grupo-atual");
    if (card) card.classList.toggle("px-tem-grupo", temGrupo);
    var trocar = $("px-btn-trocar");
    if (trocar) trocar.classList.toggle("oculto", !(temGrupo && !listaAberta));
  }

  async function iniciarLive() {
    if (!modalViva()) return;
    mostrarEtapa("px-etapa-live");
    mostrarErro("px-erro-qr", "");
    mostrarErro("px-erro-conexao", "");
    pintarConexao();
    if (conectado) {
      pararQR();
      await carregarGrupos();
    } else {
      iniciarQR();
    }
  }

  // =====================================================
  // Coluna esquerda — QR (poll de 4s enquanto desconectado)
  // =====================================================
  function iniciarQR(mensagem) {
    if (!modalViva()) return;
    mostrarErro("px-erro-qr", "");
    setText("px-qr-msg", mensagem || "Aguardando leitura…");
    pararQR();
    tentandoQR = true;
    atualizarQR();
    window.__ccProxQRInterval = setInterval(atualizarQR, 4000);
  }

  async function atualizarQR() {
    // Modal fechada? encerra o polling sozinho (content script sobrevive ao DOM)
    if (!modalViva()) {
      pararQR();
      return;
    }
    if (!tentandoQR) return;
    var resp = await enviar({ type: "proxQR" });
    if (!modalViva()) {
      pararQR();
      return;
    }
    if (tratarChave(resp)) return;
    if (resp.ok && resp.conectado) {
      pararQR();
      conectado = true;
      mostrarStatus("WhatsApp conectado!");
      pintarConexao();
      await carregarGrupos();
      return;
    }
    if (!resp.ok) {
      mostrarErro("px-erro-qr", resp.error || "Não foi possível gerar o QR Code.");
      var espere = $("px-qr-espere");
      if (espere) espere.style.display = "";
      var img0 = $("px-qr-img");
      if (img0) img0.style.display = "none";
      return;
    }
    if (resp.base64) {
      var img = $("px-qr-img");
      if (img.getAttribute("src") !== resp.base64) img.src = resp.base64;
      img.style.display = "";
      $("px-qr-espere").style.display = "none";
      setText("px-qr-msg", "Aguardando leitura… (o código se renova sozinho)");
    }
  }

  // =====================================================
  // Coluna direita — grupos + mensagem
  // =====================================================
  async function carregarGrupos() {
    if (!conectado) return;
    if (carregandoGrupos) return;
    if (!modalViva()) return;
    carregandoGrupos = true;
    mostrarErro("px-erro-grupos", "");
    $("px-grupos-vazio").classList.remove("visivel");
    $("px-lista-grupos").classList.add("oculto");
    var aviso = $("px-grupos-aviso");
    if (aviso) {
      // Spinner + texto: sem isso a tela fica parada até 30s e parece travada.
      aviso.innerHTML = '<span class="px-spin" aria-hidden="true"></span>' +
        "<span>Conectado! Buscando os grupos do seu WhatsApp… pode levar até 30 segundos.</span>";
      aviso.classList.remove("oculto");
    }

    var resp = await enviar({ type: "proxGrupos" });
    carregandoGrupos = false;
    // Modal pode ter sido fechada durante o fetch (até 30s) — nada de DOM
    if (!modalViva()) return;
    aviso = $("px-grupos-aviso");
    if (tratarChave(resp)) return;
    if (resp.desconectado) {
      if (aviso) aviso.classList.add("oculto");
      conectado = false;
      pintarConexao();
      iniciarQR("WhatsApp desconectado — escaneie o QR Code de novo.");
      return;
    }
    if (!resp.ok) {
      if (aviso) aviso.classList.add("oculto");
      mostrarErro("px-erro-grupos", (resp.error || "Falha ao buscar grupos.") +
        " Toque em recarregar para tentar de novo.");
      return;
    }
    if (resp.vazio) {
      if (aviso) aviso.classList.add("oculto");
      $("px-grupos-vazio").classList.add("visivel");
      return;
    }
    if (aviso) aviso.classList.add("oculto");
    renderGrupos(resp.grupos);
  }

  function renderGrupos(grupos) {
    if (!modalViva()) return;
    var campoBusca = $("px-busca-grupo");
    var lista = $("px-lista-grupos");
    if (!campoBusca || !lista) return;
    var busca = (campoBusca.value || "").trim().toLowerCase();
    lista.textContent = "";
    var visiveis = 0;
    grupos.forEach(function (g) {
      if (busca && (g.nome || "").toLowerCase().indexOf(busca) === -1) return;
      visiveis++;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "px-item-grupo" + (g.id === cfg.grupoId ? " px-escolhido" : "");
      b.textContent = g.nome;
      b.addEventListener("click", function () { escolherGrupo(g); });
      lista.appendChild(b);
    });
    if (!visiveis && busca) {
      var vazio = document.createElement("div");
      vazio.className = "px-item-grupo";
      vazio.style.cursor = "default";
      vazio.style.color = "#7286ad";
      vazio.textContent = "Nenhum grupo com \"" + (campoBusca.value || "").trim() + "\".";
      lista.appendChild(vazio);
    }
    lista._grupos = grupos;
    pintarEstadoLista();
  }

  async function escolherGrupo(g) {
    var resp = await enviar({ type: "proxSelecionar", id: g.id, nome: g.nome });
    if (!modalViva()) return;
    if (tratarChave(resp)) return;
    if (!resp.ok) {
      mostrarErro("px-erro-grupos", resp.error || "Falha ao salvar o grupo.");
      return;
    }
    cfg.grupoId = g.id;
    cfg.grupoNome = g.nome;
    $("px-nome-grupo").textContent = g.nome;
    var lista = $("px-lista-grupos");
    if (lista && lista._grupos) renderGrupos(lista._grupos);
    listaAberta = false; // grupo escolhido fica fixo no card; lista recolhe
    pintarEstadoLista();
    mostrarStatus("Grupo \"" + g.nome + "\" escolhido — o botão Enviar PROX já usa ele. Para mudar, toque em \"Trocar grupo\".");
  }

  async function desconectar() {
    var btn = $("px-btn-desconectar");
    btn.disabled = true;
    setText("px-lbl-desconectar", "Desconectando…");
    var resp = await enviar({ type: "proxDesconectar" });
    btn.disabled = false;
    setText("px-lbl-desconectar", "Desconectar");
    if (!modalViva()) return;
    if (tratarChave(resp)) return;
    if (!resp.ok) {
      mostrarErro("px-erro-conexao", resp.error || "Falha ao desconectar.");
      return;
    }
    conectado = false;
    mostrarStatus("Desconectado — escaneie um novo QR para reconectar.");
    pintarConexao();
    iniciarQR("Desconectado. Escaneie o novo QR Code.");
  }

  async function salvarTexto() {
    var campo = $("px-campo-texto");
    if (!campo) return;
    var valor = (campo.value || "").trim() || "prox";
    var resp = await enviar({ type: "proxSalvarConfig", texto: valor });
    if (!modalViva()) return;
    if (tratarChave(resp)) return;
    if (!resp.ok) {
      mostrarErro("px-erro-grupos", resp.error || "Falha ao salvar a mensagem.");
      return;
    }
    cfg.texto = valor;
    mostrarStatus("Mensagem salva: \"" + valor + "\"");
  }

  // =====================================================
  // Gesto do proprietário: 4 toques no rodapé (ou na assinatura
  // Alares do cabeçalho) liberam o link "Alterar API Key".
  // =====================================================
  var gestoToques = 0;
  var gestoTimer = null;
  function gestoProprietario() {
    gestoToques++;
    if (gestoTimer) clearTimeout(gestoTimer);
    gestoTimer = setTimeout(function () { gestoToques = 0; }, 2000);
    if (gestoToques < 4) return;
    gestoToques = 0;
    var btnChave = $("px-btn-editar-chave");
    if (btnChave) btnChave.classList.remove("oculto");
    mostrarStatus("Menu do proprietário liberado.");
  }

  // =====================================================
  // Ligações de eventos
  // =====================================================
  function ligar() {
    $("px-btn-salvar-chave").addEventListener("click", salvarChave);
    $("px-campo-chave").addEventListener("keydown", function (e) {
      if (e.key === "Enter") salvarChave();
    });
    $("px-btn-padrao").addEventListener("click", usarPadrao);
    $("px-btn-cancelar-chave").addEventListener("click", function () {
      mostrarErro("px-erro-chave", "");
      iniciarLive();
    });
    $("px-btn-recarregar-qr").addEventListener("click", function () {
      mostrarErro("px-erro-qr", "");
      iniciarQR("Atualizando o QR Code…");
    });
    $("px-busca-grupo").addEventListener("input", function () {
      var lista = $("px-lista-grupos");
      if (lista && lista._grupos) renderGrupos(lista._grupos);
    });
    $("px-btn-recarregar-grupos").addEventListener("click", function () { carregarGrupos(); });
    var btnTrocar = $("px-btn-trocar");
    if (btnTrocar) {
      btnTrocar.addEventListener("click", function () {
        listaAberta = true; // reabre a lista para trocar quando quiser
        pintarEstadoLista();
        var lista = $("px-lista-grupos");
        if (lista && lista._grupos) renderGrupos(lista._grupos);
        else carregarGrupos();
        var busca = $("px-busca-grupo");
        if (busca) busca.focus();
      });
    }
    $("px-btn-desconectar").addEventListener("click", desconectar);
    $("px-btn-editar-chave").addEventListener("click", function () { abrirChave(""); });
    $("px-campo-texto").addEventListener("change", salvarTexto);
    var rodape = $("px-rodape");
    if (rodape) rodape.addEventListener("click", gestoProprietario);
    var logo = $("cc-prox-logo");
    if (logo) logo.addEventListener("click", gestoProprietario);
  }

  async function iniciar() {
    if (!modalViva()) return; // modal não está no DOM
    if (!$("px-etapa-chave")) return;
    ligar();
    await recarregarConfig();
    if (!modalViva()) return;
    if (!cfg.temChave) {
      abrirChave("");
      return;
    }
    var est = await enviar({ type: "proxEstado" });
    if (!modalViva()) return;
    if (tratarChave(est)) return;
    conectado = !!(est.ok && est.conectado);
    if (est.erroServidor) {
      mostrarStatus("Servidor indisponível — tentando de novo…");
    }
    if (est.rate && est.rate.bloqueado) {
      mostrarStatus("Aguarde " + est.rate.aguarde + "s para enviar de novo — limite anti-spam de 5 mensagens a cada 30 segundos (proteção da sua conta).", 8000);
    }
    await iniciarLive();
  }

  iniciar();
})();
