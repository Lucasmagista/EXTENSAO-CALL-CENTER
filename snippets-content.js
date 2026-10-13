// Expande snippets configurados na dashboard assim que o atalho fica completo
(function () {
  // Evita dupla injeção (content script estático + dinâmico na mesma aba):
  // sem essa guarda os listeners seriam registrados duas vezes.
  if (window.__cctoolsSnippetsAtivo) return;
  window.__cctoolsSnippetsAtivo = true;

  var STORAGE_KEY = "ccTools_snippets";
  var TAG = "[CCTools Snippets]";
  var snippetsMap = {};
  var bloqueado = false;
  var ultimoElExpandido = null;
  var ultimoTempoExpandido = 0;
  var COOLDOWN_MS = 500;

  // Função isolada para tocar som sem bloquear o código principal
  function tocarSom() {
    setTimeout(function() {
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          // Usa a promessa nativa do Manifest V3 para capturar erros silenciosamente
          chrome.runtime.sendMessage({ 
            type: "playSnippetAudio", 
            audio: "bonk-djlunatique.com_.mp3" 
          }).catch(function() { /* Ignora erros de conexão no console */ });
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
        if (s && s.atalho) snippetsMap[s.atalho.toLowerCase()] = s.conteudo || "";
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

  function expandir(el, textoSnippet, charsToApagar) {
    var agora = Date.now();
    if (el === ultimoElExpandido && (agora - ultimoTempoExpandido) < COOLDOWN_MS) {
      return;
    }
    ultimoElExpandido = el;
    ultimoTempoExpandido = agora;

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

        tocarSom();
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