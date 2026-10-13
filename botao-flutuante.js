// Botão flutuante ARRASTÁVEL com todas as ferramentas do CallCenter Tools.
// - Arraste o botão para qualquer canto da tela (a posição fica salva).
// - Duplo clique recentraliza na posição padrão.
// - Só aparece quando a forma de acesso escolhida é "flutuante"; a troca de
//   modo é aplicada na hora, sem recarregar a página.
// As ações em si moram em ferramentas-comuns.js.
(function () {
  // Evita dupla injeção (script estático + dinâmico na mesma aba)
  if (window.__cctoolsFabAtivo) return;
  window.__cctoolsFabAtivo = true;

  var CONFIG_KEY = "ccTools_configModos";
  var LEGADO_MODO_KEY = "ccTools_modoAcesso";
  var VOLUME_KEY = "ccTools_volume";
  // _v2: posição recalculada com a âncora nova da coluna do WhatsApp
  var POS_KEY = "ccTools_fabPosicao_v2";

  var raiz = null;
  var btn = null;
  var menu = null;
  var subLinks = null;
  var statusEl = null;
  var statusTimer = null;
  var pos = null;

  function acoes() {
    return window.__cctoolsAcoes;
  }

  function posicaoPadrao() {
    // Posição inteligente por site (ex.: à direita do "+" no WhatsApp)
    var motor = window.__cctoolsPosicionamento;
    if (motor && typeof motor.posicaoPadraoFab === "function") {
      try { return motor.posicaoPadraoFab(); } catch (e) { /* ignora */ }
    }
    return { x: 10, y: Math.max(60, Math.round(window.innerHeight * 0.38)) };
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function aplicarPosicao(p) {
    var x = clamp(p.x, 4, Math.max(4, window.innerWidth - 52));
    var y = clamp(p.y, 4, Math.max(4, window.innerHeight - 52));
    pos = { x: x, y: y };
    raiz.style.left = x + "px";
    raiz.style.top = y + "px";
    raiz.style.right = "auto";
    raiz.style.bottom = "auto";
  }

  function salvarPosicao() {
    try { chrome.storage.local.set({ [POS_KEY]: { x: pos.x, y: pos.y } }); } catch (e) { /* ignora */ }
  }

  function mostrarStatus(texto) {
    if (!statusEl) return;
    statusEl.textContent = texto;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { statusEl.textContent = ""; }, 4000);
  }

  function posicionarMenu() {
    menu.classList.remove("fab-oculto");
    // Mede depois de mostrar para saber o tamanho real
    var r = btn.getBoundingClientRect();
    var mw = menu.offsetWidth || 250;
    var mh = menu.offsetHeight || 420;
    var abrirDireita = (r.right + mw + 12) <= window.innerWidth;
    var abrirBaixo = (r.top + mh + 12) <= window.innerHeight;
    menu.style.left = abrirDireita ? (r.width + 8) + "px" : "auto";
    menu.style.right = abrirDireita ? "auto" : (r.width + 8) + "px";
    menu.style.top = abrirBaixo ? "0px" : "auto";
    menu.style.bottom = abrirBaixo ? "auto" : "0px";
  }

  function fecharMenu() {
    if (menu) menu.classList.add("fab-oculto");
    if (subLinks) subLinks.classList.add("fab-oculto");
  }

  function alternarMenu() {
    if (!menu) return;
    if (menu.classList.contains("fab-oculto")) posicionarMenu();
    else fecharMenu();
  }

  function botaoAcao(texto, acao) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "fab-acao";
    b.textContent = texto;
    if (acao) b.dataset.acao = acao;
    return b;
  }

  function criarEstrutura() {
    if (raiz || !document.body) return;
    if (!acoes()) return; // quandoAcoesProntas rechama aplicarModo quando chegar

    raiz = document.createElement("div");
    raiz.id = "cctools-fab";

    btn = document.createElement("button");
    btn.id = "cctools-fab-btn";
    btn.type = "button";
    btn.title = "CallCenter Tools — arraste para mover";
    var imgBtn = document.createElement("img");
    imgBtn.src = chrome.runtime.getURL("assets/logo.png");
    imgBtn.alt = "CallCenter Tools";
    btn.appendChild(imgBtn);

    menu = document.createElement("div");
    menu.id = "cctools-fab-menu";
    menu.className = "fab-oculto";

    var titulo = document.createElement("div");
    titulo.className = "fab-titulo";
    titulo.textContent = "CallCenter Tools";
    menu.appendChild(titulo);

    // Rodízio
    menu.appendChild(botaoAcao('📨 Enviar "prox"', "prox"));
    menu.appendChild(botaoAcao("✅ Enviar ✅", "check"));

    menu.appendChild(document.createElement("div")).className = "fab-divisoria";

    // Ferramentas de atendimento
    menu.appendChild(botaoAcao("📋 Relatos", "relatos"));
    menu.appendChild(botaoAcao("💬 Mensagens", "mensagens"));
    menu.appendChild(botaoAcao("📝 Snippets", "snippets"));
    menu.appendChild(botaoAcao("📡 Configurar x6", "huawei"));
    menu.appendChild(botaoAcao("🔑 Senha Wi-Fi x6", "senha-wifi"));

    // Links (abre submenu com os 3 links)
    var btnLinks = botaoAcao("🔗 Links ▸", "links-toggle");
    menu.appendChild(btnLinks);
    subLinks = document.createElement("div");
    subLinks.className = "fab-sub fab-oculto";
    acoes().LINKS.forEach(function (l) {
      var b = botaoAcao("→ " + l.nome, "abrir-link");
      b.dataset.url = l.url;
      subLinks.appendChild(b);
    });
    menu.appendChild(subLinks);

    menu.appendChild(document.createElement("div")).className = "fab-divisoria";

    // Volume (mesmo storage da popup e da barra lateral)
    var volWrap = document.createElement("label");
    volWrap.className = "fab-volume";
    volWrap.appendChild(document.createTextNode("🔊"));
    var volInput = document.createElement("input");
    volInput.type = "range";
    volInput.min = "0";
    volInput.max = "100";
    volInput.step = "5";
    volWrap.appendChild(volInput);
    menu.appendChild(volWrap);

    menu.appendChild(document.createElement("div")).className = "fab-divisoria";

    // Trocar forma de acesso
    menu.appendChild(botaoAcao("📐 Usar barra lateral", "modo-lateral"));

    statusEl = document.createElement("div");
    statusEl.className = "fab-status";
    menu.appendChild(statusEl);

    raiz.appendChild(btn);
    raiz.appendChild(menu);
    document.body.appendChild(raiz);

    // Volume
    try {
      chrome.storage.local.get([VOLUME_KEY], function (res) {
        var v = typeof res[VOLUME_KEY] === "number" ? res[VOLUME_KEY] : 70;
        volInput.value = v;
      });
    } catch (e) { /* ignora */ }
    volInput.addEventListener("input", function () {
      try { chrome.storage.local.set({ [VOLUME_KEY]: Number(volInput.value) }); } catch (e) { /* ignora */ }
    });

    // ===== Arrastar + clique =====
    var arrastando = false;
    var movido = false;
    var startX = 0, startY = 0, origLeft = 0, origTop = 0;

    btn.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      arrastando = true;
      movido = false;
      startX = e.clientX;
      startY = e.clientY;
      origLeft = raiz.offsetLeft;
      origTop = raiz.offsetTop;
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
    });

    btn.addEventListener("pointermove", function (e) {
      if (!arrastando) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!movido && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        movido = true;
        fecharMenu();
      }
      if (!movido) return;
      aplicarPosicao({ x: origLeft + dx, y: origTop + dy });
    });

    btn.addEventListener("pointerup", function (e) {
      if (!arrastando) return;
      arrastando = false;
      try { btn.releasePointerCapture(e.pointerId); } catch (err) { /* ignora */ }
      if (movido) {
        salvarPosicao();
      } else {
        alternarMenu();
      }
    });

    btn.addEventListener("pointercancel", function () {
      arrastando = false;
    });

    // Duplo clique recentraliza
    btn.addEventListener("dblclick", function () {
      aplicarPosicao(posicaoPadrao());
      salvarPosicao();
      fecharMenu();
      mostrarStatus("Posição recentralizada.");
    });

    // Ações do menu (delegadas para ferramentas-comuns.js)
    menu.addEventListener("click", function (e) {
      e.stopPropagation();
      var alvo = e.target.closest(".fab-acao");
      if (!alvo) return;
      var acao = alvo.dataset.acao;

      if (acao === "links-toggle") {
        subLinks.classList.toggle("fab-oculto");
        posicionarMenu();
        return;
      }

      var extra = alvo.dataset.url ? { url: alvo.dataset.url } : null;
      acoes().executar(acao, mostrarStatus, extra);

      // Fecha o menu nas ações que já dão retorno suficiente
      if (acao === "abrir-link" || acao === "senha-wifi" || acao === "snippets" ||
          acao === "modo-lateral") {
        fecharMenu();
      }
    });

    // Escape fecha o menu
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu && !menu.classList.contains("fab-oculto")) {
        fecharMenu();
      }
    }, true);

    // Clique fora fecha o menu
    document.addEventListener("click", function (ev) {
      if (!raiz || !raiz.isConnected) return;
      if (raiz.contains(ev.target)) return;
      fecharMenu();
    }, true);

    // Ao redimensionar a janela, mantém o botão dentro da tela
    window.addEventListener("resize", function () {
      if (pos) aplicarPosicao(pos);
    });
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
        console.warn("[CCTools Fab] ferramentas-comuns.js não carregou (extensão v" + versaoExtensao() +
          "). Recarregue a extensão em chrome://extensions (⟳) e atualize a página.");
      }
    }, 100);
  }

  function aplicarModo(modo) {
    if (!acoes()) {
      quandoAcoesProntas(function () { aplicarModo(modo); });
      return;
    }
    criarEstrutura();
    if (!raiz) return;
    // "flutuante" e "ambos" mostram o 🧩; só "lateral" esconde de vez
    if (modo === "flutuante" || modo === "ambos") {
      raiz.classList.remove("fab-oculto");
      raiz.style.display = "";
    } else {
      raiz.classList.add("fab-oculto");
      raiz.style.display = "none";
      fecharMenu();
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
    chrome.storage.local.get([POS_KEY], function (res) {
      if (raiz) {
        var p = res[POS_KEY];
        aplicarPosicao(p && typeof p.x === "number" && typeof p.y === "number" ? p : posicaoPadrao());
      }
    });
  } catch (e) {
    console.warn("[CCTools Fab] chrome.storage indisponível:", e);
  }
})();
