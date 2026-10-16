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
});

// ==========================================
// ENVIAR PROX (botão dividido: enviar + configuração)
// ==========================================
const btnProxEnviar = document.getElementById("btnProxEnviar");
const btnProxConfig = document.getElementById("btnProxConfig");
let proxInfo = { temChave: false, conectado: false, grupoNome: null };

// Ícone Lucide do sprite do popup.html (mesmos SVGs do animateicons)
function svgIco(nome) {
  return '<svg class="ico" aria-hidden="true"><use href="#i-' + nome + '"/></svg>';
}

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

btnProxEnviar.addEventListener("click", () => {
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
});

btnProxConfig.addEventListener("click", () => {
  abrirModalProx("Abrindo configuração do PROX...");
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

// Mensagens rápidas: funciona de QUALQUER tela. O painel abre na aba ativa —
// a extensão não abre nem foca aba do WhatsApp Web.
document.getElementById("btn-mensagens").addEventListener("click", () => {
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
});

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
document.getElementById("btnSugestoes").addEventListener("click", () => {
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
  ambos: "Gatilho integrado + botão arrastável nas páginas."
};
const ROTULOS_MODO = {
  padrao: "Usar padrão",
  flutuante: "Flutuante",
  lateral: "Barra lateral",
  ambos: "Ambos"
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
