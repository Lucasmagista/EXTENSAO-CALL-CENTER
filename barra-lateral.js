// Barra lateral injetada (estilo WA Web Plus): um ícone fixo na borda
// esquerda da página abre um painel deslizante com todas as ferramentas.
// Só aparece quando a forma de acesso escolhida é "lateral"; a troca de
// modo é aplicada na hora, sem recarregar a página.
(function () {
  // Evita dupla injeção (script estático + dinâmico na mesma aba)
  if (window.__cctoolsBarraAtiva) return;
  // UI só no frame principal — iframes não devem ter botão/rail próprio
  if (window.top !== window) return;
  window.__cctoolsBarraAtiva = true;

  var CONFIG_KEY = "ccTools_configModos";
  var LEGADO_MODO_KEY = "ccTools_modoAcesso";
  var VOLUME_KEY = "ccTools_volume";
  var SITES_KEY = "ccTools_sitesPermitidos";
  var SITES_BASE = [
    "https://web.whatsapp.com",
    "https://chat.oquei.com.br",
    "https://elleven.oquei.com.br",
    "https://oquei.sz.chat"
  ];

  var btn = null;
  var painel = null;
  var statusEl = null;
  var statusTimer = null;
  var aberto = false;

  function acoes() {
    return window.__cctoolsAcoes;
  }

  function mostrarStatus(texto) {
    if (!statusEl) return;
    statusEl.textContent = texto;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { statusEl.textContent = ""; }, 4000);
  }

  function abrir() {
    if (!painel) return;
    painel.classList.add("aberto");
    aberto = true;
    atualizarSite();
  }

  function fechar() {
    if (!painel) return;
    painel.classList.remove("aberto");
    aberto = false;
  }

  function alternar() {
    if (aberto) fechar();
    else abrir();
  }

  function atualizarSite() {
    var el = document.getElementById("cctools-barra-site");
    if (!el) return;
    var origem = location.origin;
    if (SITES_BASE.indexOf(origem) !== -1) {
      el.innerHTML = icoSvg("check") + " Snippets ativos neste site.";
      return;
    }
    try {
      chrome.storage.local.get([SITES_KEY], function (res) {
        var extras = Array.isArray(res[SITES_KEY]) ? res[SITES_KEY] : [];
        el.innerHTML = extras.indexOf(origem) !== -1
          ? icoSvg("check") + " Snippets ativos neste site."
          : icoSvg("message-circle") + " Ative os snippets de outros sites pela popup (ícone da extensão).";
      });
    } catch (e) {
      el.innerHTML = icoSvg("message-circle") + " Ative os snippets de outros sites pela popup.";
    }
  }

  // Ícones Lucide (mesmos SVGs de animateicons.in/icons/lucide) — embutidos
  // porque o CSP da MV3 não deixa carregar ícone remoto.
  var ICO = {
    "check": "<path d=\"M20 6 9 17l-5-5\"/>",
    "send": "<path d=\"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z\"/><path d=\"m21.854 2.147-10.94 10.939\"/>",
    "settings": "<path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
    "clipboard": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><path d=\"M12 11h4\"/><path d=\"M12 16h4\"/><path d=\"M8 11h.01\"/><path d=\"M8 16h.01\"/>",
    "message-circle": "<path d=\"M7.9 20A9 9 0 1 0 4 16.1L2 22Z\"/>",
    "file": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"/><path d=\"M14 2v4a2 2 0 0 0 2 2h4\"/><path d=\"M10 9H8\"/><path d=\"M16 13H8\"/><path d=\"M16 17H8\"/>",
    "router": "<rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\"/><path d=\"M6.01 18H6\"/><path d=\"M10.01 18H10\"/><path d=\"M15 10v4\"/><path d=\"M17.84 7.17a4 4 0 0 0-5.66 0\"/><path d=\"M20.66 4.34a8 8 0 0 0-11.31 0\"/>",
    "wifi": "<path d=\"M12 20h.01\"/><path d=\"M2 8.82a15 15 0 0 1 20 0\"/><path d=\"M5 12.859a10 10 0 0 1 14 0\"/><path d=\"M8.5 16.429a5 5 0 0 1 7 0\"/>",
    "link": "<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/>",
    "arrow-right": "<path d=\"M5 12h14\"/><path d=\"m12 5 7 7-7 7\"/>",
    "volume": "<path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\"/><path d=\"M16 9a5 5 0 0 1 0 6\"/><path d=\"M19.364 18.364a9 9 0 0 0 0-12.728\"/>",
    "panel": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M15 3v18\"/>",
    "puzzle": "<path d=\"M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z\"/>",
    "wrench": "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\"/>",
    "x": "<path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/>"
  };

  function escHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function icoSvg(nome) {
    return ICO[nome]
      ? '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[nome] + "</svg>"
      : "";
  }

  function botaoAcao(texto, acao, classes, extra, icone) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "barra-acao" + (classes ? " " + classes : "");
    b.innerHTML = (icone ? icoSvg(icone) : "") + "<span>" + escHtml(texto) + "</span>";
    b.dataset.acao = acao;
    if (extra && extra.url) b.dataset.url = extra.url;
    return b;
  }

  function secao(titulo) {
    var d = document.createElement("div");
    d.className = "barra-secao";
    d.textContent = titulo;
    return d;
  }

  function criar() {
    if (painel || !document.body) return;
    // Remove órfãos deixados por injeção anterior (ex.: extensão recarregada)
    var orfaoBtn = document.getElementById("cctools-barra-btn");
    if (orfaoBtn && orfaoBtn.parentNode) orfaoBtn.parentNode.removeChild(orfaoBtn);
    var orfaoPainel = document.getElementById("cctools-barra-painel");
    if (orfaoPainel && orfaoPainel.parentNode) orfaoPainel.parentNode.removeChild(orfaoPainel);
    var comum = acoes();
    if (!comum) return; // quandoAcoesProntas rechama aplicarModo quando chegar

    // Ícone no trilho esquerda (GIF BonziBuddy animado, quadrado com cantos redondos)
    btn = document.createElement("button");
    btn.id = "cctools-barra-btn";
    btn.type = "button";
    btn.title = "CallCenter Tools — abrir barra lateral";
    var imgBtn = document.createElement("img");
    imgBtn.src = chrome.runtime.getURL("assets/alares-icon.webp");
    imgBtn.alt = "CallCenter Tools";
    imgBtn.draggable = false; // evita o fantasma de arraste nativo da imagem
    btn.appendChild(imgBtn);

    // Painel deslizante
    painel = document.createElement("div");
    painel.id = "cctools-barra-painel";

    var header = document.createElement("div");
    header.className = "barra-header";
    var titulo = document.createElement("div");
    titulo.className = "barra-titulo";
    titulo.innerHTML = icoSvg("wrench") + "<span>CallCenter Tools</span>";
    var btnFechar = document.createElement("button");
    btnFechar.type = "button";
    btnFechar.className = "barra-fechar";
    btnFechar.title = "Fechar";
    btnFechar.innerHTML = icoSvg("x");
    header.appendChild(titulo);
    header.appendChild(btnFechar);

    var corpo = document.createElement("div");
    corpo.className = "barra-corpo";

    // Rodízio em destaque
    corpo.appendChild(secao("Rodízio"));
    var gradeRodizio = document.createElement("div");
    gradeRodizio.className = "barra-grade";
    gradeRodizio.appendChild(botaoAcao("Enviar", "check", "destaque", null, "check"));
    gradeRodizio.appendChild(botaoAcao("Enviar PROX", "prox-enviar", null, null, "send"));
    gradeRodizio.appendChild(botaoAcao("Configurar PROX", "prox-config", null, null, "settings"));
    corpo.appendChild(gradeRodizio);

    // Ferramentas
    corpo.appendChild(secao("Ferramentas"));
    var gradeFerramentas = document.createElement("div");
    gradeFerramentas.className = "barra-grade";
    gradeFerramentas.appendChild(botaoAcao("Relatos", "relatos", null, null, "clipboard"));
    gradeFerramentas.appendChild(botaoAcao("Mensagens", "mensagens", null, null, "message-circle"));
    gradeFerramentas.appendChild(botaoAcao("Snippets", "snippets", null, null, "file"));
    gradeFerramentas.appendChild(botaoAcao("Configurar x6", "huawei", null, null, "router"));
    gradeFerramentas.appendChild(botaoAcao("Senha Wi-Fi x6", "senha-wifi", "largura-total", null, "wifi"));
    corpo.appendChild(gradeFerramentas);

    // Links úteis
    corpo.appendChild(secao("Links úteis"));
    var gradeLinks = document.createElement("div");
    gradeLinks.className = "barra-grade";
    comum.LINKS.forEach(function (l) {
      gradeLinks.appendChild(botaoAcao(l.nome, "abrir-link", "largura-total", { url: l.url }, "arrow-right"));
    });
    corpo.appendChild(gradeLinks);

    // Som
    corpo.appendChild(secao("Som"));
    var volWrap = document.createElement("label");
    volWrap.className = "barra-volume";
    volWrap.insertAdjacentHTML("afterbegin", icoSvg("volume"));
    var volInput = document.createElement("input");
    volInput.type = "range";
    volInput.min = "0";
    volInput.max = "100";
    volInput.step = "5";
    volWrap.appendChild(volInput);
    corpo.appendChild(volWrap);

    // Este site
    corpo.appendChild(secao("Este site"));
    var caixaSite = document.createElement("div");
    caixaSite.className = "barra-caixa";
    caixaSite.id = "cctools-barra-site";
    caixaSite.textContent = "Verificando site atual...";
    corpo.appendChild(caixaSite);

    // Forma de acesso
    corpo.appendChild(secao("Forma de acesso"));
    var gradeModo = document.createElement("div");
    gradeModo.className = "barra-grade";
    gradeModo.appendChild(botaoAcao("Usar botão flutuante", "modo-flutuante", "largura-total", null, "puzzle"));
    gradeModo.appendChild(botaoAcao("Desativar na página", "modo-nenhum", "largura-total", null, "x"));
    corpo.appendChild(gradeModo);

    statusEl = document.createElement("div");
    statusEl.className = "barra-status";
    corpo.appendChild(statusEl);

    var footer = document.createElement("div");
    footer.className = "barra-footer";
    footer.appendChild(document.createTextNode("Criado por "));
    [["Mometto", "https://github.com/lv777x"], ["Diogo", "https://github.com/PaulaoMecanicas11"]].forEach(function (par, idx) {
      if (idx > 0) footer.appendChild(document.createTextNode(" e "));
      var linkCriador = document.createElement("a");
      linkCriador.href = par[1];
      linkCriador.target = "_blank";
      linkCriador.rel = "noopener noreferrer";
      linkCriador.textContent = par[0];
      footer.appendChild(linkCriador);
    });
    footer.appendChild(document.createTextNode(" — "));
    var linkMagista = document.createElement("a");
    linkMagista.href = "https://www.magista.dev/";
    linkMagista.target = "_blank";
    linkMagista.rel = "noopener noreferrer";
    linkMagista.textContent = "Magista";
    footer.appendChild(linkMagista);

    painel.appendChild(header);
    painel.appendChild(corpo);
    painel.appendChild(footer);

    document.body.appendChild(btn);
    document.body.appendChild(painel);

    // Integra o gatilho na interface do site (abaixo do "+" no WhatsApp,
    // no rodapé do Rocket.Chat, etc.) e se reposiciona sozinho
    try {
      var motor = window.__cctoolsPosicionamento;
      if (motor && typeof motor.integrarRail === "function") motor.integrarRail(btn);
    } catch (e) { /* mantém posição padrão */ }

    // Volume (mesmo storage da popup e do botão flutuante)
    try {
      chrome.storage.local.get([VOLUME_KEY], function (res) {
        var v = typeof res[VOLUME_KEY] === "number" ? res[VOLUME_KEY] : 70;
        volInput.value = v;
      });
    } catch (e) { /* ignora */ }
    volInput.addEventListener("input", function () {
      try { chrome.storage.local.set({ [VOLUME_KEY]: Number(volInput.value) }); } catch (e) { /* ignora */ }
    });

    // Interações
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      alternar();
    });
    btnFechar.addEventListener("click", function (ev) {
      ev.stopPropagation();
      fechar();
    });

    corpo.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var alvo = ev.target.closest(".barra-acao");
      if (!alvo) return;
      var acao = alvo.dataset.acao;
      var extra = alvo.dataset.url ? { url: alvo.dataset.url } : null;
      acoes().executar(acao, mostrarStatus, extra);
      // Fecha sozinho só nas ações que navegam pra fora
      if (acao === "abrir-link" || acao === "senha-wifi" || acao === "snippets" ||
          acao === "modo-flutuante" || acao === "modo-nenhum" ||
          acao === "relatos" || acao === "mensagens") {
        fechar();
      }
    });

    // Escape fecha o painel
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && aberto) {
        fechar();
        ev.stopPropagation();
      }
    }, true);

    // Atalho vindo do background (Alt+X no Chrome)
    try {
      chrome.runtime.onMessage.addListener(function (message) {
        if (message && message.type === "toggleBarraLateral") alternar();
      });
    } catch (e) { /* ignora */ }
  }

  function versaoExtensao() {
    try { return chrome.runtime.getManifest().version; } catch (e) { return "?"; }
  }

  // Se ferramentas-comuns.js não rodou (manifesto antigo em cache), pede a
  // injeção ao background e re-tenta por ~2s antes de desistir
  function quandoAcoesProntas(cb) {
    var n = 0;
    var t = setInterval(function () {
      if (acoes()) { clearInterval(t); cb(); return; }
      n++;
      if (n === 1) {
        try {
          chrome.runtime.sendMessage({ type: "carregarAcoes" }, function () {
            void chrome.runtime.lastError;
          });
        } catch (e) { /* ignora */ }
      }
      if (n >= 20) {
        clearInterval(t);
        console.warn("[CCTools Barra] ferramentas-comuns.js não carregou (extensão v" + versaoExtensao() +
          "). Recarregue a extensão em chrome://extensions (⟳) e atualize a página.");
      }
    }, 100);
  }

  function aplicarModo(modo) {
    if (!acoes()) {
      quandoAcoesProntas(function () { aplicarModo(modo); });
      return;
    }
    criar();
    if (!painel) return;
    // "lateral" e "ambos" mostram o 🧰; só "flutuante" esconde
    if (modo === "lateral" || modo === "ambos") {
      btn.classList.remove("fab-oculto");
      btn.style.display = "";
      painel.classList.remove("fab-oculto");
      painel.style.display = "";
    } else {
      btn.classList.add("fab-oculto");
      btn.style.display = "none";
      painel.classList.add("fab-oculto");
      painel.style.display = "none";
      fechar();
    }
  }

  try {
    var modos = window.__cctoolsModos;
    if (modos) {
      modos.resolver(aplicarModo);
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === "local" && (changes[CONFIG_KEY] || changes[LEGADO_MODO_KEY])) {
          modos.resolver(aplicarModo);
        }
      });
    } else {
      aplicarModo("flutuante");
    }
  } catch (e) {
    console.warn("[CCTools Barra] chrome.storage indisponível:", e);
  }
})();
