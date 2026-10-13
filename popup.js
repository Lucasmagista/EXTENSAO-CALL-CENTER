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

// ==========================================
// LÓGICA DE NAVEGAÇÃO ENTRE TELAS
// ==========================================
const telaPrincipal = document.getElementById("tela-principal");
const telaSecundaria = document.getElementById("tela-secundaria");

// Vai para a tela secundária
document.getElementById("btn-menu-relatos-mensagens").addEventListener("click", () => {
  ocultar(telaPrincipal);
  mostrar(telaSecundaria);
});

// Volta para a tela principal
document.getElementById("btn-voltar").addEventListener("click", () => {
  ocultar(telaSecundaria);
  mostrar(telaPrincipal);
});

// ==========================================
// TELA "LINKS"
// ==========================================
// Para adicionar um botão novo, basta incluir uma linha nesta lista.
//   Um link:       { nome: "Texto do botão", url: "https://endereco" },
//   Vários links:  { nome: "Texto do botão", urls: ["https://link1", "https://link2"] },

const LINKS = [
  { nome: "Ramais", url: "https://docs.google.com/spreadsheets/d/1r7gK3W7Q5K-5r6qd-3sj5lklAxlcHnM7EArm-D_3Jwk/edit?pli=1&gid=1858272844#gid=1858272844" },
  { nome: "Links", url: "https://docs.google.com/spreadsheets/d/1hdpzDmJ8u1q-0JxcqQIhHcdPtNGa05IfEm-BFl3v3_k/edit?gid=0#gid=0" },
  { nome: "Recados/Roteiro", url: "https://docs.google.com/document/d/1eYtQZxso1gCsfOMilhDBHvlo2P8HBy0iTmlATlNYgRM/edit?tab=t.0" }
];
const telaLinks = document.getElementById("tela-links");
const listaLinks = document.getElementById("lista-links");

LINKS.forEach((link) => {
  const botao = document.createElement("button");
  botao.textContent = link.nome;
  botao.addEventListener("click", () => {
    // aceita "url" (um link) ou "urls" (lista de links); cada um abre em uma aba
    const enderecos = Array.isArray(link.urls) ? link.urls : [link.url];
    enderecos.filter(Boolean).forEach((endereco, i) => {
      chrome.tabs.create({ url: endereco, active: i === 0 });
    });
  });
  listaLinks.appendChild(botao);
});

// Vai para a tela de links
document.getElementById("btn-menu-links").addEventListener("click", () => {
  ocultar(telaPrincipal);
  mostrar(telaLinks);
});

// Volta para a tela principal
document.getElementById("btn-voltar-links").addEventListener("click", () => {
  ocultar(telaLinks);
  mostrar(telaPrincipal);
});

// ==========================================
// FUNÇÕES DOS BOTÕES DA TELA PRINCIPAL
// ==========================================
document.getElementById("btnProx").addEventListener("click", () => {
  send("prox", "prox");
});

document.getElementById("btnCheck").addEventListener("click", () => {
  send("\u2705", "check");
});

document.getElementById("btnSnippets").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("snippets.html") });
});

document.getElementById("btnHuawei").addEventListener("click", () => {
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
});

document.getElementById("btnSenhaWifi").addEventListener("click", () => {
chrome.tabs.create({ url: "https://oquei-decodificar.lovable.app/" });
});

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
// FUNÇÕES DOS BOTÕES DA TELA SECUNDÁRIA
// ==========================================

// Injeta o novo script de relatos na guia ativa
document.getElementById("btn-relatos").addEventListener("click", () => {
  setStatus("Abrindo relatos...");
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (chrome.runtime.lastError || !tabs || !tabs[0]) {
      setStatus("Nenhuma aba ativa encontrada.");
      return;
    }
    fecharPaineisAbertos(tabs[0].id, () => {
      // MAIN world: o relato usa o editor (DevExpress/Quill) da própria página
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        world: 'MAIN',
        files: ['relatos.js']
      });
      fecharSePopup();
    });
  });
});

// Aciona a ferramenta antiga de mensagens via background
document.getElementById("btn-mensagens").addEventListener("click", () => {
  setStatus("Abrindo mensagens...");
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (chrome.runtime.lastError || !tabs || !tabs[0]) {
      setStatus("Nenhuma aba ativa encontrada.");
      return;
    }
    const url = tabs[0].url || "";
    if (!url.startsWith("https://web.whatsapp.com/")) {
      setStatus("Abra o WhatsApp Web para usar as mensagens rápidas.");
      return;
    }
    fecharPaineisAbertos(tabs[0].id, () => {
      chrome.runtime.sendMessage({ type: "runQuickReplyMenu" });
      fecharSePopup();
    });
  });
});

// ==========================================
// VOLUME DO ÁUDIO DOS SNIPPETS
// ==========================================
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
  if (!origem || (!origem.startsWith("https://") && !origem.startsWith("http://"))) {
    siteTexto.textContent = "Esta página não permite o uso de snippets.";
    return;
  }
  if (ehBase || temPermissao) {
    siteTexto.textContent = "✅ Snippets ativos neste site.";
    if (!ehBase) mostrar(btnRemoverSite);
    return;
  }
  siteTexto.textContent = "💬 Quer usar snippets neste site também?";
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
  flutuante: "Um botão 🧩 arrastável aparece nas páginas liberadas.",
  lateral: "Um gatilho 🧰 integrado na página abre o painel de ferramentas.",
  ambos: "Gatilho 🧰 integrado + botão 🧩 arrastável nas páginas."
};
const ROTULOS_MODO = {
  padrao: "Usar padrão",
  flutuante: "🧩 Flutuante",
  lateral: "📐 Barra lateral",
  ambos: "🔀 Ambos"
};

const telaConfig = document.getElementById("tela-config");
const listaModoPorSite = document.getElementById("listaModoPorSite");
const padraoDica = document.getElementById("padraoDica");

let configModos = { padrao: "flutuante", porSite: {} };

function pintarConfig() {
  const padrao = configModos.padrao === "lateral" || configModos.padrao === "ambos"
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
    ["padrao", "flutuante", "lateral", "ambos"].forEach((valor) => {
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
    configModos.padrao = cfg.padrao === "lateral" || cfg.padrao === "ambos" ? cfg.padrao : "flutuante";
    configModos.porSite = (cfg.porSite && typeof cfg.porSite === "object") ? { ...cfg.porSite } : {};
  }
  configModos._extras = Array.isArray(res.ccTools_sitesPermitidos) ? res.ccTools_sitesPermitidos : [];
  pintarConfig();
});
