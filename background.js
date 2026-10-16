// Chat onde o botão ✅ envia a mensagem (Rocket.Chat da Oquei)
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
  // Relay do som de confirmação: o envio roda no MAIN world e avisa o
  // isolated world via evento quando a mensagem sai de fato.
  await injetarRelayNotificacao(tab.id);
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
            console.log("[" + TAG + "] Conversas visiveis:", lista.length + " conversa(s)");
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

    console.log("[" + TAG + "] Iniciando envio na conversa alvo.");
    window[key] = Date.now();

    abrirConversa()
      .then(function () { return esperar(500); })
      .then(enviar)
      .then(function (m) {
        console.log("[" + TAG + "] OK: mensagem enviada (" + m + ")");
        // Som de confirmação: o relay no isolated world toca no volume do popup
        window.dispatchEvent(new CustomEvent("cc-notificacao-sucesso"));
      })
      .catch(function (e) {
        window[key] = 0;
        console.error("[" + TAG + "] Falha:", e);
      });

  } catch (e) {
    console.error("[" + TAG + "] Erro:", e);
  }
}

// Espera uma aba terminar de carregar (+ atraso extra, para o app do
// WhatsApp terminar de montar a interface antes da injeção).
function aguardarCarregarAba(tabId, extrasMs) {
  return new Promise((resolve) => {
    const finalizar = () => setTimeout(resolve, extrasMs || 0);
    chrome.tabs.get(tabId, (t) => {
      if (chrome.runtime.lastError || !t) { resolve(); return; }
      if (t.status === "complete") { finalizar(); return; }
      const listener = (id, info) => {
        if (id === tabId && info.status === "complete") {
          chrome.tabs.onChanged.removeListener(listener);
          clearTimeout(guarda);
          finalizar();
        }
      };
      const guarda = setTimeout(() => {
        chrome.tabs.onChanged.removeListener(listener);
        resolve();
      }, 25000);
      chrome.tabs.onChanged.addListener(listener);
    });
  });
}

// Mensagens rápidas: o painel abre na ABA ATIVA (qualquer site). A extensão
// NÃO cria nem foca aba do WhatsApp Web — ela só usa a aba que a pessoa já
// estiver usando no momento.
async function runQuickReplyMenu() {
  const abas = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = abas && abas[0];
  if (!tab || !tab.id) {
    return { ok: false, error: "Abra uma aba primeiro — o painel abre na aba que você estiver usando." };
  }
  // Relay do som de confirmação: o painel (MAIN world) dispara o evento
  // quando a mensagem é colada com sucesso no chat.
  try { await injetarRelayNotificacao(tab.id); } catch (e) { /* relay é opcional */ }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["quickreply.js"],
      world: "MAIN"
    });
  } catch (e) {
    console.error("[quickreply] erro ao injetar:", e);
    return { ok: false, error: "Não foi possível abrir o painel nesta aba (" + e.message + ")." };
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

// Atalhos de teclado: Alt+L envia ✅, Alt+X abre/fecha a barra lateral e
// Alt+P envia o PROX (ou abre a modal de conexão se ainda não estiver pronto)
chrome.commands.onCommand.addListener((command) => {
  if (command === "send-check") {
    runFlow(GRUPO_CHAT, "✅", "check");
  } else if (command === "send-prox") {
    (async () => {
      try {
        const r = await proxAcao();
        if (r.ok) return; // a mensagem aparece no próprio grupo como confirmação
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) await mostrarModalProxNaAba(tab.id);
      } catch (e) {
        console.error("[prox] Alt+P falhou:", e);
      }
    })();
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
  // Relay do som de confirmação: toca quando o relato é inserido no chat.
  await injetarRelayNotificacao(tabId);
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
// UI (botão flutuante + barra lateral) registrada à parte, só no frame
// principal — antigamente vinha junto com os snippets em allFrames e cada
// iframe do site criava o seu próprio botão.
const CS_UI_PREFIXO = "ccTools-ui-";

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

    // Desregistra os que saíram da lista ou perderam a permissão de host
    const paraRemover = [];
    for (const s of registrados) {
      let origem = null;
      if (s.id.startsWith(CS_DINAMICO_PREFIXO)) origem = s.id.slice(CS_DINAMICO_PREFIXO.length);
      else if (s.id.startsWith(CS_UI_PREFIXO)) origem = s.id.slice(CS_UI_PREFIXO.length);
      else continue;
      const podeManter = sites.indexOf(origem) !== -1 &&
        (await chrome.permissions.contains({ origins: [origem + "/*"] }));
      if (!podeManter) paraRemover.push(s.id);
    }
    if (paraRemover.length) {
      await chrome.scripting.unregisterContentScripts({ ids: paraRemover });
    }

    // Registra/atualiza os que faltam (só com permissão de host concedida).
    // As definições são sempre reaplicadas: isso migra registros antigos que
    // ainda injetavam a UI em todos os frames.
    const restantes = await chrome.scripting.getRegisteredContentScripts();
    const idsExistentes = new Set(restantes.map((s) => s.id));
    const paraRegistrar = [];
    const paraAtualizar = [];
    for (const origem of sites) {
      const temPermissao = await chrome.permissions.contains({ origins: [origem + "/*"] });
      if (!temPermissao) continue;
      const defs = [
        {
          id: CS_DINAMICO_PREFIXO + origem,
          js: ["ferramentas-comuns.js", "snippets-content.js"],
          matches: [origem + "/*"],
          runAt: "document_idle",
          allFrames: true,
          matchAboutBlank: true,
          matchOriginAsFallback: true,
          persistAcrossSessions: true
        },
        {
          id: CS_UI_PREFIXO + origem,
          js: ["ferramentas-comuns.js", "botao-flutuante.js", "barra-lateral.js"],
          css: ["botao-flutuante.css", "barra-lateral.css"],
          matches: [origem + "/*"],
          runAt: "document_idle",
          allFrames: false,
          persistAcrossSessions: true
        }
      ];
      for (const def of defs) {
        if (idsExistentes.has(def.id)) paraAtualizar.push(def);
        else paraRegistrar.push(def);
      }
    }
    if (paraRegistrar.length) {
      await chrome.scripting.registerContentScripts(paraRegistrar);
    }
    if (paraAtualizar.length) {
      await chrome.scripting.updateContentScripts(paraAtualizar);
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
// SNIPPETS PADRÃO (GitHub + cópia embutida)
// ==========================================
// A lista padrão é baixada do repositório oficial no GitHub (arquivo
// assets/snippets-padrao.json de Lucasmagista/EXTENSAO-CALL-CENTER). Se a
// internet ou o GitHub estiver indisponível, a cópia embutida no pacote é usada
// como fallback. A mesclagem é SEMPRE local e preserva o que é do usuário:
//   - snippet padrão (padrao:true) e intocado  -> é atualizado conforme o arquivo
//   - snippet criado ou editado pelo usuário    -> nunca é alterado
//   - snippet padrão que o usuário apagou       -> não volta (fica em IGNORADOS)
// Só um arquivo JSON de DADOS é baixado; nenhum código é executado de fora do
// pacote (política de código remoto da Chrome Web Store).
const SNIPPETS_PADRAO_URL = "https://raw.githubusercontent.com/Lucasmagista/EXTENSAO-CALL-CENTER/main/assets/snippets-padrao.json";
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
    if (lista.length >= 400) return; // teto de itens por lista
    if (!item || typeof item !== "object") return;
    const atalho = normalizarAtalhoPadrao(item.atalho);
    if (!atalho || vistos.has(atalho)) return;
    vistos.add(atalho);
    const audio = typeof item.audio === "string" ? item.audio.trim() : "";
    lista.push({
      atalho,
      titulo: (item.titulo || "").toString().trim().slice(0, 200),
      conteudo: (item.conteudo || "").toString().slice(0, 10000),
      // Só nome de arquivo de áudio do pacote — nunca caminho/data URL
      audio: audio && /^[\w\-. ]{1,80}\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(audio) ? audio : null
    });
  });
  if (!lista.length) throw new Error("Nenhum snippet válido no JSON.");
  return lista;
}

async function lerListaPadraoEmbutida() {
  const resp = await fetch(chrome.runtime.getURL("assets/snippets-padrao.json"));
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  return normalizarListaPadrao(await resp.json());
}

// Lista padrão oficial, baixada do GitHub (?t= quebra o cache do CDN)
async function lerListaPadraoRemota() {
  const resp = await fetch(SNIPPETS_PADRAO_URL + "?t=" + Date.now(), { cache: "no-store" });
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  return normalizarListaPadrao(await resp.json());
}

// Tenta a lista remota do GitHub; se falhar, usa a cópia embutida no pacote
async function lerListaPadraoFonte() {
  try {
    return { lista: await lerListaPadraoRemota(), origem: "remoto" };
  } catch (e) {
    console.warn("[snippets] lista remota indisponível, usando a embutida:", e && e.message);
    return { lista: await lerListaPadraoEmbutida(), origem: "embutido" };
  }
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

    // 1) Lê a lista padrão (GitHub; se falhar, a cópia embutida)
    const fonte = await lerListaPadraoFonte();
    const remoto = fonte.lista;
    resultado.origem = fonte.origem;

    // 2) Marca os snippets antigos que ainda são o padrão original
    lista = await migrarSnippetsAntigos(lista);

    if (opcoes.restaurarApagados) {
      resultado.restaurados = ignorados.length;
      ignorados = [];
    }

    const ignoradosSet = new Set(ignorados);
    const remotoMap = new Map(remoto.map((r) => [r.atalho, r]));

    // 3) Remove padrões que saíram do arquivo remoto (nunca mexe em padrões
    //    editados pelo administrador — eles ganharam editadoPorAdmin)
    const antes = lista.length;
    lista = lista.filter((s) => s.padrao !== true || s.editadoPorAdmin === true || remotoMap.has(s.atalho));
    resultado.removidos = antes - lista.length;

    // 4) Atualiza padrões existentes (editadoPorAdmin também fica intocado)
    lista.forEach((s) => {
      if (s.padrao !== true || s.editadoPorAdmin === true) return;
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
      [PADRAO_STATUS_KEY]: { ok: true, quando: Date.now(), total: remoto.length, origem: fonte.origem }
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

// Atualização automática da lista padrão a cada 60 minutos (mesma ação do
// botão "🔄 Atualizar padrão" da tela de snippets).
const ALARME_SYNC_PADRAO = "syncSnippetsPadrao";

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === ALARME_SYNC_PADRAO) sincronizarSnippetsPadrao();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARME_SYNC_PADRAO, { periodInMinutes: 60 });
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
  if (message && message.type === "playNotificacao") {
    tocarNotificacao().then(sendResponse);
    return true;
  }
  if (message && message.type === "enviarSugestao") {
    enviarSugestao(message.payload || message.texto).then(sendResponse);
    return true;
  }
});

// ==========================================
// SOM DE CONFIRMAÇÃO DE COMANDO
// ==========================================
// Tocado quando um comando deu certo ao inserir/enviar mensagem no chat
// (resposta rápida, relato, snippet e fluxo ✅), sempre no volume do slider
// do popup (ccTools_volume). Os painéis que rodam no MAIN world (sem
// chrome.runtime) disparam o evento "cc-notificacao-sucesso" na página;
// quem o traduz para a extensão é o relay registrado por
// injetarRelayNotificacao() — ou pelo próprio snippets-content.js, que usa
// a mesma guarda (todos os content scripts compartilham o isolated world).
async function tocarNotificacao() {
  try {
    const cfg = await chrome.storage.local.get([VOLUME_STORAGE_KEY, "ccTools_somCustom"]);
    const vol = typeof cfg[VOLUME_STORAGE_KEY] === "number" ? cfg[VOLUME_STORAGE_KEY] : VOLUME_PADRAO;
    if (!(vol > 0)) return { ok: true, mudo: true }; // slider em 0 = silêncio
    await garantirOffscreen();
    // Som personalizado (arquivo escolhido pela operadora, data URL local):
    // se houver, toca ele; sem, cai no "ding" sintetizado do padrão.
    const custom = typeof cfg.ccTools_somCustom === "string" && cfg.ccTools_somCustom.startsWith("data:")
      ? cfg.ccTools_somCustom : "";
    const msg = custom
      ? { target: "offscreen", type: "playCustom", audio: custom, volume: vol / 100 }
      : { target: "offscreen", type: "notificacao", volume: vol / 100 };
    try {
      await chrome.runtime.sendMessage(msg);
    } catch (e) {
      await new Promise((r) => setTimeout(r, 200));
      await chrome.runtime.sendMessage(msg);
    }
    return { ok: true };
  } catch (e) {
    console.error("[notificacao] erro ao tocar:", e);
    return { ok: false, error: e.message };
  }
}

// Ouve o evento disparado pelos painéis em MAIN world e repassa ao background.
// Idempotente: a MESMA guarda (window.__ccNotificacaoRelay) é usada pelo
// snippets-content.js, então o som nunca toca em duplica numa aba.
function injetarRelayNotificacao(tabId) {
  if (tabId == null) return Promise.resolve();
  return chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      if (window.__ccNotificacaoRelay) return;
      window.__ccNotificacaoRelay = true;
      window.addEventListener("cc-notificacao-sucesso", () => {
        try {
          if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: "playNotificacao" }).catch(() => {});
          }
        } catch (e) { /* contexto da extensão recarregado no meio da aba */ }
      });
      // Caixa alta (botão "Aa" dos painéis): o painel (MAIN world) pede o
      // estado e alterna; este relay (isolated world) lê/grava no storage.
      const lerCaps = () => new Promise((r) => {
        try {
          chrome.storage.local.get(["ccTools_maiusculas"], (res) => r(!!(res && res.ccTools_maiusculas)));
        } catch (e) { r(false); }
      });
      window.addEventListener("cc-caps-pedir", () => {
        lerCaps().then((on) => window.dispatchEvent(new CustomEvent("cc-caps-estado", { detail: { on: on } })));
      });
      window.addEventListener("cc-caps-alternar", () => {
        lerCaps().then((on) => {
          const novo = !on;
          try { chrome.storage.local.set({ ccTools_maiusculas: novo }); } catch (e) { /* storage indisponível */ }
          window.dispatchEvent(new CustomEvent("cc-caps-estado", { detail: { on: novo } }));
        });
      });
    }
  }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARME_SYNC_PADRAO, { periodInMinutes: 60 });
  sincronizarSnippetsPadrao();
  sincronizarScriptsSnippetsDinamicos();
  migrarConfigModos();
});

// ==========================================
// MODAL "SENHA WI-FI X6" (conteúdo de SENHA WIFI X6.html)
// ==========================================
// Usada pelos três botões "Senha Wi-Fi x6" (popup, botão flutuante e barra
// lateral). O HTML é injetado direto na página (innerHTML), sem iframe: o CSP
// do WhatsApp (frame-src) bloqueia molduras chrome-extension:, mas permite
// <style> com 'unsafe-inline'. O CSS do arquivo é reescrito para valer só
// dentro do container da modal e o JavaScript (senha-wifi-x6.js) roda como
// content script, imune ao CSP da página.
const SENHA_WIFI_ARQUIVO = "SENHA WIFI X6.html";
const SENHA_WIFI_JS = "senha-wifi-x6.js";

// Regras de `body` do arquivo passam a mirar o container da modal (senão
// repaginariam a página inteira) e o <script> inerte é removido — a ligação
// dos eventos vem do content script executado logo depois.
function prepararHtmlSenhaWifi(html) {
  return html
    .replace(/<script[^>]*src=["']senha-wifi-x6\.js["'][^>]*><\/script>\s*/i, "")
    .replace(/<style>([\s\S]*?)<\/style>/gi, (m, css) =>
      "<style>" + css
        .replace(/\bbody\.light\b/g, "#cc-senha-wifi-corpo.light")
        .replace(/\bbody\b/g, "#cc-senha-wifi-corpo") + "</style>");
}

// Injetada via chrome.scripting.executeScript — precisa ser autocontida.
function construirModalSenhaWifi(conteudoHtml) {
  var ID = "cc-senha-wifi-modal";
  var antigo = document.getElementById(ID);
  if (antigo) antigo.parentNode.removeChild(antigo);

  var raiz = document.createElement("div");
  raiz.id = ID;
  raiz.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;" +
    "z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
    "background:rgba(0,0,0,.55);font-family:'Segoe UI',Arial,sans-serif;";

  var cartao = document.createElement("div");
  cartao.style.cssText = "width:min(760px,94vw);height:min(560px,88vh);" +
    "background:#fff;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.45);" +
    "display:flex;flex-direction:column;overflow:hidden;";

  var cabecalho = document.createElement("div");
  cabecalho.style.cssText = "display:flex;align-items:center;justify-content:space-between;" +
    "gap:8px;padding:10px 14px;flex-shrink:0;color:#fff;font-size:14px;font-weight:600;" +
    "background:linear-gradient(135deg,#2d0b4e,#5b21b6);";

  var titulo = document.createElement("span");
  titulo.style.cssText = "display:flex;align-items:center;gap:8px;";
  titulo.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"' +
    ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' +
    ' aria-hidden="true"><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/>' +
    '<path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/></svg>' +
    "<span>Senha Wi-Fi x6</span>";

  var btnFechar = document.createElement("button");
  btnFechar.type = "button";
  btnFechar.setAttribute("aria-label", "Fechar");
  btnFechar.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none"' +
    ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' +
    ' aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  btnFechar.style.cssText = "width:28px;height:28px;border:0;border-radius:6px;" +
    "background:rgba(255,255,255,.15);color:#fff;cursor:pointer;line-height:1;" +
    "display:flex;align-items:center;justify-content:center;";

  var corpo = document.createElement("div");
  corpo.id = "cc-senha-wifi-corpo";
  corpo.style.cssText = "flex:1;overflow:auto;min-height:0;background:#0a1420;";
  corpo.innerHTML = conteudoHtml;

  function aoTeclar(e) {
    if (e.key === "Escape") fechar();
  }
  function fechar() {
    document.removeEventListener("keydown", aoTeclar, true);
    if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
  }
  btnFechar.addEventListener("click", fechar);
  raiz.addEventListener("mousedown", function (e) {
    if (e.target === raiz) fechar(); // clique no fundo escuro
  });
  document.addEventListener("keydown", aoTeclar, true);

  cabecalho.appendChild(titulo);
  cabecalho.appendChild(btnFechar);
  cartao.appendChild(cabecalho);
  cartao.appendChild(corpo);
  raiz.appendChild(cartao);
  (document.body || document.documentElement).appendChild(raiz);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "mostrarModalSenhaWifi") {
    (async () => {
      try {
        const tabId = message.tabId != null ? message.tabId : (sender.tab && sender.tab.id);
        if (tabId == null) return { ok: false, error: "Nenhuma aba ativa encontrada." };
        let html;
        try {
          const resp = await fetch(chrome.runtime.getURL(encodeURIComponent(SENHA_WIFI_ARQUIVO)));
          if (!resp.ok) throw new Error("HTTP " + resp.status);
          html = await resp.text();
        } catch (e) {
          return { ok: false, error: "Arquivo \"" + SENHA_WIFI_ARQUIVO + "\" não encontrado na extensão." };
        }
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: construirModalSenhaWifi,
          args: [prepararHtmlSenhaWifi(html)]
        });
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: [SENHA_WIFI_JS]
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: "Abra o WhatsApp Web ou o chat da empresa para usar esta tela." };
      }
    })().then(sendResponse);
    return true;
  }
});

// ==========================================
// ENVIAR PROX — Evolution API (whatsapp.hubly.software)
// ==========================================
// Botão "Enviar PROX" (popup, botão flutuante, barra lateral e Alt+P): cada
// navegador cria a SUA instância na Evolution API, a operadora escaneia o QR
// com o próprio WhatsApp, escolhe o grupo e o botão passa a mandar o texto
// configurado (padrão "prox") direto no grupo. A API key fica só no
// chrome.storage.local desta extensão — nunca no código do repositório.
const PROX_URL = "https://whatsapp.hubly.software";
const PROX_STORAGE_KEY = "ccTools_prox";
const PROX_ARQUIVO = "PROX MODAL.html";
const PROX_JS = "prox-modal.js";
const PROX_PADRAO_ARQUIVO = "assets/prox-servidor.json";

// Chave/url que vêm embutidas no pacote (arquivo local, fora do git — o
// repositório é público e a chave jamais pode ser versionada). Com esse
// arquivo a operadora instala e já vai direto pro QR, sem digitar nada.
let proxPadraoCache = null;
async function proxCarregarPadrao() {
  if (proxPadraoCache !== null) return proxPadraoCache;
  proxPadraoCache = (async () => {
    try {
      const resp = await fetch(chrome.runtime.getURL(PROX_PADRAO_ARQUIVO));
      if (!resp.ok) return null;
      const dados = await resp.json();
      if (!dados || typeof dados.apikey !== "string" || !dados.apikey.trim()) return null;
      return {
        url: (typeof dados.url === "string" && dados.url.trim()) ? dados.url.trim() : PROX_URL,
        apikey: dados.apikey.trim(),
        // Grupo de suporte no WhatsApp para o botão "Sugestões" da popup
        // (campo opcional do arquivo; vazio = fluxo de copiar/colar).
        grupoSuporte: (typeof dados.grupoSuporte === "string" && dados.grupoSuporte.trim()) ? dados.grupoSuporte.trim() : ""
      };
    } catch (e) {
      return null; // pacote sem o arquivo (ex.: clone do repo) → modal pede a chave
    }
  })();
  return proxPadraoCache;
}

// Lê o que está SALVO no navegador (sem misturar o padrão do pacote)
async function proxLerBruto() {
  const res = await chrome.storage.local.get([PROX_STORAGE_KEY]);
  const cfg = (res[PROX_STORAGE_KEY] && typeof res[PROX_STORAGE_KEY] === "object")
    ? res[PROX_STORAGE_KEY]
    : {};
  let mudou = false;
  if (!cfg.instancia) {
    cfg.instancia = "prox-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
    mudou = true;
  }
  if (typeof cfg.texto !== "string" || !cfg.texto.trim()) cfg.texto = "prox";
  if (!cfg.grupoId) { cfg.grupoId = null; cfg.grupoNome = null; }
  if (mudou) await chrome.storage.local.set({ [PROX_STORAGE_KEY]: cfg });
  return cfg;
}

// Config efetiva: o salvo no navegador + o padrão do pacote quando não há
// chave manual. apikeyManual é só uma sobrescrita do operador.
async function proxCarregarConfig() {
  const cfg = await proxLerBruto();
  const padrao = await proxCarregarPadrao();
  cfg.apikey = cfg.apikeyManual || (padrao && padrao.apikey) || "";
  cfg.url = (padrao && padrao.url) || PROX_URL;
  cfg.temPadrao = !!(padrao && padrao.apikey);
  cfg.temManual = !!cfg.apikeyManual;
  cfg.grupoSuporte = (padrao && padrao.grupoSuporte) || "";
  return cfg;
}

async function proxSalvarConfigLocal(cfg) {
  await chrome.storage.local.set({ [PROX_STORAGE_KEY]: cfg });
}

// Chamada HTTP para a Evolution API (header apikey; timeout configurável
// porque o listado de grupos pode levar ~30s em contas com muitos grupos)
async function proxApi(cfg, caminho, opcoes) {
  opcoes = opcoes || {};
  const headers = { apikey: cfg.apikey };
  if (opcoes.body) headers["Content-Type"] = "application/json";
  const ctrl = new AbortController();
  const guarda = setTimeout(() => ctrl.abort(), opcoes.timeout || 30000);
  try {
    const resp = await fetch((cfg.url || PROX_URL) + caminho, {
      method: opcoes.method || "GET",
      headers,
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
      signal: ctrl.signal
    });
    let data = null;
    try { data = await resp.json(); } catch (e) { data = null; }
    return { status: resp.status, ok: resp.ok, data };
  } finally {
    clearTimeout(guarda);
  }
}

function proxEhChaveRecusada(status) {
  return status === 401 || status === 403;
}

// Estado da conexão da instância no servidor: conectado = state "open".
// 404 (instância ainda não criada) conta como desconectado e devolve existe:false
// para o proxQR só tentar criar quando realmente falta.
async function proxEstadoServidor(cfg) {
  const r = await proxApi(cfg, "/instance/connectionState/" + encodeURIComponent(cfg.instancia));
  if (proxEhChaveRecusada(r.status)) {
    return { ok: false, chaveInvalida: true, conectado: false, error: "API Key recusada pelo servidor (HTTP " + r.status + ")." };
  }
  if (r.status === 404) return { ok: true, conectado: false, existe: false, estado: "close" };
  if (!r.ok) {
    return { ok: false, conectado: false, erroServidor: true, error: "Servidor respondeu HTTP " + r.status + "." };
  }
  const estado = (r.data && r.data.instance && r.data.instance.state) || "close";
  return { ok: true, conectado: estado === "open", existe: true, estado };
}

// Estado para a popup (chave + conexão + grupo) em uma chamada só
async function proxEstadoPopup() {
  const cfg = await proxCarregarConfig();
  const resp = {
    ok: true,
    temChave: !!cfg.apikey,
    conectado: false,
    grupoNome: cfg.grupoNome,
    texto: cfg.texto,
    instancia: cfg.instancia
  };
  if (!cfg.apikey) return resp;
  try {
    const est = await proxEstadoServidor(cfg);
    resp.conectado = !!est.conectado;
    if (est.chaveInvalida) { resp.temChave = false; resp.chaveInvalida = true; }
    if (est.erroServidor) resp.erroServidor = true;
  } catch (e) {
    resp.erroServidor = true;
  }
  try {
    const rl = await proxChecarRateLimit();
    if (rl.bloqueado) resp.rate = { bloqueado: true, aguarde: rl.aguarde };
  } catch (e) { /* limite é melhor esforço */ }
  return resp;
}

// Salva API Key manual (validando contra o servidor) e/ou o texto do PROX.
// limparChave apaga a sobrescrita e volta para a chave embutida no pacote.
async function proxSalvarConfigMsg(message) {
  const cfg = await proxLerBruto();
  const padrao = await proxCarregarPadrao();
  const url = (padrao && padrao.url) || PROX_URL;
  if (message && typeof message.texto === "string" && message.texto.trim()) {
    cfg.texto = message.texto.trim().slice(0, 200);
  }
  if (message && message.limparChave) {
    delete cfg.apikeyManual;
  }
  if (message && typeof message.apikey === "string" && message.apikey.trim()) {
    const nova = message.apikey.trim();
    // Formato antes de qualquer chamada à rede: caracteres comuns de chave,
    // tamanho razoável — evita mandar lixo (ou payloads gigantes) ao servidor.
    if (!/^[A-Za-z0-9._\-]{8,200}$/.test(nova)) {
      return { ok: false, error: "API Key inválida — use de 8 a 200 caracteres (letras, números, ponto, hífen ou sublinhado)." };
    }
    const teste = await proxApi({ apikey: nova, url }, "/instance/fetchInstances");
    if (proxEhChaveRecusada(teste.status)) {
      return { ok: false, chaveInvalida: true, error: "API Key recusada pelo servidor (HTTP " + teste.status + ")." };
    }
    if (!teste.ok) {
      return { ok: false, error: "Servidor respondeu HTTP " + teste.status + " — confira a chave." };
    }
    cfg.apikeyManual = nova;
  }
  await proxSalvarConfigLocal(cfg);
  const efetiva = await proxCarregarConfig();
  return { ok: true, temChave: !!efetiva.apikey, temManual: efetiva.temManual, temPadrao: efetiva.temPadrao };
}

// Garante a instância, devolve o estado e, se ainda não pareada, o QR atual
// (data URI). A modal pega essa resposta a cada 4s: um QR novo renova a imagem
// sozinho. A criação usa POST /instance/create com {instanceName, integration}
// (validado ao vivo contra o servidor) e só roda quando o connectionState
// responde 404 — instância já existente não gera erro de nome repetido.
// cfgEntrada opcional: a modal do suporte reusa esta mesma lógica com a
// instância própria (sug-xxxxx), passando a config já carregada.
async function proxQR(cfgEntrada) {
  const cfg = cfgEntrada || await proxCarregarConfig();
  if (!cfg.apikey) return { ok: false, abrir: true, error: "Configure a API Key do servidor." };
  try {
    const est = await proxEstadoServidor(cfg);
    if (est.chaveInvalida) return { ok: false, chaveInvalida: true, error: est.error };
    if (!est.ok && est.erroServidor) return { ok: false, error: est.error };
    if (est.conectado) return { ok: true, conectado: true };

    if (est.existe === false) {
      const cri = await proxApi(cfg, "/instance/create", {
        method: "POST",
        body: { instanceName: cfg.instancia, integration: "WHATSAPP-BAILEYS" }
      });
      const msgCri = JSON.stringify(cri.data || {});
      // já criada em outra chamada: segue direto para o QR
      const jaExiste = /already in use|exist/i.test(msgCri);
      if (!cri.ok && !jaExiste) {
        if (proxEhChaveRecusada(cri.status)) {
          return { ok: false, chaveInvalida: true, error: "API Key recusada pelo servidor (HTTP " + cri.status + ")." };
        }
        return { ok: false, error: "Falha ao criar a instância: " + (msgCri || ("HTTP " + cri.status)) };
      }
    }

    const c = await proxApi(cfg, "/instance/connect/" + encodeURIComponent(cfg.instancia), { timeout: 20000 });
    if (proxEhChaveRecusada(c.status)) {
      return { ok: false, chaveInvalida: true, error: "API Key recusada pelo servidor (HTTP " + c.status + ")." };
    }
    if (!c.ok || !c.data) {
      return { ok: false, error: "Não foi possível gerar o QR Code (HTTP " + c.status + ")." };
    }
    let base64 = c.data.base64 || null;
    if (base64 && base64.indexOf("data:") !== 0) base64 = "data:image/png;base64," + base64;
    if (!base64) {
      return { ok: false, error: "O servidor não devolveu a imagem do QR — toque em recarregar." };
    }
    return { ok: true, conectado: false, base64 };
  } catch (e) {
    return { ok: false, error: "Servidor de Zap indisponível (" + e.message + ")." };
  }
}

// Lista os grupos do número pareado (só grupos: id termina em @g.us). Com a
// instância fechada o fetchAllGroups trava no servidor, então o estado é
// conferido antes (a modal só chega aqui com WhatsApp conectado).
async function proxGrupos(cfgEntrada) {
  const cfg = cfgEntrada || await proxCarregarConfig();
  if (!cfg.apikey) return { ok: false, abrir: true, error: "Configure a API Key do servidor." };
  try {
    const est = await proxEstadoServidor(cfg);
    if (est.chaveInvalida) return { ok: false, chaveInvalida: true, error: est.error };
    if (!est.ok && est.erroServidor) return { ok: false, error: est.error };
    if (!est.conectado) return { ok: false, desconectado: true, error: "WhatsApp desconectado — escaneie o QR Code." };
    const r = await proxApi(cfg,
      "/group/fetchAllGroups/" + encodeURIComponent(cfg.instancia) + "?getParticipants=false",
      { timeout: 90000 });
    if (proxEhChaveRecusada(r.status)) {
      return { ok: false, chaveInvalida: true, error: "API Key recusada pelo servidor (HTTP " + r.status + ")." };
    }
    if (!r.ok) return { ok: false, error: "Falha ao listar grupos (HTTP " + r.status + ")." };
    const bruto = Array.isArray(r.data) ? r.data
      : (r.data && Array.isArray(r.data.groups) ? r.data.groups : []);
    const vistos = new Set();
    const grupos = [];
    bruto.forEach((g) => {
      if (!g) return;
      const id = (typeof g.id === "string" ? g.id : (g.id && (g.id._serialized || g.id.id))) || "";
      if (!id || vistos.has(id)) return;
      if (id.indexOf("@g.us") === -1) return;
      vistos.add(id);
      grupos.push({ id, nome: g.subject || g.name || id });
    });
    grupos.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    return { ok: true, grupos, vazio: grupos.length === 0 };
  } catch (e) {
    return { ok: false, error: "Servidor de Zap indisponível (" + e.message + ")." };
  }
}

// ===== Anti-spam do envio PROX =====
// No máximo 5 mensagens em janela de 30 segundos por navegador. Ao atingir o
// limite, o próximo envio só é liberado quando a janela deslizar — rajada de
// mensagens é o que leva a conta do WhatsApp a bloqueio/ban.
const PROX_LIMITE_ENVIOS = 5;
const PROX_JANELA_MS = 30000;
const PROX_ENVIOS_KEY = "ccTools_proxEnvios";
// Sugestões têm janela própria e mais curta: 3 envios a cada 10 minutos —
// o grupo do suporte não deve virar fila de spam.
const SUG_LIMITE_ENVIOS = 3;
const SUG_JANELA_MS = 600000;
const SUG_ENVIOS_KEY = "ccTools_sugestaoEnvios";

async function proxEnviosRecentes(agora) {
  try {
    const dado = await chrome.storage.local.get(PROX_ENVIOS_KEY);
    const lista = dado && Array.isArray(dado[PROX_ENVIOS_KEY]) ? dado[PROX_ENVIOS_KEY] : [];
    return lista.filter(function (t) { return typeof t === "number" && agora - t < PROX_JANELA_MS; });
  } catch (e) {
    return [];
  }
}

async function proxChecarRateLimit() {
  const agora = Date.now();
  const recentes = await proxEnviosRecentes(agora);
  if (recentes.length < PROX_LIMITE_ENVIOS) return { bloqueado: false, restantes: PROX_LIMITE_ENVIOS - recentes.length };
  const maisAntigo = Math.min.apply(null, recentes);
  const aguarde = Math.max(1, Math.ceil((PROX_JANELA_MS - (agora - maisAntigo)) / 1000));
  return { bloqueado: true, aguarde: aguarde };
}

async function proxRegistrarEnvio() {
  try {
    const agora = Date.now();
    const recentes = await proxEnviosRecentes(agora);
    recentes.push(agora);
    await chrome.storage.local.set({ [PROX_ENVIOS_KEY]: recentes });
  } catch (e) { /* storage indisponível não pode travar o envio */ }
}

async function sugEnviosRecentes(agora) {
  try {
    const dado = await chrome.storage.local.get(SUG_ENVIOS_KEY);
    const lista = dado && Array.isArray(dado[SUG_ENVIOS_KEY]) ? dado[SUG_ENVIOS_KEY] : [];
    return lista.filter(function (t) { return typeof t === "number" && agora - t < SUG_JANELA_MS; });
  } catch (e) {
    return [];
  }
}

async function sugChecarRateLimit() {
  const agora = Date.now();
  const recentes = await sugEnviosRecentes(agora);
  if (recentes.length < SUG_LIMITE_ENVIOS) return { bloqueado: false, restantes: SUG_LIMITE_ENVIOS - recentes.length };
  const maisAntigo = Math.min.apply(null, recentes);
  const aguarde = Math.max(1, Math.ceil((SUG_JANELA_MS - (agora - maisAntigo)) / 1000));
  return { bloqueado: true, aguarde: aguarde };
}

async function sugRegistrarEnvio() {
  try {
    const agora = Date.now();
    const recentes = await sugEnviosRecentes(agora);
    recentes.push(agora);
    await chrome.storage.local.set({ [SUG_ENVIOS_KEY]: recentes });
  } catch (e) { /* storage indisponível não pode travar o envio */ }
}

// Envia o texto configurado no grupo salvo (usado pelo botão/Alt+P)
async function proxAcao() {
  const cfg = await proxCarregarConfig();
  if (!cfg.apikey) return { ok: false, abrir: true, error: "Configure a API Key do servidor de Zap." };
  if (!cfg.grupoId) return { ok: false, abrir: true, error: "Escolha um grupo para enviar o PROX." };
  try {
    const est = await proxEstadoServidor(cfg);
    if (est.chaveInvalida) return { ok: false, abrir: true, chaveInvalida: true, error: est.error };
    if (!est.conectado) return { ok: false, abrir: true, error: "WhatsApp desconectado — escaneie o QR Code." };
    const rl = await proxChecarRateLimit();
    if (rl.bloqueado) {
      return {
        ok: false,
        rateLimit: true,
        aguarde: rl.aguarde,
        error: "Aguarde " + rl.aguarde + "s para enviar de novo — limite anti-spam de 5 mensagens a cada 30 segundos. Enviar em rajada coloca sua conta do WhatsApp em risco de bloqueio."
      };
    }
    const r = await proxApi(cfg, "/message/sendText/" + encodeURIComponent(cfg.instancia), {
      method: "POST",
      body: { number: cfg.grupoId, text: cfg.texto || "prox" },
      timeout: 20000
    });
    if (proxEhChaveRecusada(r.status)) return { ok: false, abrir: true, chaveInvalida: true, error: "API Key recusada pelo servidor." };
    if (!r.ok) {
      const detalhe = (r.data && (r.data.message || r.data.error)) || ("HTTP " + r.status);
      return { ok: false, error: "Falha ao enviar: " + detalhe + "." };
    }
    await proxRegistrarEnvio();
    return { ok: true, enviado: true, grupo: cfg.grupoNome || "grupo" };
  } catch (e) {
    return { ok: false, error: "Servidor de Zap indisponível (" + e.message + ")." };
  }
}

// ===== Sugestões (modal "Sugestões" da extensão) =====
const SUGESTOES_ARQUIVO = "SUGESTOES MODAL.html";
const SUGESTOES_JS = "sugestoes-modal.js";

// Mensagem PADRÃO que vai para o grupo do suporte: cabeçalho + todos os
// campos preenchidos no formulário (função, nome, email — informando se foi
// adicionado ou não —, setor, período e o texto). Aceita o payload completo
// da modal ou uma string simples (fluxo legado).
// Texto seguro para campos de sugestão: string, sem caracteres de controle,
// aparado no tamanho máximo (defesa mesmo se a modal for contornada).
function sgTexto(v, max) {
  let s = typeof v === "string" ? v : (v == null ? "" : String(v));
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function montarSugestao(payload) {
  if (typeof payload === "string") {
    return "💡 *SUGESTÃO — CallCenter Tools*\n\n📝 *Sugestão:*\n" + sgTexto(payload, 1500);
  }
  const p = payload || {};
  const linhas = ["💡 *SUGESTÃO — CallCenter Tools*", ""];
  linhas.push("📌 *Função:* " + (sgTexto(p.funcao, 40) || "Não informada"));
  linhas.push("👤 *Nome:* " + (sgTexto(p.nome, 80) || "Não informado"));
  // O email entra só quando a pessoa preenche — e a mensagem deixa claro
  // se ele foi adicionado ou não (o suporte usa isso para retorno).
  const email = sgTexto(p.email, 120);
  if (email) {
    linhas.push("📧 *Email (adicionado):* " + email);
  } else {
    linhas.push("📧 *Email:* não informado (não adicionado)");
  }
  linhas.push("🏢 *Setor:* " + (sgTexto(p.setor, 40) || "Não informado"));
  linhas.push("🕒 *Período:* " + (sgTexto(p.periodo, 40) || "Não informado"));
  linhas.push("");
  linhas.push("📝 *O que quer adicionar:*");
  linhas.push(sgTexto(p.texto, 1500));
  return linhas.join("\n");
}

// Envia o texto da operadora para o grupo de suporte no WhatsApp — mesmo
// servidor e o mesmo anti-spam (5/30s). Com o grupo escolhido na modal do
// suporte (admin), o envio usa a instância própria "sug-xxxxx"; sem isso,
// o destino vem de assets/prox-servidor.json (campo "grupoSuporte",
// gitignorado) ou da sobrescrita local ccTools_sugestaoGrupo, pela
// instância do PROX. Sem destino configurado (ou com o WhatsApp
// fechado/servidor fora), a resposta traz copiado:true + o texto pronto e a
// modal copia para a operadora colar no grupo manualmente — nunca trava.
async function enviarSugestao(payload) {
  let texto = "";
  if (typeof payload === "string") {
    texto = sgTexto(payload, 1500);
  } else if (payload && typeof payload === "object") {
    // Validação de novo no background (não confia só na modal): nome
    // obrigatório, texto com mínimo e máximo, email com formato rígido.
    const nome = sgTexto(payload.nome, 80);
    if (!nome) {
      return { ok: false, error: "Escreva seu nome — é obrigatório." };
    }
    const textoSug = sgTexto(payload.texto, 1500);
    if (textoSug.length < 10) {
      return { ok: false, error: "Descreva um pouco mais o que você quer adicionar (mín. 10 letras)." };
    }
    const email = sgTexto(payload.email, 120);
    if (email && !/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$/.test(email)) {
      return { ok: false, error: "Email inválido — confira (ex.: ana@empresa.com) ou deixe em branco." };
    }
    texto = montarSugestao({
      funcao: sgTexto(payload.funcao, 40),
      nome: nome,
      email: email,
      setor: sgTexto(payload.setor, 40),
      periodo: sgTexto(payload.periodo, 40),
      texto: textoSug
    });
  }
  if (!texto || texto.length < 10) {
    return { ok: false, error: "Sugestão vazia demais." };
  }
  const cfgSuporte = await suporteCarregarConfig();
  const cfgProx = cfgSuporte.grupoId ? null : await proxCarregarConfig();
  const cfg = cfgProx || cfgSuporte;
  let destino = "";
  try {
    if (cfgSuporte.grupoId) {
      destino = cfgSuporte.grupoId;
    } else {
      const extra = await chrome.storage.local.get(["ccTools_sugestaoGrupo"]);
      if (typeof extra.ccTools_sugestaoGrupo === "string" && extra.ccTools_sugestaoGrupo.trim()) {
        destino = extra.ccTools_sugestaoGrupo.trim();
      }
      if (!destino && cfg.grupoSuporte) destino = cfg.grupoSuporte;
    }
  } catch (e) { /* storage indisponível não pode travar */ }
  if (!cfg.apikey) return { ok: true, copiado: true, texto: texto, motivo: "configure o PROX primeiro" };
  if (!destino) return { ok: true, copiado: true, texto: texto, motivo: "grupo de suporte ainda não configurado" };
  try {
    const est = await proxEstadoServidor(cfg);
    if (est.chaveInvalida) return { ok: false, error: est.error };
    if (!est.conectado) return { ok: true, copiado: true, texto: texto, motivo: "WhatsApp fechado" };
    const rl = await sugChecarRateLimit();
    if (rl.bloqueado) {
      return {
        ok: false,
        rateLimit: true,
        aguarde: rl.aguarde,
        error: "Aguarde " + rl.aguarde + "s — limite anti-spam de " + SUG_LIMITE_ENVIOS + " sugestões a cada 10 minutos."
      };
    }
    const r = await proxApi(cfg, "/message/sendText/" + encodeURIComponent(cfg.instancia), {
      method: "POST",
      body: { number: destino, text: texto },
      timeout: 20000
    });
    if (proxEhChaveRecusada(r.status)) return { ok: false, error: "API Key recusada pelo servidor." };
    if (!r.ok) {
      const detalhe = (r.data && (r.data.message || r.data.error)) || ("HTTP " + r.status);
      return { ok: true, copiado: true, texto: texto, motivo: "servidor respondeu " + detalhe };
    }
    await sugRegistrarEnvio();
    return { ok: true, enviado: true };
  } catch (e) {
    return { ok: true, copiado: true, texto: texto, motivo: "servidor indisponível" };
  }
}

// Desconecta a instância (liba o número para um novo QR quando reconectar)
async function proxDesconectar(cfgEntrada) {
  const cfg = cfgEntrada || await proxCarregarConfig();
  if (!cfg.apikey) return { ok: false, abrir: true, error: "Configure a API Key do servidor." };
  try {
    const r = await proxApi(cfg, "/instance/logout/" + encodeURIComponent(cfg.instancia), {
      method: "DELETE",
      timeout: 20000
    });
    if (proxEhChaveRecusada(r.status)) return { ok: false, chaveInvalida: true, error: "API Key recusada pelo servidor." };
    if (r.ok || r.status === 404) return { ok: true };
    // Erro do servidor em logout: 400 "not connected" significa que a instância
    // já estava caída; 500 pode ser corrida de estado (a instância terminou de
    // fechar enquanto o logout era processado). Nos dois casos confere o estado
    // real antes de reportar falha — se não está mais "open", a desconexão
    // aconteceu.
    const msg = JSON.stringify(r.data || {});
    if (/not connected/i.test(msg)) return { ok: true, jaDesconectado: true };
    try {
      const est = await proxEstadoServidor(cfg);
      if (est && est.ok && !est.conectado) return { ok: true, jaDesconectado: true };
    } catch (e2) { /* reporta o erro original do logout */ }
    return { ok: false, error: "Falha ao desconectar (HTTP " + r.status + ")." };
  } catch (e) {
    return { ok: false, error: "Servidor de Zap indisponível (" + e.message + ")." };
  }
}

// ===== WhatsApp do Suporte (modal de configuração das sugestões) =====
// O admin (senha na popup) abre a modal do suporte: é a cópia da modal do
// PROX, mas com instância própria "sug-xxxxx" e destino fixo nos
// chrome.storage.local desta extensão — o grupo escolhido aqui vira o
// destino das sugestões das operadoras. A API Key/url são as mesmas do
// PROX (compartilhadas); instância, grupo e o envio são próprios.
const SUPORTE_STORAGE_KEY = "ccTools_suporte";
const SUPORTE_ARQUIVO = "SUPORTE MODAL.html";
const SUPORTE_JS = "suporte-modal.js";

// Lê o que está SALVO do suporte (sem misturar o padrão do pacote)
async function suporteLerBruto() {
  const res = await chrome.storage.local.get([SUPORTE_STORAGE_KEY]);
  const cfg = (res[SUPORTE_STORAGE_KEY] && typeof res[SUPORTE_STORAGE_KEY] === "object")
    ? res[SUPORTE_STORAGE_KEY]
    : {};
  let mudou = false;
  if (!cfg.instancia) {
    cfg.instancia = "sug-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
    mudou = true;
  }
  if (!cfg.grupoId) { cfg.grupoId = null; cfg.grupoNome = null; }
  if (mudou) await chrome.storage.local.set({ [SUPORTE_STORAGE_KEY]: cfg });
  return cfg;
}

// Config efetiva do suporte: instância/grupo próprios + apikey/url do PROX
async function suporteCarregarConfig() {
  const cfg = await suporteLerBruto();
  const padrao = await proxCarregarPadrao();
  // API Key manual é compartilhada com o PROX (mesma conta no servidor)
  const brutoProx = await proxLerBruto();
  cfg.apikey = brutoProx.apikeyManual || (padrao && padrao.apikey) || "";
  cfg.url = (padrao && padrao.url) || PROX_URL;
  cfg.temPadrao = !!(padrao && padrao.apikey);
  cfg.temManual = !!brutoProx.apikeyManual;
  return cfg;
}

async function suporteSalvarConfigLocal(cfg) {
  await chrome.storage.local.set({ [SUPORTE_STORAGE_KEY]: cfg });
}

// Estado para a popup-admin (chave + conexão + grupo do suporte)
async function suporteEstadoPopup() {
  const cfg = await suporteCarregarConfig();
  const resp = {
    ok: true,
    temChave: !!cfg.apikey,
    conectado: false,
    grupoNome: cfg.grupoNome,
    instancia: cfg.instancia
  };
  if (!cfg.apikey) return resp;
  try {
    const est = await proxEstadoServidor(cfg);
    resp.conectado = !!est.conectado;
    if (est.chaveInvalida) { resp.temChave = false; resp.chaveInvalida = true; }
    if (est.erroServidor) resp.erroServidor = true;
  } catch (e) {
    resp.erroServidor = true;
  }
  return resp;
}

// Escolhe o grupo que recebe as sugestões: salva no suporte e mantém o
// override ccTools_sugestaoGrupo em sincronia (string com o id, formato
// que o popup.js e o fluxo legado já leem)
async function suporteSelecionar(id, nome) {
  const cfg = await suporteLerBruto();
  cfg.grupoId = id;
  cfg.grupoNome = nome || id;
  await suporteSalvarConfigLocal(cfg);
  await chrome.storage.local.set({ ccTools_sugestaoGrupo: id });
  return { ok: true };
}

// QR / grupos / desconectar do suporte: mesma lógica do PROX com a cfg própria
async function suporteQR() { return proxQR(await suporteCarregarConfig()); }
async function suporteGrupos() { return proxGrupos(await suporteCarregarConfig()); }
async function suporteDesconectar() { return proxDesconectar(await suporteCarregarConfig()); }

// Regras de `body` não existem no SUPORTE MODAL.html (só classes px-), então o
// preparo aqui é só tirar o <script> inerte — o suporte-modal.js é injetado
// como content script logo depois, imune ao CSP da página.
function prepararHtmlSuporte(html) {
  return html
    .replace(/<script[^>]*src=["']suporte-modal\.js["'][^>]*><\/script>\s*/i, "");
}

// Regras de `body` não existem no PROX MODAL.html (só classes px-), então o
// preparo aqui é só tirar o <script> inerte — o prox-modal.js é injetado como
// content script logo depois, imune ao CSP da página.
function prepararHtmlProx(html) {
  return html
    .replace(/<script[^>]*src=["']prox-modal\.js["'][^>]*><\/script>\s*/i, "");
}

// Imagem da extensão como data URI: a modal é injetada dentro da página e o
// CSP dela pode bloquear chrome-extension:// em <img>. Data URI passa no
// img-src da maioria dos sites e também funciona no harness file://.
async function assetDataUri(caminho) {
  try {
    const resp = await fetch(chrome.runtime.getURL(caminho));
    if (!resp.ok) return "";
    const buf = new Uint8Array(await resp.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return "data:image/png;base64," + btoa(bin);
  } catch (e) {
    return "";
  }
}

// Injetada via chrome.scripting.executeScript — precisa ser autocontida.
// logoUri: data URI da assinatura Alares (montado no SW antes da injeção).
function construirModalProx(conteudoHtml, logoUri) {
  var ID = "cc-prox-modal";
  var antigo = document.getElementById(ID);
  if (antigo) antigo.parentNode.removeChild(antigo);
  // Nunca deixa duas modais abertas ao mesmo tempo (ids px-/sg- são iguais)
  var outras = ["cc-suporte-modal", "cc-sugestoes-modal"];
  for (var i = 0; i < outras.length; i++) {
    var el = document.getElementById(outras[i]);
    if (el) el.parentNode.removeChild(el);
  }

  var raiz = document.createElement("div");
  raiz.id = ID;
  raiz.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;" +
    "z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
    "background:rgba(4,8,18,.62);font-family:'Segoe UI',Arial,sans-serif;";

  var cartao = document.createElement("div");
  cartao.style.cssText = "width:min(780px,94vw);height:min(640px,90vh);" +
    "background:#0a1224;border:1px solid #22345c;border-radius:14px;" +
    "box-shadow:0 24px 70px rgba(0,0,0,.55);" +
    "display:flex;flex-direction:column;overflow:hidden;";

  var cabecalho = document.createElement("div");
  cabecalho.style.cssText = "display:flex;align-items:center;justify-content:space-between;" +
    "gap:10px;padding:11px 14px;flex-shrink:0;color:#e8eefc;font-size:14px;font-weight:600;" +
    "background:linear-gradient(135deg,#0d1b3d,#16305e);border-bottom:1px solid #22345c;";

  var ladoEsq = document.createElement("span");
  ladoEsq.style.cssText = "display:flex;align-items:center;gap:9px;min-width:0;";
  if (logoUri) {
    var imgLogo = document.createElement("img");
    imgLogo.id = "cc-prox-logo";
    imgLogo.src = logoUri;
    imgLogo.alt = "Alares";
    imgLogo.title = "Alares Internet";
    imgLogo.style.cssText = "height:16px;display:block;cursor:pointer;";
    ladoEsq.appendChild(imgLogo);
  }
  var titulo = document.createElement("span");
  titulo.textContent = "Enviar PROX";
  ladoEsq.appendChild(titulo);

  var btnFechar = document.createElement("button");
  btnFechar.type = "button";
  btnFechar.setAttribute("aria-label", "Fechar");
  btnFechar.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none"' +
    ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' +
    ' aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  btnFechar.style.cssText = "width:28px;height:28px;border:0;border-radius:7px;" +
    "background:rgba(255,255,255,.12);color:#e8eefc;cursor:pointer;line-height:1;" +
    "display:flex;align-items:center;justify-content:center;";
  btnFechar.addEventListener("mouseenter", function () { btnFechar.style.background = "rgba(255,255,255,.22)"; });
  btnFechar.addEventListener("mouseleave", function () { btnFechar.style.background = "rgba(255,255,255,.12)"; });

  var corpo = document.createElement("div");
  corpo.id = "cc-prox-corpo";
  // Sem display:flex aqui: o PROX MODAL.html não tem regras de body e o
  // wrapper px-wrap cuida do layout (lição do esmagamento da modal do X6).
  corpo.style.cssText = "flex:1;overflow:auto;min-height:0;background:#0a1224;";
  corpo.innerHTML = conteudoHtml;

  function aoTeclar(e) {
    if (e.key === "Escape") fechar();
  }
  function fechar() {
    document.removeEventListener("keydown", aoTeclar, true);
    if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
  }
  btnFechar.addEventListener("click", fechar);
  raiz.addEventListener("mousedown", function (e) {
    if (e.target === raiz) fechar(); // clique no fundo escuro
  });
  document.addEventListener("keydown", aoTeclar, true);

  cabecalho.appendChild(ladoEsq);
  cabecalho.appendChild(btnFechar);
  cartao.appendChild(cabecalho);
  cartao.appendChild(corpo);
  raiz.appendChild(cartao);
  (document.body || document.documentElement).appendChild(raiz);
}

async function mostrarModalProxNaAba(tabId) {
  if (tabId == null) return { ok: false, error: "Nenhuma aba ativa encontrada." };
  let html;
  try {
    const resp = await fetch(chrome.runtime.getURL(encodeURIComponent(PROX_ARQUIVO)));
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    html = await resp.text();
  } catch (e) {
    return { ok: false, error: "Arquivo \"" + PROX_ARQUIVO + "\" não encontrado na extensão." };
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: construirModalProx,
      args: [prepararHtmlProx(html), await assetDataUri("assets/alares.png")]
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [PROX_JS]
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Abra o WhatsApp Web ou o chat da empresa para usar esta tela." };
  }
}

// Injetada via chrome.scripting.executeScript — precisa ser autocontida.
// Mesma estrutura da modal do PROX, com ids próprios (cc-suporte-*) para as
// duas nunca coexistirem na mesma página.
function construirModalSuporte(conteudoHtml, logoUri) {
  var ID = "cc-suporte-modal";
  var antigo = document.getElementById(ID);
  if (antigo) antigo.parentNode.removeChild(antigo);
  // Nunca deixa duas modais abertas ao mesmo tempo (ids px-/sg- são iguais)
  var outras = ["cc-prox-modal", "cc-sugestoes-modal"];
  for (var i = 0; i < outras.length; i++) {
    var el = document.getElementById(outras[i]);
    if (el) el.parentNode.removeChild(el);
  }

  var raiz = document.createElement("div");
  raiz.id = ID;
  raiz.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;" +
    "z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
    "background:rgba(4,8,18,.62);font-family:'Segoe UI',Arial,sans-serif;";

  var cartao = document.createElement("div");
  cartao.style.cssText = "width:min(780px,94vw);height:min(640px,90vh);" +
    "background:#0a1224;border:1px solid #22345c;border-radius:14px;" +
    "box-shadow:0 24px 70px rgba(0,0,0,.55);" +
    "display:flex;flex-direction:column;overflow:hidden;";

  var cabecalho = document.createElement("div");
  cabecalho.style.cssText = "display:flex;align-items:center;justify-content:space-between;" +
    "gap:10px;padding:11px 14px;flex-shrink:0;color:#e8eefc;font-size:14px;font-weight:600;" +
    "background:linear-gradient(135deg,#0d1b3d,#16305e);border-bottom:1px solid #22345c;";

  var ladoEsq = document.createElement("span");
  ladoEsq.style.cssText = "display:flex;align-items:center;gap:9px;min-width:0;";
  if (logoUri) {
    var imgLogo = document.createElement("img");
    imgLogo.id = "cc-suporte-logo";
    imgLogo.src = logoUri;
    imgLogo.alt = "Alares";
    imgLogo.title = "Alares Internet";
    imgLogo.style.cssText = "height:16px;display:block;";
    ladoEsq.appendChild(imgLogo);
  }
  var titulo = document.createElement("span");
  titulo.textContent = "WhatsApp do Suporte";
  ladoEsq.appendChild(titulo);

  var btnFechar = document.createElement("button");
  btnFechar.type = "button";
  btnFechar.setAttribute("aria-label", "Fechar");
  btnFechar.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none"' +
    ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' +
    ' aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  btnFechar.style.cssText = "width:28px;height:28px;border:0;border-radius:7px;" +
    "background:rgba(255,255,255,.12);color:#e8eefc;cursor:pointer;line-height:1;" +
    "display:flex;align-items:center;justify-content:center;";
  btnFechar.addEventListener("mouseenter", function () { btnFechar.style.background = "rgba(255,255,255,.22)"; });
  btnFechar.addEventListener("mouseleave", function () { btnFechar.style.background = "rgba(255,255,255,.12)"; });

  var corpo = document.createElement("div");
  corpo.id = "cc-suporte-corpo";
  // Sem display:flex aqui: o SUPORTE MODAL.html não tem regras de body e o
  // wrapper px-wrap cuida do layout (mesma lição da modal do PROX).
  corpo.style.cssText = "flex:1;overflow:auto;min-height:0;background:#0a1224;";
  corpo.innerHTML = conteudoHtml;

  function aoTeclar(e) {
    if (e.key === "Escape") fechar();
  }
  function fechar() {
    document.removeEventListener("keydown", aoTeclar, true);
    if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
  }
  btnFechar.addEventListener("click", fechar);
  raiz.addEventListener("mousedown", function (e) {
    if (e.target === raiz) fechar(); // clique no fundo escuro
  });
  document.addEventListener("keydown", aoTeclar, true);

  cabecalho.appendChild(ladoEsq);
  cabecalho.appendChild(btnFechar);
  cartao.appendChild(cabecalho);
  cartao.appendChild(corpo);
  raiz.appendChild(cartao);
  (document.body || document.documentElement).appendChild(raiz);
}

async function mostrarModalSuporteNaAba(tabId) {
  if (tabId == null) return { ok: false, error: "Nenhuma aba ativa encontrada." };
  let html;
  try {
    const resp = await fetch(chrome.runtime.getURL(encodeURIComponent(SUPORTE_ARQUIVO)));
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    html = await resp.text();
  } catch (e) {
    return { ok: false, error: "Arquivo \"" + SUPORTE_ARQUIVO + "\" não encontrado na extensão." };
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: construirModalSuporte,
      args: [prepararHtmlSuporte(html), await assetDataUri("assets/alares.png")]
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [SUPORTE_JS]
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Abra o WhatsApp Web ou o chat da empresa para usar esta tela." };
  }
}

// Regras de `body` não existem no SUGESTOES MODAL.html (só classes sg-),
// então o preparo aqui é só tirar o <script> inerte — o sugestoes-modal.js
// é injetado como content script logo depois, imune ao CSP da página.
function prepararHtmlSugestoes(html) {
  return html
    .replace(/<script[^>]*src=["']sugestoes-modal\.js["'][^>]*><\/script>\s*/i, "");
}

// Injetada via chrome.scripting.executeScript — precisa ser autocontida.
// Mesma estrutura das modais do PROX e do suporte, com ids próprios
// (cc-sugestoes-*) para as três nunca coexistirem na mesma página.
function construirModalSugestoes(conteudoHtml, logoUri) {
  var ID = "cc-sugestoes-modal";
  var antigo = document.getElementById(ID);
  if (antigo) antigo.parentNode.removeChild(antigo);
  // Nunca deixa duas modais abertas ao mesmo tempo (ids px-/sg- são iguais)
  var prox = document.getElementById("cc-prox-modal");
  if (prox) prox.parentNode.removeChild(prox);
  var sup = document.getElementById("cc-suporte-modal");
  if (sup) sup.parentNode.removeChild(sup);

  var raiz = document.createElement("div");
  raiz.id = ID;
  raiz.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;" +
    "z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
    "background:rgba(4,8,18,.62);font-family:'Segoe UI',Arial,sans-serif;";

  var cartao = document.createElement("div");
  cartao.style.cssText = "width:min(640px,94vw);height:min(720px,92vh);" +
    "background:#0a1224;border:1px solid #22345c;border-radius:14px;" +
    "box-shadow:0 24px 70px rgba(0,0,0,.55);" +
    "display:flex;flex-direction:column;overflow:hidden;";

  var cabecalho = document.createElement("div");
  cabecalho.style.cssText = "display:flex;align-items:center;justify-content:space-between;" +
    "gap:10px;padding:11px 14px;flex-shrink:0;color:#e8eefc;font-size:14px;font-weight:600;" +
    "background:linear-gradient(135deg,#0d1b3d,#16305e);border-bottom:1px solid #22345c;";

  var ladoEsq = document.createElement("span");
  ladoEsq.style.cssText = "display:flex;align-items:center;gap:9px;min-width:0;";
  if (logoUri) {
    var imgLogo = document.createElement("img");
    imgLogo.id = "cc-sugestoes-logo";
    imgLogo.src = logoUri;
    imgLogo.alt = "Alares";
    imgLogo.title = "Alares Internet";
    imgLogo.style.cssText = "height:16px;display:block;";
    ladoEsq.appendChild(imgLogo);
  }
  var titulo = document.createElement("span");
  titulo.textContent = "Sugestões";
  ladoEsq.appendChild(titulo);

  var btnFechar = document.createElement("button");
  btnFechar.type = "button";
  btnFechar.setAttribute("aria-label", "Fechar");
  btnFechar.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none"' +
    ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' +
    ' aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  btnFechar.style.cssText = "width:28px;height:28px;border:0;border-radius:7px;" +
    "background:rgba(255,255,255,.12);color:#e8eefc;cursor:pointer;line-height:1;" +
    "display:flex;align-items:center;justify-content:center;";
  btnFechar.addEventListener("mouseenter", function () { btnFechar.style.background = "rgba(255,255,255,.22)"; });
  btnFechar.addEventListener("mouseleave", function () { btnFechar.style.background = "rgba(255,255,255,.12)"; });

  var corpo = document.createElement("div");
  corpo.id = "cc-sugestoes-corpo";
  // Sem display:flex aqui: o SUGESTOES MODAL.html não tem regras de body e o
  // wrapper sg-wrap cuida do layout (mesma lição das outras modais).
  corpo.style.cssText = "flex:1;overflow:auto;min-height:0;background:#0a1224;";
  corpo.innerHTML = conteudoHtml;

  function aoTeclar(e) {
    if (e.key === "Escape") fechar();
  }
  function fechar() {
    document.removeEventListener("keydown", aoTeclar, true);
    if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
  }
  btnFechar.addEventListener("click", fechar);
  raiz.addEventListener("mousedown", function (e) {
    if (e.target === raiz) fechar(); // clique no fundo escuro
  });
  document.addEventListener("keydown", aoTeclar, true);

  cabecalho.appendChild(ladoEsq);
  cabecalho.appendChild(btnFechar);
  cartao.appendChild(cabecalho);
  cartao.appendChild(corpo);
  raiz.appendChild(cartao);
  (document.body || document.documentElement).appendChild(raiz);
}

async function mostrarModalSugestoesNaAba(tabId) {
  if (tabId == null) return { ok: false, error: "Nenhuma aba ativa encontrada." };
  let html;
  try {
    const resp = await fetch(chrome.runtime.getURL(encodeURIComponent(SUGESTOES_ARQUIVO)));
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    html = await resp.text();
  } catch (e) {
    return { ok: false, error: "Arquivo \"" + SUGESTOES_ARQUIVO + "\" não encontrado na extensão." };
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: construirModalSugestoes,
      args: [prepararHtmlSugestoes(html), await assetDataUri("assets/alares.png")]
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [SUGESTOES_JS]
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Abra o WhatsApp Web ou o chat da empresa para usar esta tela." };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;
  // Só a própria extensão pode pedir config/instância/chave: recusa
  // mensagens de abas ou de frames que não venham dela mesma.
  if (!sender || sender.id !== chrome.runtime.id) return false;
  const t = message.type;
  const ehProx = t === "mostrarModalProx" || t === "proxLerConfig" || t === "proxSalvarConfig" ||
    t === "proxEstado" || t === "proxQR" || t === "proxGrupos" || t === "proxSelecionar" ||
    t === "proxDesconectar" || t === "proxAcao";
  const ehSuporte = t === "mostrarModalSuporte" || t === "suporteLerConfig" || t === "suporteEstado" ||
    t === "suporteQR" || t === "suporteGrupos" || t === "suporteSelecionar" || t === "suporteDesconectar";
  const ehSugestoes = t === "mostrarModalSugestoes";
  if (!ehProx && !ehSuporte && !ehSugestoes) return false;

  (async () => {
    try {
      if (t === "mostrarModalProx") {
        const tabId = message.tabId != null ? message.tabId : (sender.tab && sender.tab.id);
        return await mostrarModalProxNaAba(tabId);
      }
      if (t === "proxLerConfig") {
        const cfg = await proxCarregarConfig();
        return {
          ok: true,
          temChave: !!cfg.apikey,
          temManual: cfg.temManual,
          temPadrao: cfg.temPadrao,
          // A chave embutida no pacote NUNCA sai daqui: só a chave manual
          // digitada volta (para a modal pré-preencher o campo de edição).
          apikey: cfg.temManual ? (cfg.apikey || "") : "",
          instancia: cfg.instancia,
          grupoId: cfg.grupoId,
          grupoNome: cfg.grupoNome,
          texto: cfg.texto
        };
      }
      if (t === "proxSalvarConfig") return await proxSalvarConfigMsg(message);
      if (t === "proxEstado") return await proxEstadoPopup();
      if (t === "proxQR") return await proxQR();
      if (t === "proxGrupos") return await proxGrupos();
      if (t === "proxSelecionar") {
        const id = typeof message.id === "string" ? message.id.trim().slice(0, 200) : "";
        if (!id) return { ok: false, error: "Grupo inválido." };
        const cfg = await proxLerBruto();
        cfg.grupoId = id;
        cfg.grupoNome = sgTexto(message.nome, 120) || id;
        await proxSalvarConfigLocal(cfg);
        return { ok: true };
      }
      if (t === "proxDesconectar") return await proxDesconectar();
      if (t === "proxAcao") return await proxAcao();
      if (t === "mostrarModalSuporte") {
        const tabId = message.tabId != null ? message.tabId : (sender.tab && sender.tab.id);
        return await mostrarModalSuporteNaAba(tabId);
      }
      if (t === "suporteLerConfig") {
        const cfg = await suporteCarregarConfig();
        return {
          ok: true,
          temChave: !!cfg.apikey,
          temManual: cfg.temManual,
          temPadrao: cfg.temPadrao,
          // Mesma regra do PROX: chave manual só; embutida fica no background
          apikey: cfg.temManual ? (cfg.apikey || "") : "",
          instancia: cfg.instancia,
          grupoId: cfg.grupoId,
          grupoNome: cfg.grupoNome
        };
      }
      if (t === "suporteEstado") return await suporteEstadoPopup();
      if (t === "suporteQR") return await suporteQR();
      if (t === "suporteGrupos") return await suporteGrupos();
      if (t === "suporteSelecionar") {
        const id = typeof message.id === "string" ? message.id.trim().slice(0, 200) : "";
        if (!id) return { ok: false, error: "Grupo inválido." };
        return await suporteSelecionar(id, sgTexto(message.nome, 120));
      }
      if (t === "suporteDesconectar") return await suporteDesconectar();
      if (t === "mostrarModalSugestoes") {
        const tabId = message.tabId != null ? message.tabId : (sender.tab && sender.tab.id);
        return await mostrarModalSugestoesNaAba(tabId);
      }
      return { ok: false, error: "Ação desconhecida." };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  })().then(sendResponse);
  return true; // resposta assíncrona
});
