// Chat onde os botões "prox" e ✅ enviam as mensagens (Rocket.Chat da Oquei)
const CHAT_URL_PATTERN = "https://chat.oquei.com.br/*";
// Nome EXATAMENTE como aparece na barra lateral do chat (grupo, canal ou DM).
// Para testar com uma DM, troque só o texto abaixo e recarregue a extensão.
const GRUPO_CHAT = "rodizio_ligacoes_callcenter_tarde";

async function runFlow(grupo, msg, tag) {
  grupo = grupo || GRUPO_CHAT;
  const tabs = await chrome.tabs.query({ url: CHAT_URL_PATTERN });
  if (!tabs.length) {
    console.error("[" + tag + "] chat.oquei.com.br não está aberto em nenhuma aba");
    return { ok: false, error: "Abra o chat.oquei.com.br em uma aba." };
  }
  // Prefere a aba que está ativa na janela atual; senão, a primeira encontrada.
  const tab = tabs.find((t) => t.active) || tabs[0];
  // Não troca de aba nem foca a janela: o envio roda na aba do chat
  // mesmo que o usuário continue em outra aba/janela.
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: sendChatMessage,
      args: [grupo, msg, tag]
    });
  } catch (e) {
    console.error("[" + tag + "] erro ao injetar:", e);
    return { ok: false, error: "Não foi possível rodar na aba do chat (" + e.message + ")." };
  }
  return { ok: true };
}

// Esta função é injetada na página do chat (mundo MAIN): abre a conversa
// pelo nome na barra lateral, escreve a mensagem e envia.
function sendChatMessage(GRUPO, MSG, TAG) {
  try {
    var key = "__chatEnviadoEm_" + TAG;
    if (window[key] && Date.now() - window[key] < 5000) {
      console.warn("[" + TAG + "] Enviado ha menos de 5s, ignorando.");
      return;
    }

    var norm = function (s) { return (s || "").trim().toLowerCase(); };
    var alvo = norm(GRUPO);

    var fire = function (el, type) {
      var r = el.getBoundingClientRect();
      var Ev = type.indexOf("pointer") === 0 ? PointerEvent : MouseEvent;
      el.dispatchEvent(new Ev(type, {
        bubbles: true, cancelable: true, composed: true, view: window,
        pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0,
        buttons: (type === "pointerup" || type === "mouseup") ? 0 : 1,
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
      }));
    };

    var esperar = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

    var caminhoAtual = function () {
      var path = "";
      try { path = decodeURIComponent(location.pathname).toLowerCase(); } catch (e) { path = location.pathname.toLowerCase(); }
      return path;
    };

    // Grupo/canal: a URL termina com /channel/<nome> ou /group/<nome>.
    // (Em DM a URL usa o usuário, ex: /direct/fulano, então isso não se aplica.)
    var urlEhDoAlvo = function () {
      var partes = caminhoAtual().split("/").filter(Boolean);
      return partes.length >= 2 && partes[partes.length - 1] === alvo;
    };

    var tituloDoCabecalho = function () {
      var h = document.querySelector("main header") || document.querySelector("header");
      return h ? norm(h.textContent) : "";
    };

    var achaItemSidebar = function () {
      var titulos = [].slice.call(document.querySelectorAll('[data-qa="sidebar-item-title"]'));
      var t = titulos.find(function (el) { return norm(el.textContent) === alvo; });
      if (!t) return null;
      return t.closest("a") || t.closest('[data-qa="sidebar-item"]') || t.closest('[role="listitem"]') || t;
    };

    // Abre a conversa clicando no item da barra lateral (funciona para grupo,
    // canal e DM) e confirma que abriu: a URL mudou, ou é a do alvo, ou o
    // cabeçalho da conversa mostra o nome procurado.
    var abrirConversa = function () {
      return new Promise(function (resolve, reject) {
        if (urlEhDoAlvo()) { resolve(); return; }
        var t0 = Date.now();
        var caminhoInicial = caminhoAtual();
        var clicou = false;
        var check = function () {
          if (clicou && (urlEhDoAlvo() || caminhoAtual() !== caminhoInicial || tituloDoCabecalho().indexOf(alvo) !== -1)) {
            resolve();
            return;
          }
          if (!clicou) {
            var item = achaItemSidebar();
            if (item) {
              clicou = true;
              ["pointerover", "mouseover", "pointerdown", "mousedown", "pointerup", "mouseup", "click"]
                .forEach(function (t) { fire(item, t); });
              if (item.click) item.click();
            }
          }
          if (Date.now() - t0 > 12000) {
            var lista = [].slice.call(document.querySelectorAll('[data-qa="sidebar-item-title"]'))
              .map(function (s) { return s.textContent; });
            console.log("[" + TAG + "] Conversas visiveis:", lista);
            reject(clicou ? "nao consegui confirmar que a conversa abriu: " + GRUPO
                          : "conversa nao encontrada na barra lateral: " + GRUPO);
          } else {
            setTimeout(check, 300);
          }
        };
        check();
      });
    };

    var SELETORES_CAIXA = [
      "textarea.rc-message-box__textarea",
      'textarea[name="msg"]',
      ".rc-message-box textarea",
      "footer textarea",
      "textarea"
    ];

    var achaCaixa = function () {
      for (var i = 0; i < SELETORES_CAIXA.length; i++) {
        var lista = [].slice.call(document.querySelectorAll(SELETORES_CAIXA[i]));
        // ignora o campo de resposta em thread, se existir
        var box = lista.find(function (el) { return el.offsetParent !== null && !el.closest(".rcx-vertical-bar, [data-qa-id='thread']"); });
        if (box) return box;
      }
      return null;
    };

    var esperaCaixa = function () {
      return new Promise(function (resolve, reject) {
        var t0 = Date.now();
        var check = function () {
          var box = achaCaixa();
          if (box) { box.focus(); resolve(box); }
          else if (Date.now() - t0 > 8000) { reject("campo de mensagem nao apareceu"); }
          else { setTimeout(check, 200); }
        };
        check();
      });
    };

    var achaBotaoEnviar = function (box) {
      var raiz = box.closest(".rc-message-box, footer, form") || document;
      return raiz.querySelector(".js-send, button.rc-message-box__icon.js-send") ||
        raiz.querySelector('button[aria-label="Send"], button[aria-label="Enviar"], button[title="Send"], button[title="Enviar"]') ||
        raiz.querySelector('[data-qa-id="send"], [data-qa="message-composer-send"]');
    };

    var apertaEnter = function (box) {
      box.focus();
      ["keydown", "keypress", "keyup"].forEach(function (t) {
        box.dispatchEvent(new KeyboardEvent(t, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      });
    };

    var enviar = function () {
      return esperaCaixa().then(function (box) {
        // setter nativo: faz o React do Rocket.Chat perceber o novo valor
        var setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(box, MSG);
        box.dispatchEvent(new Event("input", { bubbles: true }));

        return esperar(350).then(function () {
          var btn = achaBotaoEnviar(box);
          var how;
          if (btn) {
            ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach(function (t) { fire(btn, t); });
            btn.click();
            how = "clique no botao enviar";
          } else {
            apertaEnter(box);
            how = "Enter";
          }
          return esperar(900).then(function () {
            // Se o texto ainda está lá, o envio não aconteceu: tenta Enter.
            var atual = achaCaixa();
            if (atual && atual.value && atual.value.indexOf(MSG) !== -1 && how !== "Enter") {
              apertaEnter(atual);
              how += " + Enter";
            }
            return how;
          });
        });
      });
    };

    console.log("[" + TAG + "] Iniciando. Conversa alvo: " + GRUPO);
    window[key] = Date.now();

    abrirConversa()
      .then(function () { return esperar(500); })
      .then(enviar)
      .then(function (m) { console.log("[" + TAG + "] OK: mensagem enviada (" + m + ")"); })
      .catch(function (e) {
        window[key] = 0;
        console.error("[" + TAG + "] Falha:", e);
      });

  } catch (e) {
    console.error("[" + TAG + "] Erro:", e);
  }
}

async function runQuickReplyMenu() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    console.error("[quickreply] Nenhuma aba ativa encontrada");
    return { ok: false, error: "Nenhuma aba ativa encontrada." };
  }
  // Só faz sentido no WhatsApp Web — evita injetar o painel em qualquer página.
  if (!tab.url || !tab.url.startsWith("https://web.whatsapp.com/")) {
    return { ok: false, error: "Abra o WhatsApp Web (web.whatsapp.com) para usar as mensagens rápidas." };
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["quickreply.js"],
      world: "MAIN"
    });
  } catch (e) {
    console.error("[quickreply] erro ao injetar:", e);
    return { ok: false, error: "Não foi possível rodar nesta aba (" + e.message + ")." };
  }
  return { ok: true };
}

// A configuração do roteador só faz sentido na interface do aparelho, que fica
// na rede local (192.168.x.x, 10.x.x.x etc.). Não injeta em qualquer site.
function ehPaginaDeRoteador(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname;
    return h === "localhost" ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h) ||
      /^169\.254\.\d{1,3}\.\d{1,3}$/.test(h);
  } catch (e) {
    return false;
  }
}

async function runHuaweiConfig() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    console.error("[huawei] Nenhuma aba ativa encontrada");
    return { ok: false, error: "Nenhuma aba ativa encontrada." };
  }
  if (!tab.url || !ehPaginaDeRoteador(tab.url)) {
    return { ok: false, error: "Abra a página do roteador (ex.: 192.168.100.1) e tente novamente." };
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["huaweiconfig.js"],
      world: "MAIN"
    });
  } catch (e) {
    console.error("[huawei] erro ao injetar:", e);
    return { ok: false, error: "Não foi possível rodar nesta aba (" + e.message + ")." };
  }
  return { ok: true };
}

// Atalhos de teclado: Alt+P envia "prox", Alt+L envia ✅ e Alt+X abre/fecha
// a barra lateral dentro da página ativa
chrome.commands.onCommand.addListener((command) => {
  if (command === "send-prox") {
    runFlow(GRUPO_CHAT, "prox", "prox");
  } else if (command === "send-check") {
    runFlow(GRUPO_CHAT, "\u2705", "check");
  } else if (command === "abrir-barra-lateral") {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (!tabs.length) return;
        // A barra lateral (content script) escuta essa mensagem e alterna
        chrome.tabs.sendMessage(tabs[0].id, { type: "toggleBarraLateral" })
          .catch(() => { /* a página ativa não tem a barra (site não permitido) */ });
      });
  }
});

// Mensagens vindas do popup (os 2 botões)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "runFlow") {
    runFlow(message.grupo, message.msg, message.tag).then(sendResponse);
    return true; // resposta assíncrona
  }
  if (message && message.type === "runQuickReplyMenu") {
    runQuickReplyMenu().then(sendResponse);
    return true; // resposta assíncrona
  }
  if (message && message.type === "runHuaweiConfig") {
    runHuaweiConfig().then(sendResponse);
    return true; // resposta assíncrona
  }
  if (message && message.type === "salvarSiteSnippets") {
    salvarSiteSnippets(message.origem).then(sendResponse);
    return true;
  }
  if (message && message.type === "removerSiteSnippets") {
    removerSiteSnippets(message.origem).then(sendResponse);
    return true;
  }
  if (message && message.type === "runRelatos") {
    runRelatosNaAba(sender.tab && sender.tab.id).then(sendResponse);
    return true;
  }
  if (message && message.type === "abrirSnippets") {
    chrome.tabs.create({ url: chrome.runtime.getURL("snippets.html") });
    sendResponse({ ok: true });
    return false;
  }
  if (message && message.type === "abrirLink") {
    // Whitelist: só os links oficiais da ferramenta podem ser abertos
    const LINKS_PERMITIDOS = [
      "https://oquei-decodificar.lovable.app/",
      "https://docs.google.com/spreadsheets/d/1r7gK3W7Q5K-5r6qd-3sj5lklAxlcHnM7EArm-D_3Jwk/edit?pli=1&gid=1858272844#gid=1858272844",
      "https://docs.google.com/spreadsheets/d/1hdpzDmJ8u1q-0JxcqQIhHcdPtNGa05IfEm-BFl3v3_k/edit?gid=0#gid=0",
      "https://docs.google.com/document/d/1eYtQZxso1gCsfOMilhDBHvlo2P8HBy0iTmlATlNYgRM/edit?tab=t.0"
    ];
    if (LINKS_PERMITIDOS.indexOf(message.url) === -1) {
      sendResponse({ ok: false, error: "Link não permitido." });
      return false;
    }
    chrome.tabs.create({ url: message.url });
    sendResponse({ ok: true });
    return false;
  }
  if (message && message.type === "setModoAcesso") {
    // Grava o padrão preservando as regras por site; os content scripts
    // (flutuante e barra) reagem na hora via storage
    const modo = ["flutuante", "lateral", "ambos"].indexOf(message.modo) !== -1
      ? message.modo : "flutuante";
    chrome.storage.local.get([CONFIG_MODOS_KEY, MODO_ACESSO_KEY])
      .then((res) => {
        const cfg = res[CONFIG_MODOS_KEY] && typeof res[CONFIG_MODOS_KEY] === "object"
          ? res[CONFIG_MODOS_KEY]
          : { padrao: res[MODO_ACESSO_KEY] === "lateral" ? "lateral" : "flutuante", porSite: {} };
        cfg.padrao = modo;
        if (!cfg.porSite || typeof cfg.porSite !== "object") cfg.porSite = {};
        return chrome.storage.local.set({
          [CONFIG_MODOS_KEY]: { padrao: cfg.padrao, porSite: cfg.porSite },
          [MODO_ACESSO_KEY]: modo === "lateral" ? "lateral" : "flutuante"
        });
      })
      .then(() => sendResponse({ ok: true, modo }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message && message.type === "carregarAcoes") {
    // Auto-recuperação: quando o content script detecta que
    // ferramentas-comuns.js não rodou (ex.: extensão com manifesto antigo
    // em cache), pede a injeção direta no mesmo frame/world dele
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null) {
      sendResponse({ ok: false, error: "Aba não encontrada." });
      return false;
    }
    const alvo = { tabId };
    if (typeof sender.frameId === "number") alvo.frameIds = [sender.frameId];
    chrome.scripting.executeScript({ target: alvo, files: ["ferramentas-comuns.js"] })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

// ==========================================
// FORMA DE ACESSO (flutuante x barra lateral x ambos)
// ==========================================
// Config: { padrao: "flutuante"|"lateral"|"ambos", porSite: { "<origem>": "..." } }
// Cada site pode ter regra própria; sem regra, vale o padrão.
const MODO_ACESSO_KEY = "ccTools_modoAcesso"; // legado (global antigo)
const CONFIG_MODOS_KEY = "ccTools_configModos";

// Migra o modo global antigo para a config nova (uma vez)
async function migrarConfigModos() {
  const res = await chrome.storage.local.get([CONFIG_MODOS_KEY, MODO_ACESSO_KEY]);
  if (res[CONFIG_MODOS_KEY] && typeof res[CONFIG_MODOS_KEY] === "object") return;
  const padrao = res[MODO_ACESSO_KEY] === "lateral" ? "lateral" : "flutuante";
  await chrome.storage.local.set({ [CONFIG_MODOS_KEY]: { padrao, porSite: {} } });
}

// Injeta o painel de relatos na aba de quem pediu (botão flutuante / barra)
async function runRelatosNaAba(tabId) {
  if (tabId == null) return { ok: false, error: "Aba não encontrada." };
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      files: ["relatos.js"]
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Não foi possível abrir os relatos nesta aba (" + e.message + ")." };
  }
}

// ==========================================
// SITES ONDE OS SNIPPETS ESTÃO LIBERADOS
// ==========================================
// O manifest já injeta os snippets nos sites padrão (WhatsApp Web, chat,
// elleven e oquei.sz.chat). Qualquer site EXTRA é liberado pelo usuário pelo
// botão na popup ("Permitir snippets neste site"), que pede a permissão e
// chama os handlers daqui. Os sites extras viram content scripts DINÂMICOS,
// que só rodam onde há permissão concedida.
const SITES_SNIPPETS_KEY = "ccTools_sitesPermitidos";
const CS_DINAMICO_PREFIXO = "ccTools-snippets-";

function normalizarOrigemSite(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch (e) {
    return null;
  }
}

async function sincronizarScriptsSnippetsDinamicos() {
  try {
    const cfg = await chrome.storage.local.get([SITES_SNIPPETS_KEY]);
    const sites = Array.isArray(cfg[SITES_SNIPPETS_KEY]) ? cfg[SITES_SNIPPETS_KEY] : [];
    const registrados = await chrome.scripting.getRegisteredContentScripts();
    const jaRegistrados = new Set(registrados.map((s) => s.id));

    // Desregistra os que saíram da lista ou perderam a permissão de host.
    const paraRemover = [];
    for (const s of registrados) {
      if (!s.id.startsWith(CS_DINAMICO_PREFIXO)) continue;
      const origem = s.id.slice(CS_DINAMICO_PREFIXO.length);
      const podeManter = sites.indexOf(origem) !== -1 &&
        (await chrome.permissions.contains({ origins: [origem + "/*"] }));
      if (!podeManter) paraRemover.push(s.id);
    }
    if (paraRemover.length) {
      await chrome.scripting.unregisterContentScripts({ ids: paraRemover });
    }

    // Registra os que faltam (só com permissão de host concedida).
    for (const origem of sites) {
      if (jaRegistrados.has(CS_DINAMICO_PREFIXO + origem)) continue;
      const temPermissao = await chrome.permissions.contains({ origins: [origem + "/*"] });
      if (!temPermissao) continue;
      try {
        await chrome.scripting.registerContentScripts([{
          id: CS_DINAMICO_PREFIXO + origem,
          js: ["ferramentas-comuns.js", "snippets-content.js", "botao-flutuante.js", "barra-lateral.js"],
          css: ["botao-flutuante.css", "barra-lateral.css"],
          matches: [origem + "/*"],
          runAt: "document_idle",
          allFrames: true,
          matchAboutBlank: true,
          matchOriginAsFallback: true,
          persistAcrossSessions: true
        }]);
      } catch (e) {
        console.warn("[snippets] falha ao registrar script para", origem, "-", e.message);
      }
    }
  } catch (e) {
    console.warn("[snippets] erro ao sincronizar scripts dinâmicos:", e);
  }
}

async function salvarSiteSnippets(url) {
  const origem = normalizarOrigemSite(url);
  if (!origem) return { ok: false, error: "Endereço inválido." };
  const cfg = await chrome.storage.local.get([SITES_SNIPPETS_KEY]);
  const sites = Array.isArray(cfg[SITES_SNIPPETS_KEY]) ? cfg[SITES_SNIPPETS_KEY] : [];
  if (sites.indexOf(origem) === -1) {
    sites.push(origem);
    await chrome.storage.local.set({ [SITES_SNIPPETS_KEY]: sites });
  }
  await sincronizarScriptsSnippetsDinamicos();
  return { ok: true, origem };
}

async function removerSiteSnippets(url) {
  const origem = normalizarOrigemSite(url);
  if (!origem) return { ok: false, error: "Endereço inválido." };
  const cfg = await chrome.storage.local.get([SITES_SNIPPETS_KEY]);
  const sites = Array.isArray(cfg[SITES_SNIPPETS_KEY]) ? cfg[SITES_SNIPPETS_KEY] : [];
  const novos = sites.filter((s) => s !== origem);
  if (novos.length !== sites.length) {
    await chrome.storage.local.set({ [SITES_SNIPPETS_KEY]: novos });
  }
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [CS_DINAMICO_PREFIXO + origem] });
  } catch (e) { /* pode não estar registrado */ }
  try {
    await chrome.permissions.remove({ origins: [origem + "/*"] });
  } catch (e) { /* permissão pode já ter sido revogada */ }
  return { ok: true, origem };
}

// ==========================================
// SNIPPETS PADRÃO (embutidos na extensão)
// ==========================================
// A lista padrão vem no próprio pacote (assets/snippets-padrao.json). Na
// instalação/atualização ela é mesclada com o que o usuário já tem, SEM mexer
// nos snippets criados/editados por ele:
//   - snippet padrão (padrao:true) e intocado  -> é atualizado conforme o arquivo
//   - snippet criado ou editado pelo usuário    -> nunca é alterado
//   - snippet padrão que o usuário apagou       -> não volta (fica em IGNORADOS)
// Nenhum dado ou código é baixado da internet.
const SNIPPETS_STORAGE_KEY = "ccTools_snippets";
const PADRAO_IGNORADOS_KEY = "ccTools_padrao_ignorados";
const PADRAO_MIGRADO_KEY = "ccTools_padrao_migrado";
const PADRAO_STATUS_KEY = "ccTools_padrao_status";

function gerarIdSnippet() {
  return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function normalizarAtalhoPadrao(v) {
  v = (v || "").toString().trim().replace(/\s+/g, "");
  if (!v) return "";
  if (!v.startsWith("/")) v = "/" + v;
  return v.toLowerCase();
}

// Valida e normaliza a lista vinda do JSON (ignora itens inválidos e atalhos repetidos)
function normalizarListaPadrao(dados) {
  if (!Array.isArray(dados)) throw new Error("O JSON precisa ser uma lista de snippets.");
  const vistos = new Set();
  const lista = [];
  dados.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const atalho = normalizarAtalhoPadrao(item.atalho);
    if (!atalho || vistos.has(atalho)) return;
    vistos.add(atalho);
    lista.push({
      atalho,
      titulo: (item.titulo || "").toString().trim(),
      conteudo: (item.conteudo || "").toString(),
      audio: typeof item.audio === "string" ? item.audio : null
    });
  });
  if (!lista.length) throw new Error("Nenhum snippet válido no JSON.");
  return lista;
}

async function lerListaPadraoEmbutida() {
  const resp = await fetch(chrome.runtime.getURL("assets/snippets-padrao.json"));
  return normalizarListaPadrao(await resp.json());
}

// Instalações antigas guardaram a lista padrão sem a marca "padrao". Aqui
// marcamos como padrão só o que ainda é IDÊNTICO ao arquivo embutido; o que o
// usuário já alterou continua sendo dele.
async function migrarSnippetsAntigos(lista) {
  const flag = await chrome.storage.local.get([PADRAO_MIGRADO_KEY]);
  if (flag[PADRAO_MIGRADO_KEY]) return lista;
  try {
    const embutida = await lerListaPadraoEmbutida();
    const porAtalho = new Map(embutida.map((p) => [p.atalho, p]));
    lista.forEach((s) => {
      if (s.padrao !== undefined) return;
      const p = porAtalho.get(s.atalho);
      const igual = p && (s.titulo || "") === p.titulo && (s.conteudo || "") === p.conteudo && !s.audio;
      s.padrao = !!igual;
    });
  } catch (e) {
    console.warn("[snippets] migração ignorada:", e);
    return lista;
  }
  await chrome.storage.local.set({ [PADRAO_MIGRADO_KEY]: true });
  return lista;
}

let sincronizandoPadrao = null;

function sincronizarSnippetsPadrao(opcoes) {
  if (!sincronizandoPadrao) {
    sincronizandoPadrao = _sincronizarSnippetsPadrao(opcoes || {}).finally(() => { sincronizandoPadrao = null; });
  }
  return sincronizandoPadrao;
}

async function _sincronizarSnippetsPadrao(opcoes) {
  const resultado = { ok: false, adicionados: 0, atualizados: 0, removidos: 0, restaurados: 0 };
  try {
    const cfg = await chrome.storage.local.get([SNIPPETS_STORAGE_KEY, PADRAO_IGNORADOS_KEY]);
    let lista = Array.isArray(cfg[SNIPPETS_STORAGE_KEY]) ? cfg[SNIPPETS_STORAGE_KEY].slice() : [];
    let ignorados = Array.isArray(cfg[PADRAO_IGNORADOS_KEY]) ? cfg[PADRAO_IGNORADOS_KEY].slice() : [];

    // 1) Lê a lista padrão que vem embutida na extensão
    const remoto = await lerListaPadraoEmbutida();

    // 2) Marca os snippets antigos que ainda são o padrão original
    lista = await migrarSnippetsAntigos(lista);

    if (opcoes.restaurarApagados) {
      resultado.restaurados = ignorados.length;
      ignorados = [];
    }

    const ignoradosSet = new Set(ignorados);
    const remotoMap = new Map(remoto.map((r) => [r.atalho, r]));

    // 3) Remove padrões que saíram do arquivo embutido (só os que são padrão e não foram editados)
    const antes = lista.length;
    lista = lista.filter((s) => s.padrao !== true || remotoMap.has(s.atalho));
    resultado.removidos = antes - lista.length;

    // 4) Atualiza padrões existentes
    lista.forEach((s) => {
      if (s.padrao !== true) return;
      const r = remotoMap.get(s.atalho);
      const audio = r.audio !== null ? r.audio : (s.audio || "");
      if ((s.titulo || "") !== r.titulo || (s.conteudo || "") !== r.conteudo || (s.audio || "") !== audio) {
        s.titulo = r.titulo;
        s.conteudo = r.conteudo;
        s.audio = audio;
        resultado.atualizados++;
      }
    });

    // 5) Adiciona padrões novos (pula os apagados pelo usuário e atalhos que o usuário já usa)
    const atalhosEmUso = new Set(lista.map((s) => s.atalho));
    remoto.forEach((r) => {
      if (ignoradosSet.has(r.atalho) || atalhosEmUso.has(r.atalho)) return;
      lista.push({
        id: gerarIdSnippet(),
        atalho: r.atalho,
        titulo: r.titulo,
        conteudo: r.conteudo,
        audio: r.audio || "",
        padrao: true
      });
      resultado.adicionados++;
    });

    // 6) Limpa da lista de ignorados o que não existe mais no arquivo padrão
    ignorados = ignorados.filter((a) => remotoMap.has(a));

    const mudou = resultado.adicionados || resultado.atualizados || resultado.removidos;
    const dados = {
      [PADRAO_IGNORADOS_KEY]: ignorados,
      [PADRAO_STATUS_KEY]: { ok: true, quando: Date.now(), total: remoto.length }
    };
    if (mudou) dados[SNIPPETS_STORAGE_KEY] = lista;
    await chrome.storage.local.set(dados);

    resultado.ok = true;
    console.log("[snippets] lista padrão aplicada:", resultado);
  } catch (e) {
    console.error("[snippets] erro ao sincronizar lista padrão:", e);
    resultado.erro = e.message || String(e);
    try {
      const antigo = (await chrome.storage.local.get([PADRAO_STATUS_KEY]))[PADRAO_STATUS_KEY] || {};
      await chrome.storage.local.set({
        [PADRAO_STATUS_KEY]: { ok: false, quando: Date.now(), ultimoSucesso: antigo.ultimoSucesso || (antigo.ok ? antigo.quando : null), erro: resultado.erro }
      });
    } catch (_) { /* ignora */ }
  }
  return resultado;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "syncSnippetsPadrao") {
    sincronizarSnippetsPadrao({ restaurarApagados: !!message.restaurarApagados }).then(sendResponse);
    return true;
  }
});

chrome.runtime.onStartup.addListener(() => {
  sincronizarSnippetsPadrao();
  sincronizarScriptsSnippetsDinamicos();
  migrarConfigModos();
});

// ==========================================
// ÁUDIO DOS SNIPPETS (tocado via documento offscreen)
// ==========================================
const VOLUME_STORAGE_KEY = "ccTools_volume";
const VOLUME_PADRAO = 70;
let criandoOffscreen = null;

async function garantirOffscreen() {
  const existentes = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (existentes.length) return;
  if (!criandoOffscreen) {
    criandoOffscreen = chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Tocar o áudio configurado no snippet."
    }).finally(() => { criandoOffscreen = null; });
  }
  await criandoOffscreen;
}

async function tocarAudioSnippet(arquivo) {
  // aceita só nome de arquivo simples (sem pastas) dentro de assets/
  if (!arquivo || !/^[\w\-. ]+\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(arquivo)) {
    return { ok: false, error: "Nome de áudio inválido." };
  }
  try {
    const cfg = await chrome.storage.local.get([VOLUME_STORAGE_KEY]);
    const vol = typeof cfg[VOLUME_STORAGE_KEY] === "number" ? cfg[VOLUME_STORAGE_KEY] : VOLUME_PADRAO;
    await garantirOffscreen();
    const msg = {
      target: "offscreen",
      type: "play",
      url: chrome.runtime.getURL("assets/" + encodeURIComponent(arquivo)),
      volume: vol / 100
    };
    try {
      await chrome.runtime.sendMessage(msg);
    } catch (e) {
      await new Promise((r) => setTimeout(r, 200));
      await chrome.runtime.sendMessage(msg);
    }
    return { ok: true };
  } catch (e) {
    console.error("[audio] erro ao tocar:", e);
    return { ok: false, error: e.message };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "playSnippetAudio") {
    tocarAudioSnippet(message.audio).then(sendResponse);
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  sincronizarSnippetsPadrao();
  sincronizarScriptsSnippetsDinamicos();
  migrarConfigModos();
});
