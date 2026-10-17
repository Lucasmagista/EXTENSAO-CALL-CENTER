// Em modo "barra lateral" este mesmo script roda dentro do sidepanel.html;
// nesse contexto a janela não deve se fechar sozinha.
const EM_SIDE_PANEL = document.body.dataset.emSidepanel === "1";

function fecharSePopup() {
  if (!EM_SIDE_PANEL) window.close(); // Fecha a janelinha da extensão automaticamente
}

// Helpers de visibilidade (usam a classe .oculto do styles.css)
function mostrar(el) { el.classList.remove("oculto"); }
function ocultar(el) { el.classList.add("oculto"); }

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

function send(msg, tag) {
  setStatus("Enviando...");
  chrome.runtime.sendMessage({ type: "runFlow", msg, tag }, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus("Erro: " + chrome.runtime.lastError.message);
      return;
    }
    if (resp && resp.ok) {
      setStatus("Comando enviado!");
    } else {
      setStatus(resp && resp.error ? resp.error : "Falha ao enviar.");
    }
    setTimeout(() => setStatus(""), 3000);
  });
}

// Ícone Lucide do sprite do popup.html (mesmos SVGs do animateicons)
function svgIco(nome) {
  return '<svg class="ico" aria-hidden="true"><use href="#i-' + nome + '"/></svg>';
}

// Texto seguro para innerHTML (escapa <, >, & e aspas)
function esc(t) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ==========================================
// LÓGICA DE NAVEGAÇÃO ENTRE TELAS
// ==========================================
const telaPrincipal = document.getElementById("tela-principal");
const telaSecundaria = document.getElementById("tela-secundaria");
const telaLinks = document.getElementById("tela-links");
const telaConfig = document.getElementById("tela-config");
const telaAdmin = document.getElementById("modal-admin");

// Volta para a tela principal (tela secundária Relatos/Mensagens)
document.getElementById("btn-voltar").addEventListener("click", () => {
  ocultar(telaSecundaria);
  mostrar(telaPrincipal);
});

// Volta para a tela principal (tela Links)
document.getElementById("btn-voltar-links").addEventListener("click", () => {
  ocultar(telaLinks);
  mostrar(telaPrincipal);
});

// Fecha a modal admin (botão ✕, clique no fundo ou Esc)
function fecharModalAdmin() { ocultar(telaAdmin); }
document.getElementById("btn-admin-fechar").addEventListener("click", fecharModalAdmin);
telaAdmin.addEventListener("click", (e) => { if (e.target === telaAdmin) fecharModalAdmin(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !telaAdmin.classList.contains("oculto")) fecharModalAdmin(); });

// ==========================================
// CATÁLOGO DE AÇÕES (usadas pelos botões da tela principal)
// Cada acao executa a lógica original — agora centralizada aqui para que
// qualquer botão (padrão ou criado no admin) possa usá-la.
// ==========================================
const ACOES = {
  "check": { nome: "Enviar ✅", icone: "check", executar: () => send("✅", "check") },
  "enviar-prox": { nome: "Enviar PROX", icone: "send", executar: () => acaoEnviarProx() },
  "config-prox": { nome: "Configurar PROX", icone: "sliders", executar: () => abrirModalProx("Abrindo configuração do PROX...") },
  "tela-relatos": { nome: "Relatos / Mensagens", icone: "message", executar: () => { ocultar(telaPrincipal); mostrar(telaSecundaria); } },
  "relatos": { nome: "Relatos", icone: "clipboard", executar: () => acaoRelatos() },
  "mensagens": { nome: "Mensagens", icone: "message-circle", executar: () => acaoMensagens() },
  "snippets": { nome: "Snippets", icone: "file", executar: () => chrome.tabs.create({ url: chrome.runtime.getURL("snippets.html") }) },
  "huawei": { nome: "Configurar x6", icone: "router", executar: () => acaoHuawei() },
  "senha-wifi": { nome: "Senha Wi-Fi x6", icone: "wifi", executar: () => acaoSenhaWifi() },
  "sugestoes": { nome: "Sugestões", icone: "lightbulb", executar: () => acaoSugestoes() },
  "abrir-url": { nome: "Abrir link", icone: "link", executar: (b) => { if (b.url && /^https?:\/\//i.test(b.url)) chrome.tabs.create({ url: b.url }); } }
};

// Ícones disponíveis para escolher no painel admin
const ICONES_DISP = ["check", "send", "sliders", "message", "message-circle", "link", "router", "wifi", "file", "lightbulb", "volume", "puzzle", "panel", "grid", "crosshair", "clipboard", "users", "music", "settings", "eye", "eye-off", "check-circle"];

// ==========================================
// CONFIGURAÇÃO DOS BOTÕES (ccTools_uiCustom)
// ==========================================
// Lista ordenada de botões da tela principal. O admin edita esta lista
// (ordem, visibilidade, rótulo, ação, ícone) e pode criar botões novos
// (link direto) e submenus (como o "Links").
const UI_CUSTOM_KEY = "ccTools_uiCustom";
const LINKS_PADRAO = [
  { nome: "Ramais", url: "https://docs.google.com/spreadsheets/d/1r7gK3W7Q5K-5r6qd-3sj5lklAxlcHnM7EArm-D_3Jwk/edit?pli=1&gid=1858272844#gid=1858272844" },
  { nome: "Links", url: "https://docs.google.com/spreadsheets/d/1hdpzDmJ8u1q-0JxcqQIhHcdPtNGa05IfEm-BFl3v3_k/edit?gid=0#gid=0" },
  { nome: "Recados/Roteiro", url: "https://docs.google.com/document/d/1eYtQZxso1gCsfOMilhDBHvlo2P8HBy0iTmlATlNYgRM/edit?tab=t.0" }
];

function idNovo() { return "b-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6); }

function botoesPadrao() {
  return [
    { id: "enviar", tipo: "padrao", rotulo: "Enviar", acao: "check", icone: "check", visivel: true },
    { id: "relatos-mensagens", tipo: "padrao", rotulo: "Relatos / Mensagens", acao: "tela-relatos", icone: "message", visivel: true },
    { id: "links", tipo: "menu", rotulo: "Links", icone: "link", visivel: true, itens: LINKS_PADRAO.map((l) => ({ id: idNovo(), nome: l.nome, url: l.url })) },
    { id: "huawei", tipo: "padrao", rotulo: "Configurar x6", acao: "huawei", icone: "router", visivel: true },
    { id: "senha-wifi", tipo: "padrao", rotulo: "Senha Wi-Fi x6", acao: "senha-wifi", icone: "wifi", visivel: true },
    { id: "snippets", tipo: "padrao", rotulo: "Snippets", acao: "snippets", icone: "file", visivel: true },
    { id: "sugestoes", tipo: "padrao", rotulo: "Sugestões", acao: "sugestoes", icone: "lightbulb", visivel: true }
  ];
}

let cfgUi = { proxVisivel: true, botoes: botoesPadrao() };

// Normaliza o que veio do storage (tolerante a corrupção/versões antigas)
function normalizarCfgUi(bruto) {
  const cfg = { proxVisivel: true, botoes: [] };
  if (!bruto || typeof bruto !== "object") { cfg.botoes = botoesPadrao(); return cfg; }
  cfg.proxVisivel = bruto.proxVisivel !== false;
  const lista = Array.isArray(bruto.botoes) ? bruto.botoes : [];
  lista.forEach((b) => {
    if (!b || typeof b !== "object") return;
    const tipo = b.tipo === "menu" ? "menu" : (b.tipo === "link" ? "link" : "padrao");
    const item = {
      id: String(b.id || idNovo()),
      tipo,
      rotulo: String(b.rotulo || "Botão").slice(0, 40),
      icone: ICONES_DISP.indexOf(b.icone) !== -1 ? b.icone : (tipo === "menu" ? "link" : "check"),
      visivel: b.visivel !== false
    };
    if (tipo === "menu") {
      item.itens = (Array.isArray(b.itens) ? b.itens : []).slice(0, 50).map((it) => ({
        id: String(it && it.id || idNovo()),
        nome: String(it && it.nome || "").slice(0, 40),
        url: String(it && it.url || "").slice(0, 500)
      })).filter((it) => it.nome || it.url);
      cfg.botoes.push(item);
    } else if (tipo === "link") {
      item.acao = "abrir-url";
      item.url = String(b.url || "").slice(0, 500);
      cfg.botoes.push(item);
    } else {
      const acao = String(b.acao || "");
      if (ACOES[acao] && acao !== "abrir-url") {
        item.acao = acao;
        cfg.botoes.push(item);
      }
    }
  });
  if (!cfg.botoes.length) cfg.botoes = botoesPadrao();
  return cfg;
}

function salvarCfgUi(msg) {
  const paraSalvar = { proxVisivel: cfgUi.proxVisivel, botoes: cfgUi.botoes };
  chrome.storage.local.set({ [UI_CUSTOM_KEY]: paraSalvar }, () => {
    renderizarPrincipal();
    if (msg) { setStatus(msg); setTimeout(() => setStatus(""), 2200); }
  });
}

// ==========================================
// RENDERIZAÇÃO DA TELA PRINCIPAL (dinâmica)
// ==========================================
function renderizarPrincipal() {
  const split = document.getElementById("btnProxSplit");
  split.classList.toggle("oculto", !cfgUi.proxVisivel);
  const caixa = document.getElementById("lista-botoes");
  caixa.textContent = "";
  cfgUi.botoes.filter((b) => b.visivel !== false).forEach((b) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = svgIco(b.icone || "check") + " " + esc(b.rotulo || "Botão");
    btn.title = b.tipo === "menu"
      ? (b.itens.length + " link(s) — clique para abrir")
      : (ACOES[b.acao] ? ACOES[b.acao].nome : "Botão");
    btn.addEventListener("click", () => {
      if (b.tipo === "menu") { abrirTelaLinks(b); return; }
      const a = ACOES[b.acao];
      if (a) a.executar(b);
    });
    caixa.appendChild(btn);
  });
}

// Tela "Links" (agora montada a partir do submenu do config)
let menuAberto = null;
function abrirTelaLinks(menu) {
  menuAberto = menu;
  const lista = document.getElementById("lista-links");
  lista.textContent = "";
  (menu.itens || []).forEach((link) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = link.nome || "(sem nome)";
    botao.addEventListener("click", () => {
      const enderecos = link.url ? [link.url] : [];
      enderecos.filter(Boolean).forEach((endereco, i) => {
        if (/^https?:\/\//i.test(endereco)) chrome.tabs.create({ url: endereco, active: i === 0 });
      });
    });
    lista.appendChild(botao);
  });
  if (!(menu.itens || []).length) {
    const aviso = document.createElement("div");
    aviso.className = "modo-dica";
    aviso.style.textAlign = "center";
    aviso.textContent = "Nenhum link cadastrado neste submenu.";
    lista.appendChild(aviso);
  }
  ocultar(telaPrincipal);
  mostrar(telaLinks);
}

// ==========================================
// FUNÇÕES DAS AÇÕES (originais, agora nomeadas)
// ==========================================
document.getElementById("btn-relatos").addEventListener("click", () => acaoRelatos());
document.getElementById("btn-mensagens").addEventListener("click", () => acaoMensagens());

function acaoRelatos() {
  setStatus("Abrindo relatos...");
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (chrome.runtime.lastError || !tabs || !tabs[0]) {
      setStatus("Nenhuma aba ativa encontrada.");
      return;
    }
    fecharPaineisAbertos(tabs[0].id, () => {
      // MAIN world: o relato usa o editor (DevExpress/Quill) da própria página
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        world: 'MAIN',
        files: ['relatos.js']
      });
      fecharSePopup();
    });
  });
}

// Mensagens rápidas: funciona de QUALQUER tela. O painel abre na aba ativa —
// a extensão não abre nem foca aba do WhatsApp Web.
function acaoMensagens() {
  setStatus("Abrindo mensagens...");
  chrome.runtime.sendMessage({ type: "runQuickReplyMenu" }, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus("Erro: " + chrome.runtime.lastError.message);
      return;
    }
    if (resp && resp.ok) {
      fecharSePopup();
      return;
    }
    setStatus((resp && resp.error) || "Não foi possível abrir as mensagens.");
    setTimeout(() => setStatus(""), 4000);
  });
}

function acaoHuawei() {
  setStatus("Configurando roteador...");
  chrome.runtime.sendMessage({ type: "runHuaweiConfig" }, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus("Erro: " + chrome.runtime.lastError.message);
      return;
    }
    if (resp && resp.ok) {
      setStatus("Rodando! Aguarde o relatório na tela.");
    } else {
      setStatus(resp && resp.error ? resp.error : "Falha ao configurar.");
    }
    setTimeout(() => setStatus(""), 3000);
  });
}

function acaoSenhaWifi() {
  setStatus("Abrindo senha Wi-Fi...");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) {
      setStatus("Nenhuma aba ativa encontrada.");
      return;
    }
    chrome.runtime.sendMessage({ type: "mostrarModalSenhaWifi", tabId: tab.id }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        setStatus((resp && resp.error) ||
          (chrome.runtime.lastError && chrome.runtime.lastError.message) ||
          "Abra o WhatsApp Web ou o chat da empresa.");
        setTimeout(() => setStatus(""), 3500);
        return;
      }
      fecharSePopup();
    });
  });
}

// ==========================================
// PREVENÇÃO DE BUG (FECHAR TELAS SOBREPOSTAS)
// ==========================================
// Esta função força o fechamento de qualquer painel de mensagem/relato
// que já esteja aberto na tela de fundo antes de injetar um novo.
function fecharPaineisAbertos(tabId, callback) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      const possiveisIDs = ['skx-proto-panel', 'skx-proto-ov', 'wpp-quickreply-panel'];
      possiveisIDs.forEach(id => {
        let el = document.getElementById(id);
        if (el) el.remove();
      });
    }
  }, () => {
    if (callback) callback();
  });
}

// ==========================================
// ENVIAR PROX (botão dividido: enviar + configuração)
// ==========================================
const btnProxEnviar = document.getElementById("btnProxEnviar");
const btnProxConfig = document.getElementById("btnProxConfig");
let proxInfo = { temChave: false, conectado: false, grupoNome: null };

function pintarEstadoProx() {
  btnProxEnviar.dataset.conectado = proxInfo.conectado ? "1" : "0";
  const lbl = document.getElementById("lblProxEnviar");
  const icoOk = document.getElementById("icoProxOk");
  if (lbl) lbl.textContent = "Enviar PROX";
  if (icoOk) icoOk.classList.toggle("oculto", !proxInfo.conectado);
  if (proxInfo.conectado) {
    btnProxEnviar.title = "Conectado — envia \"" + (proxInfo.texto || "prox") + "\" em: " +
      (proxInfo.grupoNome || "grupo não escolhido");
  } else {
    btnProxEnviar.title = proxInfo.temChave
      ? "WhatsApp desconectado — clique para escanear o QR"
      : "Conecte o servidor de Zap (clique)";
  }
}

// Estado real (servidor) ao abrir a popup — falha de rede não quebra a UI
chrome.runtime.sendMessage({ type: "proxEstado" }, (resp) => {
  if (chrome.runtime.lastError || !resp) return;
  proxInfo = resp;
  pintarEstadoProx();
});

// Abre a modal na aba ativa (mesmo caminho do botão Senha Wi-Fi x6)
function abrirModalProx(mensagem) {
  setStatus(mensagem || "Abrindo PROX...");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) {
      setStatus("Nenhuma aba ativa encontrada.");
      return;
    }
    chrome.runtime.sendMessage({ type: "mostrarModalProx", tabId: tab.id }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        setStatus((resp && resp.error) ||
          (chrome.runtime.lastError && chrome.runtime.lastError.message) ||
          "Abra o WhatsApp Web ou o chat da empresa.");
        setTimeout(() => setStatus(""), 3500);
        return;
      }
      fecharSePopup();
    });
  });
}

function acaoEnviarProx() {
  setStatus("Enviando PROX...");
  chrome.runtime.sendMessage({ type: "proxAcao" }, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus("Erro: " + chrome.runtime.lastError.message);
      return;
    }
    if (resp && resp.ok) {
      setStatus("PROX enviado para " + resp.grupo + "!");
      setTimeout(() => setStatus(""), 3000);
      return;
    }
    if (resp && resp.abrir) {
      abrirModalProx(resp.error
        ? resp.error
        : "Conecte o WhatsApp para enviar o PROX...");
      return;
    }
    setStatus((resp && resp.error) || "Falha ao enviar.");
    setTimeout(() => setStatus(""), 3500);
  });
}

btnProxEnviar.addEventListener("click", () => acaoEnviarProx());
btnProxConfig.addEventListener("click", () => abrirModalProx("Abrindo configuração do PROX..."));

// ==========================================
// VOLUME DOS SNIPPETS E DA NOTIFICAÇÃO DE COMANDO
// ==========================================
// Regula tanto o áudio dos snippets quanto o "ding" de confirmação tocado
// quando um comando insere/envia mensagem no chat (quickreply, relatos,
// snippets e fluxo ✅).
const VOLUME_STORAGE_KEY = "ccTools_volume";
const rangeVolume = document.getElementById("rangeVolume");
const volumeValor = document.getElementById("volumeValor");

function mostrarVolume(v) {
  volumeValor.textContent = v + "%";
}

chrome.storage.local.get([VOLUME_STORAGE_KEY], (res) => {
  const v = typeof res[VOLUME_STORAGE_KEY] === "number" ? res[VOLUME_STORAGE_KEY] : 70;
  rangeVolume.value = v;
  mostrarVolume(v);
});

rangeVolume.addEventListener("input", () => {
  const v = Number(rangeVolume.value);
  mostrarVolume(v);
  chrome.storage.local.set({ [VOLUME_STORAGE_KEY]: v });
});

// ==========================================
// SOM DE CONFIRMAÇÃO PERSONALIZADO
// ==========================================
// A operadora pode trocar o "ding" padrão por um arquivo de áudio dela
// (MP3/WAV/OGG até 500 KB). O arquivo vira data URL e fica só no
// chrome.storage.local deste navegador; o background toca ele quando houver
// e cai no sintetizado padrão quando não houver.
const SOM_CUSTOM_KEY = "ccTools_somCustom";
const SOM_NOME_KEY = "ccTools_somCustomNome";
const SOM_LIMITE = 500 * 1024;
const somValor = document.getElementById("somValor");
const btnSomPadrao = document.getElementById("btnSomPadrao");
const inputSom = document.getElementById("inputSom");

function mostrarSomAtual(nome) {
  const tem = !!nome;
  somValor.textContent = tem ? nome : "padrão";
  somValor.title = tem ? "Som personalizado: " + nome : "Ding padrão da extensão";
  btnSomPadrao.classList.toggle("oculto", !tem);
}

chrome.storage.local.get([SOM_NOME_KEY], (res) => mostrarSomAtual(res[SOM_NOME_KEY] || ""));

document.getElementById("btnEscolherSom").addEventListener("click", () => inputSom.click());

inputSom.addEventListener("change", () => {
  const arquivo = inputSom.files && inputSom.files[0];
  inputSom.value = "";
  if (!arquivo) return;
  if (arquivo.size > SOM_LIMITE) {
    setStatus("Arquivo grande demais (máx. 500 KB). Escolha um menor.");
    setTimeout(() => setStatus(""), 3500);
    return;
  }
  if (arquivo.type && !/^audio\//.test(arquivo.type) && !/\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(arquivo.name || "")) {
    setStatus("Escolha um arquivo de áudio (mp3, wav, ogg, m4a, aac ou webm).");
    setTimeout(() => setStatus(""), 3500);
    return;
  }
  const leitor = new FileReader();
  leitor.onload = () => {
    // readAsDataURL de áudio sempre resulta em data:audio/ — confere antes de
    // guardar no storage (o background e o offscreen exigem o mesmo prefixo).
    const base64 = String(leitor.result);
    if (!base64.startsWith("data:audio/")) {
      setStatus("Arquivo inválido — só áudio (mp3, wav, ogg, m4a, aac ou webm).");
      setTimeout(() => setStatus(""), 3500);
      return;
    }
    chrome.storage.local.set({ [SOM_CUSTOM_KEY]: base64, [SOM_NOME_KEY]: arquivo.name }, () => {
      mostrarSomAtual(arquivo.name);
      setStatus("Som personalizado salvo — já vale nos próximos comandos.");
      setTimeout(() => setStatus(""), 2500);
    });
  };
  leitor.onerror = () => {
    setStatus("Não consegui ler esse arquivo. Tente outro.");
    setTimeout(() => setStatus(""), 3500);
  };
  leitor.readAsDataURL(arquivo);
});

btnSomPadrao.addEventListener("click", () => {
  chrome.storage.local.remove([SOM_CUSTOM_KEY, SOM_NOME_KEY], () => {
    mostrarSomAtual("");
    setStatus("Som padrão restaurado.");
    setTimeout(() => setStatus(""), 2500);
  });
});

document.getElementById("btnOuvirSom").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "playNotificacao" }).catch(() => {});
});

// ==========================================
// SUGESTÕES (modal na aba ativa)
// ==========================================
// O botão abre a modal "Sugestões" na aba ativa (mesmo caminho do PROX): o
// formulário completo (função, nome obrigatório, email, setor, período e o
// que quer adicionar) mora na modal; o background monta a mensagem padrão
// e envia para o grupo do suporte pela Evolution API. Se o grupo ainda não
// estiver configurado, o texto pronto é copiado para a área de transferência
// — o fluxo nunca trava. A área do admin (senha) também fica na modal.
function acaoSugestoes() {
  setStatus("Abrindo Sugestões...");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) {
      setStatus("Nenhuma aba ativa encontrada.");
      return;
    }
    chrome.runtime.sendMessage({ type: "mostrarModalSugestoes", tabId: tab.id }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        setStatus((resp && resp.error) ||
          (chrome.runtime.lastError && chrome.runtime.lastError.message) ||
          "Abra o WhatsApp Web ou o chat da empresa.");
        setTimeout(() => setStatus(""), 3500);
        return;
      }
      fecharSePopup();
    });
  });
}

// ==========================================
// SNIPPETS NESTE SITE (liberação site a site)
// ==========================================
// Os sites padrão já vêm liberados pelo manifest. Para liberar outro site, o
// usuário abre o site, clica no ícone da extensão e em "Permitir snippets
// neste site" — o Chrome mostra o pedido de permissão e, se aceito, o site
// entra na lista e passa a ter os atalhos também nas próximas visitas.
const SITES_SNIPPETS_KEY = "ccTools_sitesPermitidos";
const SITES_BASE = [
  "https://web.whatsapp.com",
  "https://chat.oquei.com.br",
  "https://elleven.oquei.com.br",
  "https://oquei.sz.chat"
];

const siteTexto = document.getElementById("siteTexto");
const btnPermitirSite = document.getElementById("btnPermitirSite");
const btnRemoverSite = document.getElementById("btnRemoverSite");

function origemDaUrl(url) {
  try { return new URL(url).origin; } catch (e) { return null; }
}

let siteAtual = null;

function mostrarInfoSite(origem, ehBase, temPermissao) {
  siteAtual = origem;
  ocultar(btnPermitirSite);
  ocultar(btnRemoverSite);
  if (!origem || !origem.startsWith("https://")) {
    // Só HTTPS: a extensão não pede mais permissão de site sem criptografia
    // (manifest optional_host_permissions é só https://*/*).
    siteTexto.textContent = origem && origem.startsWith("http://")
      ? "Sites sem HTTPS não são liberados — snippets só em sites seguros."
      : "Esta página não permite o uso de snippets.";
    siteAtual = null;
    return;
  }
  if (ehBase || temPermissao) {
    siteTexto.innerHTML = svgIco("check") + " Snippets ativos neste site.";
    if (!ehBase) mostrar(btnRemoverSite);
    return;
  }
  siteTexto.innerHTML = svgIco("message-circle") + " Quer usar snippets neste site também?";
  mostrar(btnPermitirSite);
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs && tabs[0];
  const origem = tab && tab.url ? origemDaUrl(tab.url) : null;
  if (!origem) { mostrarInfoSite(null, false, false); return; }
  const ehBase = SITES_BASE.indexOf(origem) !== -1;
  if (ehBase) { mostrarInfoSite(origem, true, true); return; }
  chrome.storage.local.get([SITES_SNIPPETS_KEY], (res) => {
    if (chrome.runtime.lastError) { mostrarInfoSite(origem, false, false); return; }
    const extras = Array.isArray(res[SITES_SNIPPETS_KEY]) ? res[SITES_SNIPPETS_KEY] : [];
    mostrarInfoSite(origem, false, extras.indexOf(origem) !== -1);
  });
});

btnPermitirSite.addEventListener("click", () => {
  if (!siteAtual) return;
  const origem = siteAtual;
  ocultar(btnPermitirSite);
  // Este clique é o gesto do usuário exigido pelo Chrome para pedir a permissão.
  chrome.permissions.request({ origins: [origem + "/*"] }, (concedido) => {
    if (chrome.runtime.lastError || !concedido) {
      siteTexto.textContent = "Permissão não concedida — snippets continuam desligados aqui.";
      return;
    }
    chrome.runtime.sendMessage({ type: "salvarSiteSnippets", origem }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        siteTexto.textContent = "Erro ao ativar: " +
          ((resp && resp.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || "tente novamente");
        return;
      }
      // Ativa já na aba atual (nas próximas visitas o script dinâmico cuida disso)
      chrome.tabs.query({ active: true, currentWindow: true }, (aba) => {
        const tabId = aba && aba[0] && aba[0].id;
        if (tabId == null) { mostrarInfoSite(origem, false, true); return; }
        chrome.scripting.executeScript({
          target: { tabId },
          files: ["ferramentas-comuns.js", "snippets-content.js", "botao-flutuante.js", "barra-lateral.js"]
        }, () => {
          void chrome.runtime.lastError; // aba pode ter fechado — inofensivo
          mostrarInfoSite(origem, false, true);
        });
      });
    });
  });
});

btnRemoverSite.addEventListener("click", () => {
  if (!siteAtual) return;
  const origem = siteAtual;
  chrome.runtime.sendMessage({ type: "removerSiteSnippets", origem }, () => {
    void chrome.runtime.lastError;
    mostrarInfoSite(origem, false, false);
  });
});

// ==========================================
// FORMA DE ACESSO (tela de configurações)
// ==========================================
// "flutuante": botão 🧩 arrastável nas páginas.
// "lateral":   gatilho 🧰 integrado na página (abaixo do "+", no rodapé...).
// "ambos":     os dois juntos.
// "nenhum":    nenhum botão na página — só o ícone do Chrome (e Alt+X).
// Cada site pode ter regra própria (porSite) que vence o padrão.
const CONFIG_KEY = "ccTools_configModos";
const POS_FAB_KEY = "ccTools_fabPosicao_v2";
const SITES_BASE_NOMES = {
  "https://web.whatsapp.com": "WhatsApp",
  "https://chat.oquei.com.br": "Rocket.Chat",
  "https://elleven.oquei.com.br": "elleven",
  "https://oquei.sz.chat": "sz.chat"
};
const DICAS_PADRAO = {
  flutuante: "Um botão arrastável aparece nas páginas liberadas.",
  lateral: "Um gatilho integrado na página abre o painel de ferramentas.",
  ambos: "Gatilho integrado + botão arrastável nas páginas.",
  nenhum: "Nenhum botão na página — use apenas o ícone do Chrome (e o atalho Alt+X)."
};
const ROTULOS_MODO = {
  padrao: "Usar padrão",
  flutuante: "Flutuante",
  lateral: "Barra lateral",
  ambos: "Ambos",
  nenhum: "Sem botão"
};

const listaModoPorSite = document.getElementById("listaModoPorSite");
const padraoDica = document.getElementById("padraoDica");

let configModos = { padrao: "flutuante", porSite: {} };

function pintarConfig() {
  const padrao = configModos.padrao === "lateral" || configModos.padrao === "ambos" ||
    configModos.padrao === "nenhum"
    ? configModos.padrao : "flutuante";
  document.querySelectorAll(".modo-card").forEach((card) => {
    card.classList.toggle("modo-ativo", card.dataset.modo === padrao);
  });
  padraoDica.textContent = DICAS_PADRAO[padrao] || DICAS_PADRAO.flutuante;
  pintarListaPorSite();
}

function pintarListaPorSite() {
  listaModoPorSite.textContent = "";
  const extras = Array.isArray(configModos._extras) ? configModos._extras : [];
  const origens = Object.keys(SITES_BASE_NOMES).concat(extras);
  origens.forEach((origem) => {
    const linha = document.createElement("div");
    linha.className = "linha-site";
    const nome = document.createElement("span");
    nome.className = "nome-site";
    nome.textContent = SITES_BASE_NOMES[origem] || origem.replace(/^https?:\/\//, "");
    nome.title = origem;
    const select = document.createElement("select");
    ["padrao", "flutuante", "lateral", "ambos", "nenhum"].forEach((valor) => {
      const op = document.createElement("option");
      op.value = valor;
      op.textContent = ROTULOS_MODO[valor];
      select.appendChild(op);
    });
    select.value = configModos.porSite[origem] || "padrao";
    select.addEventListener("change", () => {
      if (select.value === "padrao") delete configModos.porSite[origem];
      else configModos.porSite[origem] = select.value;
      salvarConfig(select.value === "padrao"
        ? "Regra do site removida — usa o padrão."
        : "Regra salva — já vale nas abas abertas.");
    });
    linha.appendChild(nome);
    linha.appendChild(select);
    listaModoPorSite.appendChild(linha);
  });
}

function salvarConfig(msg) {
  const paraSalvar = {
    padrao: configModos.padrao,
    porSite: configModos.porSite
  };
  // Os content scripts reagem ao storage na hora — sem recarregar a página
  chrome.storage.local.set({ [CONFIG_KEY]: paraSalvar }, () => {
    if (msg) {
      setStatus(msg);
      setTimeout(() => setStatus(""), 2500);
    }
  });
}

document.querySelectorAll(".modo-card").forEach((card) => {
  card.addEventListener("click", () => {
    configModos.padrao = card.dataset.modo;
    pintarConfig();
    salvarConfig("Padrão atualizado — já vale nas abas abertas.");
  });
});

document.getElementById("btnResetarPosicao").addEventListener("click", () => {
  chrome.storage.local.remove([POS_FAB_KEY], () => {
    setStatus("Posição do botão restaurada.");
    setTimeout(() => setStatus(""), 2500);
  });
});

// Navegação: principal <-> configurações
document.getElementById("btnAbrirConfig").addEventListener("click", () => {
  ocultar(telaPrincipal);
  mostrar(telaConfig);
  pintarConfig();
});
document.getElementById("btn-voltar-config").addEventListener("click", () => {
  ocultar(telaConfig);
  mostrar(telaPrincipal);
});

// Carrega a configuração (e os sites extras liberados) ao abrir a popup
chrome.storage.local.get([CONFIG_KEY, "ccTools_sitesPermitidos"], (res) => {
  const cfg = res[CONFIG_KEY];
  if (cfg && typeof cfg === "object") {
    configModos.padrao = cfg.padrao === "lateral" || cfg.padrao === "ambos" || cfg.padrao === "nenhum"
      ? cfg.padrao : "flutuante";
    configModos.porSite = (cfg.porSite && typeof cfg.porSite === "object") ? { ...cfg.porSite } : {};
  }
  configModos._extras = Array.isArray(res.ccTools_sitesPermitidos) ? res.ccTools_sitesPermitidos : [];
  pintarConfig();
});

// ==========================================
// PAINEL ADMIN — personalização dos botões
// ==========================================
// Acesso pelo ⚙️ (tela-config) → "Editar botões da tela principal": abre
// como MODAL sobre a janela (sem trocar de tela). A senha é
// verificada no background (PBKDF2); a sessão dura 8h (adminTemSessao) e pode
// ser encerrada com "Sair do admin" (adminSair).
const adminGate = document.getElementById("admin-gate");
const adminEditor = document.getElementById("admin-editor");
const adminSenha = document.getElementById("admin-senha");
const adminGateErro = document.getElementById("admin-gate-erro");
const adminLista = document.getElementById("admin-lista");
let adminAberto = false; // sessão válida nesta janela

document.getElementById("btnAbrirAdmin").addEventListener("click", () => {
  mostrar(telaAdmin);
  abrirAdmin();
});

function abrirAdmin() {
  adminAberto = false;
  adminGateErro.classList.add("oculto");
  adminSenha.value = "";
  // Já tem sessão válida? Pula a senha.
  chrome.runtime.sendMessage({ type: "adminTemSessao" }, (resp) => {
    const temSessao = !chrome.runtime.lastError && resp && resp.ok && resp.ativo;
    if (temSessao) { entrarNoEditor(); return; }
    ocultar(adminEditor);
    mostrar(adminGate);
    adminSenha.focus();
  });
}

function entrarNoEditor() {
  adminAberto = true;
  ocultar(adminGate);
  mostrar(adminEditor);
  pintarAdmin();
}

function mostrarErroGate(msg) {
  adminGateErro.textContent = msg;
  adminGateErro.classList.remove("oculto");
}

document.getElementById("btn-admin-entrar").addEventListener("click", () => tentarEntrarAdmin());
adminSenha.addEventListener("keydown", (e) => { if (e.key === "Enter") tentarEntrarAdmin(); });

function tentarEntrarAdmin() {
  const senha = adminSenha.value;
  adminSenha.value = "";
  if (!senha) { mostrarErroGate("Digite a senha do admin."); return; }
  mostrarErroGate("");
  chrome.runtime.sendMessage({ type: "adminValidarSenha", senha }, (resp) => {
    if (chrome.runtime.lastError) {
      mostrarErroGate("Erro ao verificar: " + chrome.runtime.lastError.message);
      return;
    }
    if (resp && resp.ok) { entrarNoEditor(); return; }
    mostrarErroGate((resp && resp.error) || "Senha incorreta.");
  });
}

document.getElementById("btn-admin-sair").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "adminSair" }, () => {
    void chrome.runtime.lastError;
    adminAberto = false;
    ocultar(adminEditor);
    mostrar(adminGate);
    setStatus("Sessão do admin encerrada.");
    setTimeout(() => setStatus(""), 2000);
  });
});

document.getElementById("btn-admin-add").addEventListener("click", () => {
  cfgUi.botoes.push({ id: idNovo(), tipo: "link", rotulo: "Novo botão", acao: "abrir-url", url: "", icone: "link", visivel: true });
  salvarCfgUi();
  pintarAdmin();
});

document.getElementById("btn-admin-add-menu").addEventListener("click", () => {
  cfgUi.botoes.push({ id: idNovo(), tipo: "menu", rotulo: "Novo submenu", icone: "grid", visivel: true, itens: [] });
  salvarCfgUi();
  pintarAdmin();
});

document.getElementById("btn-admin-reset").addEventListener("click", () => {
  cfgUi = { proxVisivel: true, botoes: botoesPadrao() };
  chrome.storage.local.remove([UI_CUSTOM_KEY], () => {
    renderizarPrincipal();
    pintarAdmin();
    setStatus("Botões padrão restaurados.");
    setTimeout(() => setStatus(""), 2200);
  });
});

function acharBotao(id) { return cfgUi.botoes.find((b) => b.id === id); }

function moverBotao(id, delta) {
  const i = cfgUi.botoes.findIndex((b) => b.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= cfgUi.botoes.length) return;
  const tmp = cfgUi.botoes[i];
  cfgUi.botoes[i] = cfgUi.botoes[j];
  cfgUi.botoes[j] = tmp;
  salvarCfgUi();
  pintarAdmin();
}

function excluirBotao(id) {
  const b = acharBotao(id);
  if (!b) return;
  // Botões "padrao" não podem ser excluídos — só ocultados. Links (menu fixo)
  // também não: é o submenu original da equipe.
  if (b.tipo === "padrao" || id === "links") return;
  cfgUi.botoes = cfgUi.botoes.filter((x) => x.id !== id);
  salvarCfgUi();
  pintarAdmin();
}

function pintarAdmin() {
  adminLista.textContent = "";

  // Linha fixa: mostrar/ocultar o split do PROX
  adminLista.appendChild(montarLinhaProx());

  cfgUi.botoes.forEach((b, idx) => {
    adminLista.appendChild(montarItemAdmin(b, idx));
  });
}

function botaoIcone(titulo, icone, onclick, desabilitado) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "admin-ico-btn";
  btn.title = titulo;
  btn.innerHTML = svgIco(icone);
  if (desabilitado) btn.disabled = true;
  else btn.addEventListener("click", onclick);
  return btn;
}

function montarLinhaProx() {
  const wrap = document.createElement("div");
  wrap.className = "admin-item" + (cfgUi.proxVisivel ? "" : " admin-oculto");
  const topo = document.createElement("div");
  topo.className = "admin-linha-topo";
  const ico = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  ico.setAttribute("class", "admin-ico-prev");
  ico.innerHTML = '<use href="#i-send"/>';
  const nome = document.createElement("span");
  nome.className = "admin-nome";
  nome.textContent = "Enviar PROX";
  const tipo = document.createElement("span");
  tipo.className = "admin-tipo";
  tipo.textContent = "fixo no topo";
  topo.appendChild(ico);
  topo.appendChild(nome);
  topo.appendChild(tipo);
  topo.appendChild(botaoIcone(cfgUi.proxVisivel ? "Ocultar" : "Mostrar", cfgUi.proxVisivel ? "eye-off" : "eye", () => {
    cfgUi.proxVisivel = !cfgUi.proxVisivel;
    salvarCfgUi();
    pintarAdmin();
  }));
  wrap.appendChild(topo);
  return wrap;
}

function montarItemAdmin(b, idx) {
  const wrap = document.createElement("div");
  wrap.className = "admin-item" + (b.visivel === false ? " admin-oculto" : "");
  const topo = document.createElement("div");
  topo.className = "admin-linha-topo";

  // Mover ↑ ↓
  topo.appendChild(botaoIcone("Subir", "cima", () => moverBotao(b.id, -1), idx === 0));
  topo.appendChild(botaoIcone("Descer", "baixo", () => moverBotao(b.id, 1), idx === cfgUi.botoes.length - 1));

  // Ícone atual
  const ico = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  ico.setAttribute("class", "admin-ico-prev");
  ico.innerHTML = '<use href="#i-' + esc(b.icone || "check") + '"/>';
  topo.appendChild(ico);

  const nome = document.createElement("span");
  nome.className = "admin-nome";
  nome.textContent = b.rotulo || "(sem nome)";
  topo.appendChild(nome);

  const tipo = document.createElement("span");
  tipo.className = "admin-tipo";
  tipo.textContent = b.tipo === "menu" ? "submenu" : (b.tipo === "link" ? "link" : "função");
  topo.appendChild(tipo);

  // Mostrar / ocultar
  topo.appendChild(botaoIcone(b.visivel === false ? "Mostrar" : "Ocultar", b.visivel === false ? "eye" : "eye-off", () => {
    b.visivel = b.visivel === false;
    salvarCfgUi();
    pintarAdmin();
  }));

  // Editar (abre/fecha o formulário)
  let formAberto = false;
  const btnEditar = botaoIcone("Editar", "pencil", () => {
    formAberto = !formAberto;
    form.classList.toggle("oculto", !formAberto);
  });
  topo.appendChild(btnEditar);

  // Excluir (só botões criados no admin — nem o Links fixo)
  const podeExcluir = b.tipo !== "padrao" && b.id !== "links";
  topo.appendChild(botaoIcone("Excluir", "trash", () => {
    if (!window.confirm("Excluir o botão \"" + (b.rotulo || "") + "\"?")) return;
    excluirBotao(b.id);
  }, !podeExcluir));

  wrap.appendChild(topo);

  // Formulário de edição (oculto por padrão)
  const form = document.createElement("div");
  form.className = "admin-form oculto";

  // Rótulo
  form.appendChild(campoTexto("Rótulo (nome do botão)", b.rotulo || "", (v) => {
    b.rotulo = v.slice(0, 40);
    salvarCfgUi();
    nome.textContent = b.rotulo || "(sem nome)";
  }));

  // Ícone
  form.appendChild(campoSelect("Ícone", ICONES_DISP, b.icone || "check", (v) => {
    b.icone = v;
    salvarCfgUi();
    ico.innerHTML = '<use href="#i-' + esc(v) + '"/>';
  }));

  // Ação (só para tipo padrao; link/menu têm tratamento próprio)
  if (b.tipo === "padrao") {
    const nomes = Object.keys(ACOES).filter((k) => k !== "abrir-url");
    const rotulos = nomes.map((k) => ACOES[k].nome);
    form.appendChild(campoSelect("Função do botão", rotulos, ACOES[b.acao] ? ACOES[b.acao].nome : "", (rotuloEscolhido) => {
      const k = nomes.find((kk) => ACOES[kk].nome === rotuloEscolhido);
      if (k) { b.acao = k; salvarCfgUi(); }
    }, rotulos.indexOf(ACOES[b.acao] ? ACOES[b.acao].nome : "") >= 0
      ? ACOES[b.acao].nome : rotulos[0]));
  }

  // URL (para botões tipo link)
  if (b.tipo === "link") {
    form.appendChild(campoTexto("Link (https://…)", b.url || "", (v) => {
      b.url = v.slice(0, 500);
      salvarCfgUi();
    }, "url"));
  }

  // Itens do submenu (para tipo menu) — inclui o Links fixo
  if (b.tipo === "menu") {
    const rotItens = document.createElement("label");
    rotItens.textContent = "Itens do submenu (nome + link)";
    form.appendChild(rotItens);
    const boxItens = document.createElement("div");
    form.appendChild(boxItens);

    const pintarItens = () => {
      boxItens.textContent = "";
      (b.itens || []).forEach((it, i) => {
        const linha = document.createElement("div");
        linha.className = "admin-item-link";
        const inpNome = document.createElement("input");
        inpNome.type = "text";
        inpNome.placeholder = "Nome";
        inpNome.value = it.nome || "";
        inpNome.addEventListener("change", () => { it.nome = inpNome.value.slice(0, 40); salvarCfgUi(); });
        const inpUrl = document.createElement("input");
        inpUrl.type = "text";
        inpUrl.className = "admin-inp-url";
        inpUrl.placeholder = "https://…";
        inpUrl.value = it.url || "";
        inpUrl.addEventListener("change", () => { it.url = inpUrl.value.slice(0, 500); salvarCfgUi(); });
        const btnCima = botaoIcone("Subir item", "cima", () => {
          if (i === 0) return;
          const t = b.itens[i - 1]; b.itens[i - 1] = b.itens[i]; b.itens[i] = t;
          salvarCfgUi(); pintarItens();
        }, i === 0);
        const btnBaixo = botaoIcone("Descer item", "baixo", () => {
          if (i >= b.itens.length - 1) return;
          const t = b.itens[i + 1]; b.itens[i + 1] = b.itens[i]; b.itens[i] = t;
          salvarCfgUi(); pintarItens();
        }, i >= b.itens.length - 1);
        const btnDel = botaoIcone("Excluir item", "trash", () => {
          b.itens.splice(i, 1);
          salvarCfgUi(); pintarItens();
        });
        linha.appendChild(inpNome);
        linha.appendChild(inpUrl);
        linha.appendChild(btnCima);
        linha.appendChild(btnBaixo);
        linha.appendChild(btnDel);
        boxItens.appendChild(linha);
      });
    };
    pintarItens();

    const btnAddItem = document.createElement("button");
    btnAddItem.type = "button";
    btnAddItem.className = "admin-add-item";
    btnAddItem.innerHTML = svgIco("plus") + " Adicionar item";
    btnAddItem.addEventListener("click", () => {
      b.itens = b.itens || [];
      b.itens.push({ id: idNovo(), nome: "", url: "" });
      salvarCfgUi();
      pintarItens();
    });
    form.appendChild(btnAddItem);
  }

  wrap.appendChild(form);
  return wrap;
}

function campoTexto(rotulo, valor, onchange, tipo) {
  const wrap = document.createElement("div");
  wrap.className = "admin-campo";
  const lbl = document.createElement("label");
  lbl.textContent = rotulo;
  const inp = document.createElement("input");
  inp.type = tipo === "url" ? "url" : "text";
  inp.value = valor;
  inp.addEventListener("change", () => onchange(inp.value));
  wrap.appendChild(lbl);
  wrap.appendChild(inp);
  return wrap;
}

function campoSelect(rotulo, opcoes, valorAtual, onchange, valorSelect) {
  const wrap = document.createElement("div");
  wrap.className = "admin-campo";
  const lbl = document.createElement("label");
  lbl.textContent = rotulo;
  const sel = document.createElement("select");
  opcoes.forEach((op) => {
    const o = document.createElement("option");
    o.value = op;
    o.textContent = op;
    sel.appendChild(o);
  });
  sel.value = valorSelect != null ? valorSelect : valorAtual;
  sel.addEventListener("change", () => onchange(sel.value));
  wrap.appendChild(lbl);
  wrap.appendChild(sel);
  return wrap;
}

// ==========================================
// BOOT — carrega config dos botões e renderiza a tela principal
// ==========================================
chrome.storage.local.get([UI_CUSTOM_KEY], (res) => {
  cfgUi = normalizarCfgUi(res[UI_CUSTOM_KEY]);
  renderizarPrincipal();
});
