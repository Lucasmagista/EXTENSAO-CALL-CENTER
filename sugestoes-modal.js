// Content script da modal "Sugestões" (injetado pelo background junto com
// SUGESTOES MODAL.html). Cuida só da interface do formulário: validação
// (nome obrigatório, texto ≥10, email se preenchido precisa parecer email)
// e envio do payload completo para o background, que monta a mensagem
// padrão e fala com a Evolution API. A caixa do admin no rodapé abre a
// modal "WhatsApp do Suporte" com a senha do proprietário.
(function () {
  "use strict";

  var statusTimer = null;
  var emailConfirmado = false; // precisa confirmar antes de enviar com email
  var adminVerificando = false; // um "Entrar" por vez

  // O conteúdo da modal mora dentro de um Shadow DOM: procura primeiro no
  // documento (host) e depois dentro da sombra do corpo.
  function $(id) {
    var direto = document.getElementById(id);
    if (direto) return direto;
    var corpo = document.getElementById("cc-sugestoes-corpo");
    return (corpo && corpo.shadowRoot) ? corpo.shadowRoot.getElementById(id) : null;
  }
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
  // Área do admin: a senha é verificada NO FUNDO da extensão (PBKDF2 + o
  // bloqueio por tentativas é persistente); aqui só chega o resultado. Com
  // a senha certa o fundo emite um token e libera a modal do suporte.
  // =====================================================
  function adminMostrar(msg) {
    setText("sg-admin-status", msg || "");
  }

  function adminEntrar() {
    if (adminVerificando) return;
    var valor = ($("sg-admin-senha").value || "").trim();
    if (!valor) {
      adminMostrar("Digite a senha.");
      return;
    }
    adminVerificando = true;
    adminMostrar("Verificando…");
    enviar({ type: "adminValidarSenha", senha: valor }).then(function (resp) {
      adminVerificando = false;
      $("sg-admin-senha").value = "";
      if (!resp) {
        adminMostrar("Não foi possível verificar — tente de novo.");
        return;
      }
      if (resp.bloqueado) {
        adminMostrar("Muitas tentativas erradas — bloqueado por " + (resp.aguarde || 180) + "s.");
        return;
      }
      if (!resp.ok) {
        if (resp.senhaIncorreta) {
          adminMostrar(resp.restantes > 0
            ? "Senha incorreta (" + (5 - resp.restantes) + "/5)."
            : "Senha incorreta.");
        } else {
          adminMostrar(resp.error || "Senha incorreta.");
        }
        $("sg-admin-senha").focus();
        return;
      }
      adminMostrar("Abrindo a configuração do suporte…");
      enviar({ type: "mostrarModalSuporte" }).then(function (r2) {
        if (!r2 || !r2.ok) {
          adminMostrar((r2 && r2.error) || "Abra o WhatsApp Web ou o chat da empresa.");
          return;
        }
        // a modal do suporte substitui esta na mesma página
      });
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
