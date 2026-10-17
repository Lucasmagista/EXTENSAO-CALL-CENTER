// Botão flutuante ARRASTÁVEL com todas as ferramentas do CallCenter Tools.
// - Arraste o botão para qualquer canto da tela (a posição fica salva).
// - Duplo clique recentraliza na posição padrão.
// - Só aparece quando a forma de acesso escolhida é "flutuante"; a troca de
//   modo é aplicada na hora, sem recarregar a página.
// As ações em si moram em ferramentas-comuns.js.
(function () {
  // Evita dupla injeção (script estático + dinâmico na mesma aba)
  if (window.__cctoolsFabAtivo) return;
  // UI só no frame principal — iframes (ads, painéis embutidos, about:blank)
  // não devem receber botão próprio; era isso que gerava vários botões
  if (window.top !== window) return;
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

  // Ícones Lucide (mesmos SVGs de animateicons.in/icons/lucide) — embutidos
  // aqui porque o CSP da MV3 não deixa carregar código/ícone remoto.
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

  function botaoAcao(texto, acao, icone) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "fab-acao";
    b.innerHTML = (icone ? icoSvg(icone) : "") + "<span>" + escHtml(texto) + "</span>";
    if (acao) b.dataset.acao = acao;
    return b;
  }

  function criarEstrutura() {
    if (raiz || !document.body) return;
    // Remove órfão deixado por injeção anterior (ex.: extensão recarregada)
    var orfao = document.getElementById("cctools-fab");
    if (orfao && orfao.parentNode) orfao.parentNode.removeChild(orfao);
    if (!acoes()) return; // quandoAcoesProntas rechama aplicarModo quando chegar

    raiz = document.createElement("div");
    raiz.id = "cctools-fab";

    btn = document.createElement("button");
    btn.id = "cctools-fab-btn";
    btn.type = "button";
    btn.title = "CallCenter Tools — arraste para mover";
    var imgBtn = document.createElement("img");
    imgBtn.src = chrome.runtime.getURL("assets/alares-icon.webp");
    imgBtn.alt = "CallCenter Tools";
    imgBtn.draggable = false; // arraste nativo da imagem não pode roubar o arraste do botão
    btn.appendChild(imgBtn);

    menu = document.createElement("div");
    menu.id = "cctools-fab-menu";
    menu.className = "fab-oculto";

    var titulo = document.createElement("div");
    titulo.className = "fab-titulo";
    titulo.textContent = "CallCenter Tools";
    menu.appendChild(titulo);

    // Rodízio
    menu.appendChild(botaoAcao("Enviar", "check", "check"));
    menu.appendChild(botaoAcao("Enviar PROX", "prox-enviar", "send"));
    menu.appendChild(botaoAcao("Configurar PROX", "prox-config", "settings"));

    menu.appendChild(document.createElement("div")).className = "fab-divisoria";

    // Ferramentas de atendimento
    menu.appendChild(botaoAcao("Relatos", "relatos", "clipboard"));
    menu.appendChild(botaoAcao("Mensagens", "mensagens", "message-circle"));
    menu.appendChild(botaoAcao("Snippets", "snippets", "file"));
    menu.appendChild(botaoAcao("Configurar x6", "huawei", "router"));
    menu.appendChild(botaoAcao("Senha Wi-Fi x6", "senha-wifi", "wifi"));

    // Links (abre submenu com os 3 links)
    var btnLinks = botaoAcao("Links ▸", "links-toggle", "link");
    menu.appendChild(btnLinks);
    subLinks = document.createElement("div");
    subLinks.className = "fab-sub fab-oculto";
    acoes().LINKS.forEach(function (l) {
      var b = botaoAcao(l.nome, "abrir-link", "arrow-right");
      b.dataset.url = l.url;
      subLinks.appendChild(b);
    });
    menu.appendChild(subLinks);

    menu.appendChild(document.createElement("div")).className = "fab-divisoria";

    // Volume (mesmo storage da popup e da barra lateral)
    var volWrap = document.createElement("label");
    volWrap.className = "fab-volume";
    volWrap.insertAdjacentHTML("afterbegin", icoSvg("volume"));
    var volInput = document.createElement("input");
    volInput.type = "range";
    volInput.min = "0";
    volInput.max = "100";
    volInput.step = "5";
    volWrap.appendChild(volInput);
    menu.appendChild(volWrap);

    menu.appendChild(document.createElement("div")).className = "fab-divisoria";

    // Trocar forma de acesso
    menu.appendChild(botaoAcao("Usar barra lateral", "modo-lateral", "panel"));
    menu.appendChild(botaoAcao("Desativar na página", "modo-nenhum", "x"));

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
          acao === "modo-lateral" || acao === "modo-nenhum") {
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
