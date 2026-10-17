// Content script da modal "WhatsApp do Suporte" (injetado pelo background
// junto com SUPORTE MODAL.html). É a cópia da modal do PROX adaptada para o
// suporte: o admin conecta o WhatsApp da equipe (instância própria "sug-")
// e escolhe o grupo que vai receber as sugestões das operadoras. Cuida só
// da interface: cada ação vira uma mensagem para o background, que conversa
// com a Evolution API (whatsapp.hubly.software). A API Key é a mesma do
// PROX (compartilhada); instância e grupo são próprios do suporte.
// Todas as funções assíncronas conferem modalViva() depois do await: a modal
// pode ser fechada enquanto a rede responde (fetch de grupos leva até 30s).
(function () {
  "use strict";

  // Polling de QR: um por vez na página inteira (modal reaberta mata o anterior)
  if (window.__ccSuporteQRInterval) {
    clearInterval(window.__ccSuporteQRInterval);
    window.__ccSuporteQRInterval = null;
  }

  var cfg = { temChave: false, temPadrao: false, temManual: false, apikey: "", instancia: "", grupoId: null, grupoNome: null };
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
    var corpo = document.getElementById("cc-suporte-corpo");
    return (corpo && corpo.shadowRoot) ? corpo.shadowRoot.getElementById(id) : null;
  }
  function raizConteudo() {
    var corpo = document.getElementById("cc-suporte-corpo");
    return (corpo && corpo.shadowRoot) ? corpo.shadowRoot : document;
  }
  function modalViva() { return !!document.getElementById("cc-suporte-modal"); }
  function setText(id, txt) { var el = $(id); if (el) el.textContent = txt; }

  function enviar(msg) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(msg, function (resp) {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          var r = resp || { ok: false, error: "Sem resposta do fundo da extensão." };
          // Token de admin venceu no meio do uso: avisa uma vez, no rodapé
          // (o erro também segue para quem chamou).
          if (r.sessaoExpirada) {
            mostrarStatus(r.error || "Sessão do admin expirou — entre na área do admin novamente.", 9000);
          }
          resolve(r);
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
    if (window.__ccSuporteQRInterval) {
      clearInterval(window.__ccSuporteQRInterval);
      window.__ccSuporteQRInterval = null;
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
    var resp = await enviar({ type: "suporteLerConfig" });
    if (resp && resp.ok) {
      cfg = {
        temChave: !!resp.temChave,
        temPadrao: !!resp.temPadrao,
        temManual: !!resp.temManual,
        apikey: resp.apikey || "",
        instancia: resp.instancia || "",
        grupoId: resp.grupoId || null,
        grupoNome: resp.grupoNome || null
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
    // Só dá para propagar a escolha pro time quando existe um grupo escolhido
    var propagar = $("px-btn-propagar");
    if (propagar) propagar.classList.toggle("oculto", !temGrupo);
  }

  // Copia o JSON da config do suporte pronto para o mantenedor publicar em
  // assets/suporte-config.json (repositório) — assim a escolha do grupo E a
  // instância conectada aqui saem daqui e chegam em todos os navegadores na
  // sincronização de 60 minutos (as sugestões do time inteiro passam a sair
  // por este WhatsApp do suporte).
  function propagarConfig() {
    if (!cfg.grupoId) {
      mostrarStatus("Escolha o grupo antes de copiar a configuração.");
      return;
    }
    var json = JSON.stringify({
      grupoSuporte: cfg.grupoId,
      grupoNome: cfg.grupoNome || "",
      instancia: cfg.instancia || "",
      atualizadoEm: new Date().toISOString().slice(0, 10)
    }, null, 2);
    var aviso = "Config copiada! Cole em assets/suporte-config.json do repositório e publique — o time recebe em até 60 minutos e as sugestões saem por este WhatsApp.";
    var colarNoPrompt = function () {
      window.prompt("Copie a config abaixo e cole em assets/suporte-config.json do repositório:", json);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(function () { mostrarStatus(aviso, 12000); })
        .catch(colarNoPrompt);
    } else {
      colarNoPrompt();
    }
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
    window.__ccSuporteQRInterval = setInterval(atualizarQR, 4000);
  }

  async function atualizarQR() {
    // Modal fechada? encerra o polling sozinho (content script sobrevive ao DOM)
    if (!modalViva()) {
      pararQR();
      return;
    }
    if (!tentandoQR) return;
    var resp = await enviar({ type: "suporteQR" });
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

    var resp = await enviar({ type: "suporteGrupos" });
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
    var resp = await enviar({ type: "suporteSelecionar", id: g.id, nome: g.nome });
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
    mostrarStatus("Grupo \"" + g.nome + "\" definido para o suporte — as sugestões passam a ir para ele. Para mudar, toque em \"Trocar grupo\".");
  }

  async function desconectar() {
    var btn = $("px-btn-desconectar");
    btn.disabled = true;
    setText("px-lbl-desconectar", "Desconectando…");
    var resp = await enviar({ type: "suporteDesconectar" });
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
    var btnPropagar = $("px-btn-propagar");
    if (btnPropagar) btnPropagar.addEventListener("click", propagarConfig);
    // Tela já é do admin (senha na popup): o link de chave aparece direto.
    var btnChave = $("px-btn-editar-chave");
    if (btnChave) {
      btnChave.classList.remove("oculto");
      btnChave.addEventListener("click", function () { abrirChave(""); });
    }
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
    var est = await enviar({ type: "suporteEstado" });
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

