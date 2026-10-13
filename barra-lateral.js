// Barra lateral injetada (estilo WA Web Plus): um ícone fixo na borda
// esquerda da página abre um painel deslizante com todas as ferramentas.
// Só aparece quando a forma de acesso escolhida é "lateral"; a troca de
// modo é aplicada na hora, sem recarregar a página.
(function () {
  // Evita dupla injeção (script estático + dinâmico na mesma aba)
  if (window.__cctoolsBarraAtiva) return;
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
      el.textContent = "✅ Snippets ativos neste site.";
      return;
    }
    try {
      chrome.storage.local.get([SITES_KEY], function (res) {
        var extras = Array.isArray(res[SITES_KEY]) ? res[SITES_KEY] : [];
        el.textContent = extras.indexOf(origem) !== -1
          ? "✅ Snippets ativos neste site."
          : "💬 Ative os snippets de outros sites pela popup (ícone da extensão).";
      });
    } catch (e) {
      el.textContent = "💬 Ative os snippets de outros sites pela popup.";
    }
  }

  function botaoAcao(texto, acao, classes, extra) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "barra-acao" + (classes ? " " + classes : "");
    b.textContent = texto;
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
    var comum = acoes();
    if (!comum) return; // quandoAcoesProntas rechama aplicarModo quando chegar

    // Ícone no trilho esquerda (logo da Alares, quadrado com cantos redondos)
    btn = document.createElement("button");
    btn.id = "cctools-barra-btn";
    btn.type = "button";
    btn.title = "CallCenter Tools — abrir barra lateral";
    var imgBtn = document.createElement("img");
    imgBtn.src = chrome.runtime.getURL("assets/logo.png");
    imgBtn.alt = "CallCenter Tools";
    btn.appendChild(imgBtn);

    // Painel deslizante
    painel = document.createElement("div");
    painel.id = "cctools-barra-painel";

    var header = document.createElement("div");
    header.className = "barra-header";
    var titulo = document.createElement("div");
    titulo.className = "barra-titulo";
    titulo.textContent = "🧰 CallCenter Tools";
    var btnFechar = document.createElement("button");
    btnFechar.type = "button";
    btnFechar.className = "barra-fechar";
    btnFechar.title = "Fechar";
    btnFechar.textContent = "✕";
    header.appendChild(titulo);
    header.appendChild(btnFechar);

    var corpo = document.createElement("div");
    corpo.className = "barra-corpo";

    // Rodízio em destaque
    corpo.appendChild(secao("Rodízio"));
    var gradeRodizio = document.createElement("div");
    gradeRodizio.className = "barra-grade";
    gradeRodizio.appendChild(botaoAcao('📨 Enviar "prox"', "prox", "destaque"));
    gradeRodizio.appendChild(botaoAcao("✅ Enviar ✅", "check", "destaque"));
    corpo.appendChild(gradeRodizio);

    // Ferramentas
    corpo.appendChild(secao("Ferramentas"));
    var gradeFerramentas = document.createElement("div");
    gradeFerramentas.className = "barra-grade";
    gradeFerramentas.appendChild(botaoAcao("📋 Relatos", "relatos"));
    gradeFerramentas.appendChild(botaoAcao("💬 Mensagens", "mensagens"));
    gradeFerramentas.appendChild(botaoAcao("📝 Snippets", "snippets"));
    gradeFerramentas.appendChild(botaoAcao("📡 Configurar x6", "huawei"));
    gradeFerramentas.appendChild(botaoAcao("🔑 Senha Wi-Fi x6", "senha-wifi", "largura-total"));
    corpo.appendChild(gradeFerramentas);

    // Links úteis
    corpo.appendChild(secao("Links úteis"));
    var gradeLinks = document.createElement("div");
    gradeLinks.className = "barra-grade";
    comum.LINKS.forEach(function (l) {
      gradeLinks.appendChild(botaoAcao("→ " + l.nome, "abrir-link", "largura-total", { url: l.url }));
    });
    corpo.appendChild(gradeLinks);

    // Som
    corpo.appendChild(secao("Som"));
    var volWrap = document.createElement("label");
    volWrap.className = "barra-volume";
    volWrap.appendChild(document.createTextNode("🔊"));
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
    gradeModo.appendChild(botaoAcao("🧩 Usar botão flutuante", "modo-flutuante", "largura-total"));
    corpo.appendChild(gradeModo);

    statusEl = document.createElement("div");
    statusEl.className = "barra-status";
    corpo.appendChild(statusEl);

    var footer = document.createElement("div");
    footer.className = "barra-footer";
    footer.textContent = "Criado por Mometto e Diogo — Magista";

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
          acao === "modo-flutuante" || acao === "relatos" || acao === "mensagens") {
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
