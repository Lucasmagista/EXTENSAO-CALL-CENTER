// Ações compartilhadas pelo botão flutuante e pela barra lateral.
// Carregado antes dos dois; idempotente (só define uma vez).
(function () {
  if (window.__cctoolsAcoes) return;

  var LINKS = [
    { nome: "Ramais", url: "https://docs.google.com/spreadsheets/d/1r7gK3W7Q5K-5r6qd-3sj5lklAxlcHnM7EArm-D_3Jwk/edit?pli=1&gid=1858272844#gid=1858272844" },
    { nome: "Links", url: "https://docs.google.com/spreadsheets/d/1hdpzDmJ8u1q-0JxcqQIhHcdPtNGa05IfEm-BFl3v3_k/edit?gid=0#gid=0" },
    { nome: "Recados/Roteiro", url: "https://docs.google.com/document/d/1eYtQZxso1gCsfOMilhDBHvlo2P8HBy0iTmlATlNYgRM/edit?tab=t.0" }
  ];
  var CONFIG_KEY = "ccTools_configModos";
  var LEGADO_MODO_KEY = "ccTools_modoAcesso";

  function avisar(mostrarStatus, texto) {
    if (typeof mostrarStatus === "function") mostrarStatus(texto);
  }

  function abrirUrl(url, mostrarStatus) {
    chrome.runtime.sendMessage({ type: "abrirLink", url: url }, function (resp) {
      avisar(mostrarStatus, resp && resp.ok ? "Link aberto." : (resp && resp.error) || "Falha ao abrir.");
    });
  }

  function definirModo(modo, mostrarStatus) {
    chrome.runtime.sendMessage({ type: "setModoAcesso", modo: modo }, function () {
      void chrome.runtime.lastError;
      avisar(mostrarStatus, modo === "lateral"
        ? "Barra lateral ativada (padrão)."
        : modo === "nenhum"
          ? "Sem botão na página — use o ícone do Chrome (e o atalho Alt+X)."
          : "Botão flutuante ativado (padrão).");
    });
  }

  function executar(acao, mostrarStatus, extra) {
    try {
      if (acao === "check") {
        chrome.runtime.sendMessage({ type: "runFlow", msg: "✅", tag: "check" }, function (resp) {
          avisar(mostrarStatus, resp && resp.ok ? "Comando enviado!" : (resp && resp.error) || "Falha ao enviar.");
        });
        return;
      }
      if (acao === "prox-enviar") {
        chrome.runtime.sendMessage({ type: "proxAcao" }, function (resp) {
          if (resp && resp.abrir) {
            // Ainda não está pronto (sem chave/QR/grupo): abre a modal de conexão
            chrome.runtime.sendMessage({ type: "mostrarModalProx" }, function (r2) {
              avisar(mostrarStatus, r2 && r2.ok
                ? (resp.error || "Conecte o WhatsApp (QR Code aberto).")
                : (r2 && r2.error) || (resp && resp.error) || "Abra o chat/WhatsApp para usar esta tela.");
            });
            return;
          }
          avisar(mostrarStatus, resp && resp.ok
            ? "PROX enviado para " + resp.grupo + "!"
            : (resp && resp.error) || "Falha ao enviar.");
        });
        return;
      }
      if (acao === "prox-config") {
        chrome.runtime.sendMessage({ type: "mostrarModalProx" }, function (resp) {
          avisar(mostrarStatus, resp && resp.ok
            ? "Configuração do PROX aberta."
            : (resp && resp.error) || "Abra o chat/WhatsApp para usar esta tela.");
        });
        return;
      }
      if (acao === "relatos") {
        chrome.runtime.sendMessage({ type: "runRelatos" }, function (resp) {
          avisar(mostrarStatus, resp && resp.ok ? "Relatos abertos!" : (resp && resp.error) || "Não foi possível abrir.");
        });
        return;
      }
      if (acao === "mensagens") {
        chrome.runtime.sendMessage({ type: "runQuickReplyMenu" }, function (resp) {
          avisar(mostrarStatus, resp && resp.ok ? "Mensagens abertas!" : (resp && resp.error) || "Abra o WhatsApp Web primeiro.");
        });
        return;
      }
      if (acao === "snippets") {
        chrome.runtime.sendMessage({ type: "abrirSnippets" }, function () {
          avisar(mostrarStatus, "Snippets abertos em uma aba.");
        });
        return;
      }
      if (acao === "huawei") {
        chrome.runtime.sendMessage({ type: "runHuaweiConfig" }, function (resp) {
          avisar(mostrarStatus, resp && resp.ok ? "Configurando... veja o relatório na página." : (resp && resp.error) || "Falha ao configurar.");
        });
        return;
      }
      if (acao === "senha-wifi") {
        chrome.runtime.sendMessage({ type: "mostrarModalSenhaWifi" }, function (resp) {
          avisar(mostrarStatus, resp && resp.ok ? "Senha Wi-Fi aberta!" : (resp && resp.error) || "Abra o chat da empresa para usar esta tela.");
        });
        return;
      }
      if (acao === "abrir-link" && extra && extra.url) {
        abrirUrl(extra.url, mostrarStatus);
        return;
      }
      if (acao === "modo-flutuante") {
        definirModo("flutuante", mostrarStatus);
        return;
      }
      if (acao === "modo-lateral") {
        definirModo("lateral", mostrarStatus);
        return;
      }
      if (acao === "modo-nenhum") {
        definirModo("nenhum", mostrarStatus);
      }
    } catch (e) {
      avisar(mostrarStatus, "Erro: " + e.message);
    }
  }

  window.__cctoolsAcoes = {
    LINKS: LINKS,
    executar: executar
  };

  // ==========================================
  // Modo de acesso por site
  // "flutuante" | "lateral" | "ambos" | "nenhum"
  // "nenhum" = nenhum botão injetado na página (só o ícone do Chrome)
  // Config: { padrao: "...", porSite: { "<origem>": "..." } }
  // ==========================================
  function modoEfetivo(cfg, origem) {
    var padrao = cfg && cfg.padrao;
    if (padrao !== "lateral" && padrao !== "ambos" && padrao !== "nenhum") padrao = "flutuante";
    var porSite = (cfg && cfg.porSite) || {};
    var m = porSite[origem];
    if (m === "flutuante" || m === "lateral" || m === "ambos" || m === "nenhum") return m;
    return padrao;
  }

  window.__cctoolsModos = {
    CONFIG_KEY: CONFIG_KEY,
    resolver: function (cb) {
      try {
        chrome.storage.local.get([CONFIG_KEY, LEGADO_MODO_KEY], function (res) {
          var cfg = res[CONFIG_KEY];
          if (!cfg || typeof cfg !== "object") {
            // Migração lenta: usa o modo global antigo se existir
            cfg = { padrao: res[LEGADO_MODO_KEY] === "lateral" ? "lateral" : "flutuante", porSite: {} };
          }
          cb(modoEfetivo(cfg, location.origin));
        });
      } catch (e) {
        cb("flutuante");
      }
    }
  };

  // ==========================================
  // Motor de posicionamento por site
  // Deixa o gatilho (rail da barra / posição padrão do FAB) integrado na
  // interface de cada site em vez de flutuando em cima do que não é nosso:
  //  - WhatsApp: acha o último ícone do grupo de cima da coluna esquerda
  //    (Status, Canais, Comunidades, Meta AI, WA Web Plus, ...) e se coloca
  //    logo abaixo dele
  //  - Rocket.Chat: injeta o botão ao lado da logo no rodapé da sidebar
  //  - Outros: posição padrão na lateral esquerda
  // Observa o DOM e se reposiciona sozinho (sem recarregar a página).
  // ==========================================
  window.__cctoolsPosicionamento = (function () {
    var origem = location.origin;
    var railAtual = null;
    var observer = null;
    var timerObs = null;
    var timerRetry = null;
    var tentativasRocket = 0;

    function ehWhatsapp() { return origem === "https://web.whatsapp.com"; }
    function ehRocket() {
      return origem === "https://chat.oquei.com.br" || origem === "https://oquei.sz.chat";
    }

    function ehNosso(el) {
      return !!(el && el.closest && el.closest("#cctools-barra-btn, #cctools-fab, #cctools-barra-painel"));
    }

    // WhatsApp: "amostra a tela" da coluna esquerda com elementsFromPoint.
    // Isso enxerga QUALQUER coisa pintada ali — botão do WhatsApp, ícone da
    // Meta AI, o "+" da WA Web Plus (que é uma div, não um <button>), etc.
    // Acha o último ícone do grupo de cima (antes do vazio grande que separa
    // Ajustes/Perfil, no rodapé) e devolve o retângulo dele.
    function pontoOcupado(x, y) {
      var els = null;
      try { els = document.elementsFromPoint(x, y); } catch (e) { return null; }
      if (!els) return null;
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (ehNosso(el)) continue;
        var r = el.getBoundingClientRect();
        // Só conteúdo do tamanho de um ícone — ignora a coluna de fundo
        if (r.width < 14 || r.width > 90) continue;
        if (r.height < 14 || r.height > 120) continue;
        if (r.left > 70 || r.right < 4) continue; // fora da coluna
        return r;
      }
      return null;
    }

    function retanguloLivre(x, y, lado) {
      var pontos = [
        [x + 4, y + 4],
        [x + lado - 4, y + 4],
        [x + 4, y + lado - 4],
        [x + lado - 4, y + lado - 4],
        [x + lado / 2, y + lado / 2]
      ];
      for (var i = 0; i < pontos.length; i++) {
        if (pontoOcupado(pontos[i][0], pontos[i][1])) return false;
      }
      return true;
    }

    function ancoraColunaEsquerda() {
      var passo = 6;
      var ultimoOcupado = null;
      var vazioDesde = null;
      for (var y = 4; y < window.innerHeight - 4; y += passo) {
        var r = pontoOcupado(28, y);
        if (r) {
          // Vazio grande antes? então este ícone é o primeiro do grupo de
          // baixo (Ajustes/Perfil) — para aqui
          if (vazioDesde != null && y - vazioDesde > 70) break;
          ultimoOcupado = r;
          vazioDesde = null;
        } else {
          if (vazioDesde == null) vazioDesde = y;
        }
      }
      return ultimoOcupado;
    }

    // Rocket.Chat: bloco do rodapé da sidebar (logo + "Desenvolvido por...")
    function acharFooterRocket() {
      var candidatos = [];
      var todos = document.querySelectorAll("div, span, p, a, footer, section");
      for (var i = 0; i < todos.length; i++) {
        var el = todos[i];
        var t = (el.textContent || "").trim();
        if (t.length < 10 || t.length > 120) continue;
        if (t.indexOf("Desenvolvido por") === -1) continue;
        candidatos.push(el);
      }
      if (!candidatos.length) return null;
      candidatos.sort(function (a, b) {
        return (a.textContent || "").trim().length - (b.textContent || "").trim().length;
      });
      var alvo = candidatos[0];
      // Sobe até o card que contém a logo
      var no = alvo;
      for (var sobe = 0; sobe < 5; sobe++) {
        if (!no.parentElement) break;
        var pai = no.parentElement;
        no = pai;
        if (pai.querySelector("img, svg")) break;
      }
      return no;
    }

    function integrarRail(botao) {
      if (!botao) return;
      railAtual = botao;
      iniciarObservador();

      if (ehRocket()) {
        var footer = acharFooterRocket();
        if (footer) {
          tentativasRocket = 0;
          if (botao.parentElement !== footer) footer.appendChild(botao);
          botao.classList.add("cctools-integrado");
          // Cola o botão ao lado da logo, dentro do próprio rodapé
          var logo = footer.querySelector("img, svg");
          if (logo) {
            if (getComputedStyle(footer).position === "static") {
              footer.style.position = "relative";
            }
            var rLogo = logo.getBoundingClientRect();
            var rCard = footer.getBoundingClientRect();
            botao.style.position = "absolute";
            botao.style.left = Math.round(rLogo.right - rCard.left + 8) + "px";
            botao.style.top = Math.round(rLogo.top - rCard.top) + "px";
          }
          return;
        }
        // Rodapé ainda não renderizou — tenta de novo (com limite)
        agendarNovaTentativa();
      }

      if (ehWhatsapp()) {
        var ancora = ancoraColunaEsquerda();
        if (ancora) {
          var largura = 40;
          var x = Math.round(ancora.left + (ancora.width - largura) / 2);
          var y = Math.round(ancora.bottom + 10);
          // Se o lugar calculado estiver ocupado (outra extensão, badge...),
          // empurra para baixo até achar espaço livre
          var tentativas = 0;
          while (!retanguloLivre(x, y, largura) && tentativas < 15) {
            y += 10;
            tentativas++;
          }
          if (y + largura > window.innerHeight - 4) {
            y = Math.round(ancora.top - 10 - largura);
            tentativas = 0;
            while (!retanguloLivre(x, y, largura) && tentativas < 15) {
              y -= 10;
              tentativas++;
            }
            if (y < 4) y = 4;
          }
          if (botao.classList.contains("cctools-integrado")) {
            botao.classList.remove("cctools-integrado");
          }
          botao.style.position = "fixed";
          botao.style.left = x + "px";
          botao.style.top = y + "px";
          return;
        }
      }
    }

    function agendarNovaTentativa() {
      if (timerRetry) return;
      tentativasRocket++;
      if (tentativasRocket > 40) return; // ~24s de tentativas; o observer cuida do resto
      timerRetry = setTimeout(function () {
        timerRetry = null;
        if (railAtual) integrarRail(railAtual);
      }, 600);
    }

    // Posição padrão do FAB quando o usuário ainda não arrastou em lugar nenhum
    function posicaoPadraoFab() {
      if (ehWhatsapp()) {
        var ancora = ancoraColunaEsquerda();
        if (ancora) {
          return {
            x: Math.round(ancora.right + 14),
            y: Math.round(Math.max(6, ancora.top - 4))
          };
        }
        return { x: 70, y: Math.max(60, Math.round(window.innerHeight * 0.38)) };
      }
      if (ehRocket()) {
        var larguraLateral = 300;
        var sb = document.querySelector("[class*='sidebar'], aside");
        if (sb) {
          var rs = sb.getBoundingClientRect();
          if (rs.width > 80 && rs.width < 500) larguraLateral = Math.round(rs.right);
        }
        return { x: larguraLateral + 18, y: Math.max(60, window.innerHeight - 100) };
      }
      return { x: 10, y: Math.max(60, Math.round(window.innerHeight * 0.38)) };
    }

    // Re-posiciona quando a página redesenha (SPA) — sem precisar de F5
    function iniciarObservador() {
      if (observer || !document.body) return;
      observer = new MutationObserver(function () {
        if (timerObs) clearTimeout(timerObs);
        timerObs = setTimeout(function () {
          if (!railAtual) return;
          if (!railAtual.isConnected) { integrarRail(railAtual); return; }
          if (ehWhatsapp()) { integrarRail(railAtual); return; }
          // Rocket: continua tentando enquanto não conseguir integrar no rodapé
          if (ehRocket() && !railAtual.classList.contains("cctools-integrado")) {
            integrarRail(railAtual);
          }
        }, 350);
      });
      try {
        observer.observe(document.body, { childList: true, subtree: true });
      } catch (e) { /* ignora */ }
      window.addEventListener("resize", function () {
        if (railAtual) integrarRail(railAtual);
      });
    }

    return {
      integrarRail: integrarRail,
      posicaoPadraoFab: posicaoPadraoFab
    };
  })();

  console.log("[CCTools] ferramentas-comuns.js carregado — ações prontas.");
})();
