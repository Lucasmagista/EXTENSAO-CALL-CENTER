// ADMIN MODAL — content script injetado pelo background junto com a
// ADMIN MODAL.html (mesmo padrão das modais do PROX/Sugestoes: o HTML vive em
// Shadow DOM e este script roda no mundo isolado, conversando com o fundo via
// runtime.sendMessage). A senha é verificada SÓ no background (PBKDF2); a
// sessão dura 8h (adminTemSessao) e pode ser encerrada com "Sair do admin".
//
// Os catálogos ACOES/ICONES_DISP aqui são espelhos do popup.js (só nomes —
// este editor nunca executa ações); o smoke test garante que não divirjam.
(function () {
  "use strict";

  // Liga no conteúdo da sombra injetada pelo background
  const raiz = document.getElementById("cc-admin-modal");
  const corpo = raiz && raiz.querySelector("#cc-admin-corpo");
  const doc = corpo && corpo.shadowRoot;
  if (!doc) return;

  const mostrar = (el) => el.classList.remove("oculto");
  const ocultar = (el) => el.classList.add("oculto");

  function svgIco(nome) {
    return '<svg aria-hidden="true"><use href="#i-' + nome + '"/></svg>';
  }

  function esc(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Espelho (nomes) do catálogo do popup.js — ver smoke-admin-popup.js
  const ACOES = {
    "check": { nome: "Enviar ✅", icone: "check" },
    "enviar-prox": { nome: "Enviar PROX", icone: "send" },
    "config-prox": { nome: "Configurar PROX", icone: "sliders" },
    "tela-relatos": { nome: "Relatos / Mensagens", icone: "message" },
    "relatos": { nome: "Relatos", icone: "clipboard" },
    "mensagens": { nome: "Mensagens", icone: "message-circle" },
    "snippets": { nome: "Snippets", icone: "file" },
    "huawei": { nome: "Configurar x6", icone: "router" },
    "senha-wifi": { nome: "Senha Wi-Fi x6", icone: "wifi" },
    "sugestoes": { nome: "Sugestões", icone: "lightbulb" },
    "abrir-url": { nome: "Abrir link", icone: "link" }
  };

  const ICONES_DISP = ["check", "send", "sliders", "message", "message-circle", "link", "router", "wifi", "file", "lightbulb", "volume", "puzzle", "panel", "grid", "crosshair", "clipboard", "users", "music", "settings", "eye", "eye-off", "check-circle"];

  // ==========================================
  // CONFIGURAÇÃO DOS BOTÕES (ccTools_uiCustom)
  // ==========================================
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

  function salvarCfgUi() {
    chrome.storage.local.set({ [UI_CUSTOM_KEY]: { proxVisivel: cfgUi.proxVisivel, botoes: cfgUi.botoes } });
  }

  // ==========================================
  // PORTÃO DE SENHA
  // ==========================================
  const adminGate = doc.getElementById("admin-gate");
  const adminEditor = doc.getElementById("admin-editor");
  const adminSenha = doc.getElementById("admin-senha");
  const adminGateErro = doc.getElementById("admin-gate-erro");
  const adminLista = doc.getElementById("admin-lista");
  let adminAberto = false; // sessão válida nesta janela

  function mostrarErroGate(msg) {
    adminGateErro.textContent = msg;
    adminGateErro.classList.remove("oculto");
  }

  function abrirAdmin() {
    adminAberto = false;
    adminGateErro.classList.add("oculto");
    adminSenha.value = "";
    // Já tem sessão válida? Pula a senha.
    chrome.runtime.sendMessage({ type: "adminTemSessao" }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.ok || !resp.ativo) {
        ocultar(adminEditor);
        mostrar(adminGate);
        adminSenha.focus();
        return;
      }
      entrarNoEditor();
    });
  }

  function entrarNoEditor() {
    adminAberto = true;
    ocultar(adminGate);
    mostrar(adminEditor);
    pintarAdmin();
  }

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

  doc.getElementById("btn-admin-entrar").addEventListener("click", () => tentarEntrarAdmin());
  adminSenha.addEventListener("keydown", (e) => { if (e.key === "Enter") tentarEntrarAdmin(); });

  doc.getElementById("btn-admin-sair").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "adminSair" }, () => {
      void chrome.runtime.lastError;
      adminAberto = false;
      ocultar(adminEditor);
      mostrar(adminGate);
      adminSenha.focus();
    });
  });

  // ==========================================
  // EDITOR
  // ==========================================
  doc.getElementById("btn-admin-add").addEventListener("click", () => {
    cfgUi.botoes.push({ id: idNovo(), tipo: "link", rotulo: "Novo botão", acao: "abrir-url", url: "", icone: "link", visivel: true });
    salvarCfgUi();
    pintarAdmin();
  });

  doc.getElementById("btn-admin-add-menu").addEventListener("click", () => {
    cfgUi.botoes.push({ id: idNovo(), tipo: "menu", rotulo: "Novo submenu", icone: "grid", visivel: true, itens: [] });
    salvarCfgUi();
    pintarAdmin();
  });

  doc.getElementById("btn-admin-reset").addEventListener("click", () => {
    cfgUi = { proxVisivel: true, botoes: botoesPadrao() };
    chrome.storage.local.remove([UI_CUSTOM_KEY], () => {
      pintarAdmin();
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
    adminLista.appendChild(montarLinhaProx());
    cfgUi.botoes.forEach((b, idx) => {
      adminLista.appendChild(montarItemAdmin(b, idx));
    });
  }

  function botaoIcone(titulo, icone, onclick, desabilitado) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ad-ico-btn";
    btn.title = titulo;
    btn.setAttribute("aria-label", titulo);
    btn.innerHTML = svgIco(icone);
    if (desabilitado) btn.disabled = true;
    else btn.addEventListener("click", onclick);
    return btn;
  }

  function montarLinhaProx() {
    const wrap = document.createElement("div");
    wrap.className = "ad-item" + (cfgUi.proxVisivel ? "" : " ad-oculto");
    const topo = document.createElement("div");
    topo.className = "ad-linha-topo";
    const ico = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ico.setAttribute("class", "ad-ico-prev");
    ico.innerHTML = '<use href="#i-send"/>';
    const nome = document.createElement("span");
    nome.className = "ad-nome";
    nome.textContent = "Enviar PROX";
    const tipo = document.createElement("span");
    tipo.className = "ad-tipo";
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
    wrap.className = "ad-item" + (b.visivel === false ? " ad-oculto" : "");
    const topo = document.createElement("div");
    topo.className = "ad-linha-topo";

    // Mover ↑ ↓
    topo.appendChild(botaoIcone("Subir", "cima", () => moverBotao(b.id, -1), idx === 0));
    topo.appendChild(botaoIcone("Descer", "baixo", () => moverBotao(b.id, 1), idx === cfgUi.botoes.length - 1));

    // Ícone atual
    const ico = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ico.setAttribute("class", "ad-ico-prev");
    ico.innerHTML = '<use href="#i-' + esc(b.icone || "check") + '"/>';
    topo.appendChild(ico);

    const nome = document.createElement("span");
    nome.className = "ad-nome";
    nome.textContent = b.rotulo || "(sem nome)";
    topo.appendChild(nome);

    const tipo = document.createElement("span");
    tipo.className = "ad-tipo";
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
    form.className = "ad-form oculto";

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
          linha.className = "ad-item-link";
          const inpNome = document.createElement("input");
          inpNome.type = "text";
          inpNome.placeholder = "Nome";
          inpNome.value = it.nome || "";
          inpNome.addEventListener("change", () => { it.nome = inpNome.value.slice(0, 40); salvarCfgUi(); });
          const inpUrl = document.createElement("input");
          inpUrl.type = "text";
          inpUrl.className = "ad-inp-url";
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
      btnAddItem.className = "ad-add-item";
      btnAddItem.textContent = "+ Adicionar item";
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
    wrap.className = "ad-campo-box";
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
    wrap.className = "ad-campo-box";
    const lbl = document.createElement("label");
    lbl.textContent = rotulo;
    const sel = document.createElement("select");
    sel.className = "ad-campo";
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

  // BOOT — carrega a config e abre no portão (ou no editor, com sessão ativa)
  chrome.storage.local.get([UI_CUSTOM_KEY], (res) => {
    cfgUi = normalizarCfgUi(res[UI_CUSTOM_KEY]);
    abrirAdmin();
  });
})();
