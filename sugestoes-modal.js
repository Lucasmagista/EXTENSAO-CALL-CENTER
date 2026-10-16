// Content script da modal "Sugestões" (injetado pelo background junto com
// SUGESTOES MODAL.html). Cuida só da interface do formulário: validação
// (nome obrigatório, texto ≥10, email se preenchido precisa parecer email)
// e envio do payload completo para o background, que monta a mensagem
// padrão e fala com a Evolution API. A caixa do admin no rodapé abre a
// modal "WhatsApp do Suporte" com a senha do proprietário.
(function () {
  "use strict";

  var SENHA_ADMIN = [48,53,49,50,49,56,101,115,115].map(function (c) { return String.fromCharCode(c); }).join("");
  var statusTimer = null;
  var emailConfirmado = false; // precisa confirmar antes de enviar com email

  function $(id) { return document.getElementById(id); }
  function setText(id, txt) { var el = $(id); if (el) el.textContent = txt; }

  function mostrarStatus(msg, classe) {
    var el = $("sg-status");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "sg-status" + (classe ? " " + classe : "");
    if (statusTimer) clearTimeout(statusTimer);
    if (msg) {
      statusTimer = setTimeout(function () {
        if (el) { el.textContent = ""; el.className = "sg-status"; }
      }, 6000);
    }
  }

  function enviar(msg) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(msg, function (resp) {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(resp || null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  // Email DEVE ser email de verdade: parte local + @ + domínio + ponto +
  // TLD de pelo menos 2 letras — nada de "oi", "ana@" ou "ana@empresa".
  function emailValido(v) {
    return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$/.test(v);
  }

  // =====================================================
  // Confirmação do email: antes de enviar, a pessoa confirma se o email
  // preenchido é o mesmo onde quer receber as notificações do suporte.
  // =====================================================
  function mostrarConfirmacao(email) {
    var box = $("sg-confirma");
    if (!box) return;
    setText("sg-confirma-texto", "");
    var p = $("sg-confirma-texto");
    if (p) {
      p.innerHTML = "";
      p.appendChild(document.createTextNode("Confirma que "));
      var b = document.createElement("strong");
      b.textContent = email;
      p.appendChild(b);
      p.appendChild(document.createTextNode(" é o email onde você quer receber as notificações do suporte?"));
    }
    box.classList.remove("oculto");
    var ok = $("sg-confirma-ok");
    if (ok) ok.focus();
  }

  function esconderConfirmacao() {
    var box = $("sg-confirma");
    if (box) box.classList.add("oculto");
  }

  function enviarSugestao() {
    var nome = ($("sgNome").value || "").trim();
    var email = ($("sgEmail").value || "").trim();
    var texto = ($("sgTexto").value || "").trim();
    var btn = $("sg-btn-enviar");

    esconderConfirmacao();
    if (!nome) {
      mostrarStatus("Escreva seu nome — é obrigatório.", "sg-erro");
      $("sgNome").focus();
      return;
    }
    if (email && !emailValido(email)) {
      mostrarStatus("Isso não parece um email válido — confira (ex.: ana@empresa.com) ou deixe em branco.", "sg-erro");
      $("sgEmail").focus();
      return;
    }
    // Com email preenchido: pede a confirmação antes de enviar (uma vez
    // confirmado, vale até o email ser editado de novo).
    if (email && !emailConfirmado) {
      mostrarStatus("");
      mostrarConfirmacao(email);
      return;
    }
    if (texto.length < 10) {
      mostrarStatus("Descreva um pouco mais o que você quer adicionar (mín. 10 letras).", "sg-erro");
      $("sgTexto").focus();
      return;
    }

    btn.disabled = true;
    mostrarStatus("Enviando…");
    enviar({
      type: "enviarSugestao",
      payload: {
        funcao: $("sgFuncao").value,
        nome: nome,
        email: email,
        setor: ($("sgSetor").value || "").trim(),
        periodo: ($("sgPeriodo").value || "").trim(),
        texto: texto
      }
    }).then(function (resp) {
      btn.disabled = false;
      if (!resp) {
        mostrarStatus("Não consegui enviar agora — tente de novo em instantes.", "sg-erro");
        return;
      }
      if (resp.ok && resp.enviado) {
        mostrarStatus("✅ Sugestão enviada para o suporte! Obrigada 💚", "sg-ok");
        emailConfirmado = false;
        $("sgTexto").value = "";
        setText("sgContador", "0");
        return;
      }
      if (resp.ok && resp.copiado) {
        copiarArea(resp.texto || "").then(function (copiado) {
          if (copiado) {
            mostrarStatus("📋 Sugestão copiada! Cole no grupo de suporte do WhatsApp." + (resp.motivo ? " (" + resp.motivo + ")" : ""), "sg-ok");
            emailConfirmado = false;
          } else {
            mostrarStatus("Copie manualmente: a área de transferência não está disponível.", "sg-erro");
          }
        });
        return;
      }
      if (resp.rateLimit) {
        mostrarStatus(resp.error || "Aguarde antes de enviar de novo.", "sg-erro");
        return;
      }
      mostrarStatus(resp.error || "Não deu para enviar a sugestão.", "sg-erro");
    });
  }

  function copiarArea(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto).then(function () { return true; }).catch(function () { return false; });
    }
    return Promise.resolve(false);
  }

  // =====================================================
  // Área do admin: senha abre a modal do WhatsApp do Suporte
  // (na mesma aba — o background usa sender.tab.id)
  // =====================================================
  function adminMostrar(msg) {
    setText("sg-admin-status", msg || "");
  }

  // Blindagem: 5 senhas erradas bloqueiam a caixa por 3 minutos.
  var adminTentativas = 0;
  var adminBloqueadoAte = 0;

  function adminEntrar() {
    if (Date.now() < adminBloqueadoAte) {
      adminMostrar("Muitas tentativas — tente em " +
        Math.ceil((adminBloqueadoAte - Date.now()) / 1000) + "s.");
      return;
    }
    var valor = ($("sg-admin-senha").value || "").trim();
    if (valor !== SENHA_ADMIN) {
      adminTentativas++;
      $("sg-admin-senha").value = "";
      if (adminTentativas >= 5) {
        adminTentativas = 0;
        adminBloqueadoAte = Date.now() + 180000;
        adminMostrar("Muitas tentativas erradas — bloqueado por 3 minutos.");
      } else {
        adminMostrar("Senha incorreta (" + adminTentativas + "/5).");
      }
      $("sg-admin-senha").focus();
      return;
    }
    adminTentativas = 0;
    $("sg-admin-senha").value = "";
    adminMostrar("Abrindo a configuração do suporte…");
    enviar({ type: "mostrarModalSuporte" }).then(function (resp) {
      if (!resp || !resp.ok) {
        adminMostrar((resp && resp.error) || "Abra o WhatsApp Web ou o chat da empresa.");
        return;
      }
      // a modal do suporte substitui esta na mesma página
    });
  }

  function ligar() {
    $("sgTexto").addEventListener("input", function () {
      setText("sgContador", String(($("sgTexto").value || "").length));
    });
    $("sg-btn-enviar").addEventListener("click", enviarSugestao);
    // Email editado depois da confirmação volta a exigir confirmação
    $("sgEmail").addEventListener("input", function () {
      emailConfirmado = false;
      esconderConfirmacao();
    });
    var ok = $("sg-confirma-ok");
    if (ok) {
      ok.addEventListener("click", function () {
        emailConfirmado = true;
        esconderConfirmacao();
        enviarSugestao();
      });
    }
    var nao = $("sg-confirma-nao");
    if (nao) {
      nao.addEventListener("click", function () {
        emailConfirmado = false;
        esconderConfirmacao();
        $("sgEmail").focus();
      });
    }
    $("sg-admin-entrar").addEventListener("click", adminEntrar);
    $("sg-admin-senha").addEventListener("keydown", function (e) {
      if (e.key === "Enter") adminEntrar();
    });
    $("sgNome").focus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ligar);
  } else {
    ligar();
  }
})();
