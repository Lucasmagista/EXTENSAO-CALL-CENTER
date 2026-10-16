// Expande snippets configurados na dashboard assim que o atalho fica completo
(function () {
  // Evita dupla injeção (content script estático + dinâmico na mesma aba):
  // sem essa guarda os listeners seriam registrados duas vezes.
  if (window.__cctoolsSnippetsAtivo) return;
  window.__cctoolsSnippetsAtivo = true;

  // Som de confirmação de comando: painéis em MAIN world (resposta rápida,
  // relatos e envio ✅) disparam "cc-notificacao-sucesso" na página e aqui
  // repassamos ao background, que toca no volume do slider do popup.
  // Mesma guarda usada por background.injetarRelayNotificacao() — registra
  // uma vez só, mesmo quando os dois caminhos tentam instalar o relay.
  if (!window.__ccNotificacaoRelay) {
    window.__ccNotificacaoRelay = true;
    window.addEventListener("cc-notificacao-sucesso", function () {
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: "playNotificacao" }).catch(function () {});
        }
      } catch (err) { /* contexto da extensão recarregado no meio da aba */ }
    });
    // Caixa alta (botão "Aa" dos painéis relatos/mensagens): estado em
    // ccTools_maiusculas — o relay lê/grava porque o painel está no MAIN world.
    function lerCaps(cb) {
      try {
        chrome.storage.local.get(["ccTools_maiusculas"], function (res) {
          cb(!!(res && res.ccTools_maiusculas));
        });
      } catch (err) { cb(false); }
    }
    window.addEventListener("cc-caps-pedir", function () {
      lerCaps(function (on) {
        window.dispatchEvent(new CustomEvent("cc-caps-estado", { detail: { on: on } }));
      });
    });
    window.addEventListener("cc-caps-alternar", function () {
      lerCaps(function (on) {
        var novo = !on;
        try { chrome.storage.local.set({ ccTools_maiusculas: novo }); } catch (err) { /* storage indisponível */ }
        window.dispatchEvent(new CustomEvent("cc-caps-estado", { detail: { on: novo } }));
      });
    });
  }

  var STORAGE_KEY = "ccTools_snippets";
  var TAG = "[CCTools Snippets]";
  var snippetsMap = {};
  var bloqueado = false;
  var ultimoElExpandido = null;
  var ultimoTempoExpandido = 0;
  var COOLDOWN_MS = 500;

  // Toca o áudio configurado no snippet (se houver) ou o som de confirmação
  // padrão — ambos no volume do slider do popup. Sem bloquear o código principal.
  function tocarSom(snippet) {
    setTimeout(function() {
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          // Usa a promessa nativa do Manifest V3 para capturar erros silenciosamente
          if (snippet && snippet.audio) {
            chrome.runtime.sendMessage({
              type: "playSnippetAudio",
              audio: snippet.audio
            }).catch(function() { /* Ignora erros de conexão no console */ });
          } else {
            chrome.runtime.sendMessage({
              type: "playNotificacao"
            }).catch(function() { /* Ignora erros de conexão no console */ });
          }
        }
      } catch (err) {
        console.log(TAG, "Erro isolado no áudio:", err);
      }
    }, 10);
  }

  function carregar() {
    if (!window.chrome || !chrome.storage || !chrome.storage.local) {
      console.warn(TAG, "chrome.storage indisponível.");
      return;
    }
    chrome.storage.local.get([STORAGE_KEY], function (res) {
      var arr = Array.isArray(res[STORAGE_KEY]) ? res[STORAGE_KEY] : [];
      snippetsMap = {};
      arr.forEach(function (s) {
        // guarda o objeto inteiro (conteudo + audio) para o tocarSom()
        if (s && s.atalho) snippetsMap[s.atalho.toLowerCase()] = s;
      });
      console.log(TAG, "atalhos carregados:", Object.keys(snippetsMap));
    });
  }
  carregar();

  if (window.chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "local" && changes[STORAGE_KEY]) carregar();
    });
  }

  var TIPOS_INPUT_VALIDOS = ["text", "search", "email", "url", "tel", "number", ""];

  function elementoEhEditavel(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      var tipo = (el.type || "text").toLowerCase();
      return TIPOS_INPUT_VALIDOS.indexOf(tipo) !== -1;
    }
    return !!el.isContentEditable;
  }

  function getRaizEditavel(el) {
    if (!el) return null;
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el;
    var cur = el;
    while (cur) {
      if (cur.getAttribute && cur.getAttribute("contenteditable") === "true") return cur;
      cur = cur.parentElement;
    }
    return el.isContentEditable ? el : null;
  }

  function getTextoAntesDoCursor(el) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      return (el.value || "").substring(0, el.selectionStart);
    } else {
      var sel = window.getSelection();
      if (sel.rangeCount > 0) {
        var range = sel.getRangeAt(0);
        if (range.startContainer.nodeType === 3) {
          return range.startContainer.nodeValue.substring(0, range.startOffset);
        }
        return range.startContainer.textContent;
      }
    }
    return "";
  }

  // Escapa caracteres especiais de HTML ANTES de formatar. Sem isso, um snippet
  // com "<img src=x onerror=...>" (por engano ou por comprometimento do JSON
  // sincronizado do GitHub) seria interpretado como HTML real pela página.
  function escaparHtml(texto) {
    return String(texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatarSnippetParaHTML(texto) {
      let formatado = escaparHtml(texto);
      formatado = formatado.replace(/\*{1,2}([^*]+)\*{1,2}/g, '<strong>$1</strong>');
      formatado = formatado.replace(/\n/g, '<br>');
      return formatado;
  }

  function setValorNativo(el, texto) {
    var proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    var descritor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descritor && descritor.set) {
      descritor.set.call(el, texto);
    } else {
      el.value = texto;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function moverCursorParaFinalContentEditable(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function expandir(el, snippet, charsToApagar) {
    var agora = Date.now();
    if (el === ultimoElExpandido && (agora - ultimoTempoExpandido) < COOLDOWN_MS) {
      return;
    }
    ultimoElExpandido = el;
    ultimoTempoExpandido = agora;

    var textoSnippet = snippet && snippet.conteudo ? snippet.conteudo : "";
    bloqueado = true;
    
    // O bloco TRY...FINALLY garante que o sistema de colagem nunca fica bloqueado em caso de erro
    try {
        el.focus();

        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
            var cursor = el.selectionStart || 0;
            var valAtual = el.value || "";
            var textoAntes = valAtual.substring(0, cursor);
            var textoDepois = valAtual.substring(cursor);

            if (charsToApagar > 0) {
                textoAntes = textoAntes.slice(0, -charsToApagar);
            }

            setValorNativo(el, textoAntes + textoSnippet + textoDepois);
            
            if (typeof el.setSelectionRange === "function") {
                var novaPos = textoAntes.length + textoSnippet.length;
                try { el.setSelectionRange(novaPos, novaPos); } catch (err) {}
            }
        } else {
            var sel = window.getSelection();
            if (sel.rangeCount > 0 && document.execCommand) {
                var range = sel.getRangeAt(0);
                var textNode = range.startContainer;
                
                if (textNode.nodeType === 3 && charsToApagar > 0) {
                    var offset = range.startOffset;
                    var textoAntes = textNode.nodeValue.substring(0, offset);
                    
                    textNode.nodeValue = textoAntes.slice(0, -charsToApagar) + textNode.nodeValue.slice(offset);
                    range.setStart(textNode, offset - charsToApagar);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                
                const textoHTML = formatarSnippetParaHTML(textoSnippet);
                let sucessoHTML = false;
                
                if (textoHTML !== textoSnippet) {
                    sucessoHTML = document.execCommand("insertHTML", false, textoHTML);
                }
                if (!sucessoHTML) {
                    document.execCommand("insertText", false, textoSnippet);
                }
            } else {
                el.innerHTML = formatarSnippetParaHTML(textoSnippet);
                el.dispatchEvent(new Event("input", { bubbles: true }));
                moverCursorParaFinalContentEditable(el);
            }
        }

        tocarSom(snippet);
        console.log(TAG, "snippet expandido.");

    } catch (erroGeral) {
        console.error(TAG, "Erro grave ao colar snippet:", erroGeral);
    } finally {
        // Desbloqueia sempre, mesmo que o código acima dê erro
        setTimeout(function () { bloqueado = false; }, 50);
    }
  }

  function bateComAtalho(texto) {
    var textoMin = (texto || "").toLowerCase();
    var chaveEncontrada = null;
    Object.keys(snippetsMap).forEach(function(chave) {
        if (textoMin.endsWith(chave)) {
            chaveEncontrada = chave;
        }
    });
    return chaveEncontrada;
  }

  function aoBeforeInput(e) {
    if (bloqueado) return;
    var raiz = getRaizEditavel(e.target);
    if (!raiz || !elementoEhEditavel(raiz)) return;
    if (e.inputType !== "insertText" && e.inputType !== "insertCompositionText") return;
    if (!e.data) return;

    var textoAtual = getTextoAntesDoCursor(raiz);
    var textoFinal = textoAtual + e.data;
    var chave = bateComAtalho(textoFinal);
    if (!chave) return;

    e.preventDefault();
    e.stopPropagation();
    
    var charsToApagar = Math.max(0, chave.length - e.data.length);
    expandir(raiz, snippetsMap[chave], charsToApagar);
  }

  function aoInputOuKeyup(e) {
    if (bloqueado) return;
    var raiz = getRaizEditavel(e.target);
    if (!raiz || !elementoEhEditavel(raiz)) return;
    
    var textoAtual = getTextoAntesDoCursor(raiz);
    var chave = bateComAtalho(textoAtual);
    if (!chave) return;
    
    expandir(raiz, snippetsMap[chave], chave.length);
  }

  window.addEventListener("beforeinput", aoBeforeInput, true);
  window.addEventListener("input", aoInputOuKeyup, true);
  window.addEventListener("keyup", function (e) {
    if (e.key && e.key.length === 1) aoInputOuKeyup(e);
  }, true);

  console.log(TAG, "content script carregado");
})();