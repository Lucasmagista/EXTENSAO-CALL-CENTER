const STORAGE_KEY = "ccTools_snippets";
const IGNORADOS_KEY = "ccTools_padrao_ignorados";   // atalhos padrão que o administrador apagou (não voltam sozinhos)
const STATUS_KEY = "ccTools_padrao_status";         // resultado da última aplicação da lista padrão
const SENHA_ADMIN = [48,53,49,50,49,56,101,115,115].map(function (c) { return String.fromCharCode(c); }).join(""); // mesma senha do admin das sugestões (guardada em códigos)
const NOVO_DIAS = 7;                                // selo "NOVO" do admin vira padrão depois destes dias

let ignorados = [];
let ehAdmin = false;                                // sessão da aba (não é gravado)

let snippets = [];   // { id, atalho, titulo, conteudo, audio, padrao, editadoPorAdmin?, novoAdmin?, criadoEm? }
let ativoId = null;
let filtro = "";
let selecionados = new Set();
let ultimosFiltrados = [];

const $lista = document.getElementById("lista");
const $busca = document.getElementById("busca");
const $contagem = document.getElementById("contagem");
const $btnNovo = document.getElementById("btnNovo");
const $chkTodos = document.getElementById("chkTodos");
const $btnApagarSelecionados = document.getElementById("btnApagarSelecionados");

const $editorVazio = document.getElementById("editor-vazio");
const $editorForm = document.getElementById("editor-form");
const $campoAtalho = document.getElementById("campoAtalho");
const $campoTitulo = document.getElementById("campoTitulo");
const $campoConteudo = document.getElementById("campoConteudo");
const $btnSalvar = document.getElementById("btnSalvar");
const $btnExcluir = document.getElementById("btnExcluir");
const $msgSalvo = document.getElementById("msgSalvo");
const $campoAudio = document.getElementById("campoAudio");
const $btnTestarAudio = document.getElementById("btnTestarAudio");
const $campoPadraoWrap = document.getElementById("campoPadraoWrap");
const $campoPadrao = document.getElementById("campoPadrao");

// Visibilidade do editor/avisos via classe .oculto (definida no styles.css)
function mostrarEditor(vazio) {
  $editorVazio.classList.toggle("oculto", !vazio);
  $editorForm.classList.toggle("oculto", vazio);
}
function mostrarAvisoPadrao(visivel, texto) {
  document.getElementById("avisoPadrao").classList.toggle("oculto", !visivel);
  if (texto) document.getElementById("avisoPadraoTexto").innerHTML = texto;
}
function mostrarAvisoLocal(visivel) {
  document.getElementById("avisoLocal").classList.toggle("oculto", !visivel);
}

function ehPadrao(s) { return !!(s && s.padrao === true); }
function estaNovo(s) {
  return !!(s && s.novoAdmin && s.criadoEm && (Date.now() - s.criadoEm) < NOVO_DIAS * 86400000);
}

const VOLUME_STORAGE_KEY = "ccTools_volume";
let listaAudios = [];

// Lê assets/audios.json (lista de arquivos de áudio disponíveis na pasta assets)
async function carregarListaAudios() {
  try {
    const resp = await fetch(chrome.runtime.getURL("assets/audios.json"));
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const dados = await resp.json();
    listaAudios = Array.isArray(dados) ? dados.filter(a => typeof a === "string" && a.trim()) : [];
  } catch (e) {
    console.warn("Não foi possível ler assets/audios.json:", e);
    listaAudios = [];
  }
  preencherSelectAudio("");
}

function preencherSelectAudio(valorAtual) {
  $campoAudio.innerHTML = "";
  const nenhum = document.createElement("option");
  nenhum.value = "";
  nenhum.textContent = "Nenhum";
  $campoAudio.appendChild(nenhum);

  const nomes = listaAudios.slice();
  const faltando = valorAtual && nomes.indexOf(valorAtual) === -1;
  nomes.forEach(nome => {
    const o = document.createElement("option");
    o.value = nome;
    o.textContent = nome;
    $campoAudio.appendChild(o);
  });
  if (faltando) {
    const o = document.createElement("option");
    o.value = valorAtual;
    o.textContent = valorAtual + " (não está em audios.json)";
    $campoAudio.appendChild(o);
  }
  $campoAudio.value = valorAtual || "";
}

let audioTeste = null;
function testarAudio() {
  const arquivo = $campoAudio.value;
  if (!arquivo) { alert("Selecione um áudio para testar."); return; }
  if (!/^[\w\-. ]{1,80}\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(arquivo)) {
    alert("Arquivo de áudio inválido.");
    return;
  }
  chrome.storage.local.get([VOLUME_STORAGE_KEY], (res) => {
    const vol = typeof res[VOLUME_STORAGE_KEY] === "number" ? res[VOLUME_STORAGE_KEY] : 70;
    if (audioTeste) { audioTeste.pause(); }
    audioTeste = new Audio(chrome.runtime.getURL("assets/" + encodeURIComponent(arquivo)));
    audioTeste.volume = vol / 100;
    audioTeste.play().catch(() => alert("Não foi possível tocar o arquivo \"" + arquivo + "\". Confira se ele existe na pasta assets."));
  });
}
$btnTestarAudio.addEventListener("click", testarAudio);

// Se o snippet padrão apagado era padrão, guarda o atalho para a sincronização não recriá-lo
function registrarApagados(lista) {
  const atalhos = lista.filter(x => ehPadrao(x) && x.atalho).map(x => x.atalho);
  if (!atalhos.length) return null;
  ignorados = Array.from(new Set(ignorados.concat(atalhos)));
  return { [IGNORADOS_KEY]: ignorados };
}

function uid() {
  return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function normalizarAtalho(v) {
  v = (v || "").trim().replace(/\s+/g, "");
  if (!v) return "";
  if (!v.startsWith("/")) v = "/" + v;
  return v.toLowerCase();
}

function storageIndisponivel() {
  return !window.chrome || !chrome.storage || !chrome.storage.local;
}

function mostrarErroStorage(msg) {
  $lista.innerHTML =
    '<div style="padding:16px;color:#f87171;font-size:13px;line-height:1.5;">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> ' + escapeHtml(msg) +
    '<br><br>Vá em <strong>chrome://extensions</strong>, clique em <strong>Recarregar</strong> nesta extensão' +
    " e, se aparecer um aviso de novas permissões, clique em <strong>Manter</strong>/<strong>Permitir</strong>." +
    "</div>";
  $contagem.textContent = "Erro ao acessar armazenamento";
}

// Selo "NOVO" do admin expira -> o snippet vira padrão fixo (editadoPorAdmin
// protege ele de ser apagado/atualizado pela sincronização remota).
function expirarNovos() {
  const agora = Date.now();
  let mudou = false;
  snippets.forEach(s => {
    if (s.novoAdmin && (!s.criadoEm || agora - s.criadoEm >= NOVO_DIAS * 86400000)) {
      delete s.novoAdmin;
      s.padrao = true;
      s.editadoPorAdmin = true;
      mudou = true;
    }
  });
  return mudou;
}

function carregar() {
  if (storageIndisponivel()) {
    mostrarErroStorage("Não foi possível acessar chrome.storage (permissão 'storage' ausente ou extensão desatualizada).");
    return;
  }
  chrome.storage.local.get([STORAGE_KEY, IGNORADOS_KEY, STATUS_KEY], (res) => {
    if (chrome.runtime.lastError) {
      mostrarErroStorage("Falha ao carregar snippets: " + chrome.runtime.lastError.message);
      return;
    }
    snippets = Array.isArray(res[STORAGE_KEY]) ? res[STORAGE_KEY] : [];
    ignorados = Array.isArray(res[IGNORADOS_KEY]) ? res[IGNORADOS_KEY] : [];
    mostrarStatusSync(res[STATUS_KEY]);
    if (expirarNovos()) {
      salvarNoStorage(renderLista);
    } else {
      renderLista();
    }
  });
}

function mostrarStatusSync(st) {
  const el = document.getElementById("statusSync");
  if (!el) return;
  const fmt = (t) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (!st) { el.textContent = "Lista padrão: ainda não sincronizada"; return; }
  if (st.ok) {
    const origem = st.origem === "remoto" ? "do GitHub" : st.origem === "embutido" ? "(cópia local)" : "";
    el.textContent = "Lista padrão " + origem + " atualizada em " + fmt(st.quando);
    return;
  }
  el.textContent = "Não consegui atualizar a lista padrão (" + fmt(st.quando) + ")" +
    (st.ultimoSucesso ? " — última vez com sucesso: " + fmt(st.ultimoSucesso) : "");
}

// Quando o background aplica a lista padrão, recarrega a lista aqui sem
// perder o que está sendo digitado (o snippet em edição fica como está).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STATUS_KEY]) mostrarStatusSync(changes[STATUS_KEY].newValue);
  if (changes[IGNORADOS_KEY]) ignorados = Array.isArray(changes[IGNORADOS_KEY].newValue) ? changes[IGNORADOS_KEY].newValue : [];
  if (!changes[STORAGE_KEY]) return;
  const novos = Array.isArray(changes[STORAGE_KEY].newValue) ? changes[STORAGE_KEY].newValue : [];
  if (JSON.stringify(novos) === JSON.stringify(snippets)) return; // foi a própria página que salvou
  const emEdicao = snippets.find(x => x.id === ativoId);
  const aindaExiste = novos.find(x => x.id === ativoId);
  snippets = novos.slice();
  if (emEdicao && !aindaExiste && !emEdicao.atalho) snippets.push(emEdicao); // "novo" ainda não salvo
  renderLista();
  if (ativoId) aplicarTravasEditor();
});

function salvarNoStorage(cb, extras) {
  if (storageIndisponivel()) {
    alert("Não foi possível salvar: chrome.storage não está disponível. Recarregue a extensão em chrome://extensions.");
    return;
  }
  chrome.storage.local.set(Object.assign({ [STORAGE_KEY]: snippets }, extras || {}), () => {
    if (chrome.runtime.lastError) {
      alert("Erro ao salvar: " + chrome.runtime.lastError.message);
      return;
    }
    if (cb) cb();
  });
}

function renderLista() {
  const termo = filtro.trim().toLowerCase();
  const filtrados = snippets
    .filter(s => !termo || s.atalho.toLowerCase().includes(termo) ||
      (s.titulo || "").toLowerCase().includes(termo) ||
      (s.conteudo || "").toLowerCase().includes(termo))
    .sort((a, b) => a.atalho.localeCompare(b.atalho));

  const nPadrao = snippets.filter(ehPadrao).length;
  const nLocal = snippets.length - nPadrao;
  $contagem.textContent = nLocal + " seu" + (nLocal === 1 ? "" : "s") + " · " + nPadrao + " padrão" + (snippets.length === 1 ? " (1 snippet)" : " (" + snippets.length + " snippets)");

  $lista.innerHTML = "";
  if (!filtrados.length) {
    const vazio = document.createElement("div");
    vazio.id = "vazio";
    vazio.textContent = snippets.length ? "Nenhum snippet encontrado." : "Nenhum snippet ainda. Clique em + Novo para criar o primeiro.";
    $lista.appendChild(vazio);
    atualizarBarraSelecao(filtrados);
    return;
  }

  filtrados.forEach(s => {
    const el = document.createElement("div");
    el.className = "item" + (s.id === ativoId ? " ativo" : "");
    const preview = (s.titulo ? s.titulo + " — " : "") + (s.conteudo || "").replace(/\n/g, " ");

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "chk-item";
    chk.checked = selecionados.has(s.id);
    // Padrão nunca entra na exclusão em massa — checkbox travado
    if (ehPadrao(s)) {
      chk.disabled = true;
      chk.title = "Snippet padrão — não é apagado em massa (somente o administrador pode apagar um padrão)";
    }
    chk.addEventListener("click", (e) => e.stopPropagation());
    chk.addEventListener("change", () => {
      if (chk.checked) selecionados.add(s.id);
      else selecionados.delete(s.id);
      atualizarBarraSelecao(filtrados);
    });

    const tags = [];
    if (estaNovo(s)) tags.push('<span class="tag-novo" title="Snippet novo do administrador — vira padrão automaticamente em ' + NOVO_DIAS + ' dias">NOVO</span>');
    if (ehPadrao(s)) tags.push('<span class="tag-padrao" title="Snippet padrão (atualizado automaticamente)">padrão</span>');
    else if (!estaNovo(s)) tags.push('<span class="tag-local" title="Snippet seu — só aparece neste navegador">LOCAL</span>');
    else tags.push('<span class="tag-local" title="Snippet seu — só aparece neste navegador">LOCAL</span>');

    const textos = document.createElement("div");
    textos.className = "item-textos";
    textos.innerHTML =
      '<div class="item-shortcut">' + escapeHtml(s.atalho) + tags.join("") + '</div>' +
      '<div class="item-preview">' + escapeHtml(preview || "(vazio)") + '</div>';

    el.appendChild(chk);
    el.appendChild(textos);
    el.addEventListener("click", () => selecionar(s.id));
    $lista.appendChild(el);
  });

  atualizarBarraSelecao(filtrados);
}

function contarSelecionadosLocais() {
  let n = 0;
  selecionados.forEach(id => {
    const s = snippets.find(x => x.id === id);
    if (s && !ehPadrao(s)) n++;
  });
  return n;
}

function atualizarBarraSelecao(filtrados) {
  ultimosFiltrados = filtrados;
  // Mantém no Set apenas ids de snippets SEUS (LOCAL) que ainda existem —
  // padrão nunca entra na exclusão em massa.
  selecionados.forEach(id => {
    const s = snippets.find(x => x.id === id);
    if (!s || ehPadrao(s)) selecionados.delete(id);
  });

  const n = contarSelecionadosLocais();
  $btnApagarSelecionados.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg> Apagar selecionados (' + n + ")";
  $btnApagarSelecionados.disabled = n === 0;

  const idsVisiveisLocais = filtrados.filter(s => !ehPadrao(s)).map(s => s.id);
  const todosVisiveisSelecionados = idsVisiveisLocais.length > 0 && idsVisiveisLocais.every(id => selecionados.has(id));
  $chkTodos.checked = todosVisiveisSelecionados;
  $chkTodos.indeterminate = !todosVisiveisSelecionados && idsVisiveisLocais.some(id => selecionados.has(id));
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// Trava/destrava os campos conforme o snippet e o modo administrador
function aplicarTravasEditor() {
  const s = snippets.find(x => x.id === ativoId);
  if (!s) return;
  const bloqueado = ehPadrao(s) && !ehAdmin;
  $campoAtalho.disabled = bloqueado;
  $campoTitulo.disabled = bloqueado;
  $campoConteudo.disabled = bloqueado;
  $campoAudio.disabled = bloqueado;
  $btnTestarAudio.disabled = bloqueado;
  $btnSalvar.disabled = bloqueado;
  $btnExcluir.disabled = bloqueado;

  if (ehPadrao(s)) {
    const texto = ehAdmin
      ? 'Este é um snippet <strong>padrão</strong>. Você é o <strong>administrador</strong>: pode alterá-lo — as mudanças valem para este navegador e a lista automática não sobrescreve o que você editar.'
      : 'Este é um snippet <strong>padrão</strong> e <strong>não pode ser alterado</strong> por operadoras. Somente o administrador pode mexer nele (área abaixo da lista).';
    mostrarAvisoPadrao(true, texto);
    mostrarAvisoLocal(false);
  } else {
    mostrarAvisoPadrao(false);
    mostrarAvisoLocal(true);
  }

  // Admin pode marcar um snippet LOCAL como padrão
  const mostraMarcarPadrao = ehAdmin && !ehPadrao(s) && !!s.atalho;
  $campoPadraoWrap.classList.toggle("oculto", !mostraMarcarPadrao);
  if (mostraMarcarPadrao) $campoPadrao.checked = false;
}

function selecionar(id) {
  ativoId = id;
  const s = snippets.find(x => x.id === id);
  if (!s) return;
  mostrarEditor(false);
  $campoAtalho.value = s.atalho;
  $campoTitulo.value = s.titulo || "";
  $campoConteudo.value = s.conteudo || "";
  preencherSelectAudio(s.audio || "");
  aplicarTravasEditor();
  renderLista();
}

function novo() {
  const s = { id: uid(), atalho: "", titulo: "", conteudo: "", audio: "", padrao: false };
  if (ehAdmin) {
    s.novoAdmin = true;
    s.criadoEm = Date.now();
  }
  snippets.push(s);
  selecionar(s.id);
  $campoAtalho.focus();
}

function salvar() {
  const s = snippets.find(x => x.id === ativoId);
  if (!s) return;
  if (ehPadrao(s) && !ehAdmin) {
    alert("Somente o administrador pode alterar snippets padrão.");
    return;
  }

  const atalho = normalizarAtalho($campoAtalho.value);
  if (!atalho) {
    alert("Informe um atalho para o snippet (ex: /saudacao).");
    return;
  }
  const duplicado = snippets.find(x => x.id !== s.id && x.atalho === atalho);
  if (duplicado) {
    alert("Já existe um snippet com o atalho \"" + atalho + "\". Escolha outro.");
    return;
  }

  const novoTitulo = $campoTitulo.value.trim().slice(0, 120);
  const novoConteudo = $campoConteudo.value.slice(0, 8000);
  const novoAudio = $campoAudio.value;
  if (novoAudio && !/^[\w\-. ]{1,80}\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(novoAudio)) {
    alert("Arquivo de áudio inválido — escolha um da lista.");
    return;
  }

  // Admin editando um padrão: continua padrão (não vira LOCAL) e é marcado
  // como editado para a sincronização automática não sobrescrever.
  if (ehPadrao(s)) {
    s.editadoPorAdmin = true;
  }

  // Admin marcou um snippet LOCAL como padrão
  if (ehAdmin && !ehPadrao(s) && $campoPadrao.checked) {
    s.padrao = true;
    s.editadoPorAdmin = true;
    delete s.novoAdmin;
  }

  s.atalho = atalho;
  s.titulo = novoTitulo;
  s.conteudo = novoConteudo;
  s.audio = novoAudio;

  salvarNoStorage(() => {
    $campoAtalho.value = s.atalho;
    aplicarTravasEditor();
    renderLista();
    $msgSalvo.style.opacity = "1";
    setTimeout(() => { $msgSalvo.style.opacity = "0"; }, 1800);
  });
}

function excluir() {
  const s = snippets.find(x => x.id === ativoId);
  if (!s) return;
  if (ehPadrao(s) && !ehAdmin) {
    alert("Somente o administrador pode apagar snippets padrão.");
    return;
  }
  if (!confirm("Excluir o snippet \"" + (s.atalho || "sem atalho") + "\"?")) return;
  const extras = registrarApagados([s]);
  snippets = snippets.filter(x => x.id !== ativoId);
  ativoId = null;
  mostrarEditor(true);
  salvarNoStorage(renderLista, extras);
}

$btnNovo.addEventListener("click", novo);
$btnSalvar.addEventListener("click", salvar);
$btnExcluir.addEventListener("click", excluir);
$busca.addEventListener("input", () => { filtro = $busca.value; renderLista(); });

// ===== Área do administrador (mesma senha do admin das sugestões) =====
const $adminSenha = document.getElementById("admin-senha");
const $adminEntrar = document.getElementById("admin-entrar");
const $adminStatus = document.getElementById("admin-status");

// Blindagem contra tentativa em massa: 5 senhas erradas bloqueiam a caixa por
// 3 minutos (só esta página — memória da sessão).
let adminTentativas = 0;
let adminBloqueadoAte = 0;

function entrarAdmin() {
  if (Date.now() < adminBloqueadoAte) {
    $adminStatus.className = "erro";
    $adminStatus.textContent = "Muitas tentativas — tente em " +
      Math.ceil((adminBloqueadoAte - Date.now()) / 1000) + "s.";
    return;
  }
  const valor = $adminSenha.value.trim();
  if (!valor) {
    $adminStatus.className = "erro";
    $adminStatus.textContent = "Digite a senha.";
    return;
  }
  if (valor !== SENHA_ADMIN) {
    adminTentativas++;
    $adminSenha.value = "";
    if (adminTentativas >= 5) {
      adminTentativas = 0;
      adminBloqueadoAte = Date.now() + 180000;
      $adminStatus.className = "erro";
      $adminStatus.textContent = "Muitas tentativas erradas — área bloqueada por 3 minutos.";
    } else {
      $adminStatus.className = "erro";
      $adminStatus.textContent = "Senha incorreta (" + adminTentativas + "/5).";
    }
    return;
  }
  adminTentativas = 0;
  ehAdmin = true;
  $adminSenha.value = "";
  $adminSenha.disabled = true;
  $adminEntrar.disabled = true;
  $adminStatus.className = "ok";
  $adminStatus.textContent = "✓ Administrador ativo — você pode alterar/apagar os padrões e marcar novos como padrão.";
  if (ativoId) aplicarTravasEditor();
}
$adminEntrar.addEventListener("click", entrarAdmin);
$adminSenha.addEventListener("keydown", (e) => { if (e.key === "Enter") entrarAdmin(); });

// ===== Importar / Exportar (modal única, .txt como formato principal) =====
const $modalImpExp = document.getElementById("modalImpExp");
const $btnImpExp = document.getElementById("btnImpExp");
const $btnExportarTxt = document.getElementById("btnExportarTxt");
const $btnImportarArquivo = document.getElementById("btnImportarArquivo");
const $btnModeloTxt = document.getElementById("btnModeloTxt");
const $btnFecharImpExp = document.getElementById("btnFecharImpExp");
const $inputImportar = document.getElementById("inputImportar");

function baixarArquivo(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function montarTxtExportacao(lista) {
  const agora = new Date().toLocaleString("pt-BR");
  let out = "";
  out += "# ============================================\n";
  out += "# Snippets CallCenter Tools — exportação\n";
  out += "# Gerado em " + agora + "\n";
  out += "# Total: " + lista.length + " snippet(s) seus (tag LOCAL).\n";
  out += "# Os snippets padrão NÃO entram nesta exportação.\n";
  out += "# Formato: blocos separados por --- com\n";
  out += "# ATALHO:, TITULO:, AUDIO: e CONTEUDO:.\n";
  out += "# ============================================\n\n";
  lista.forEach(s => {
    out += "ATALHO: " + s.atalho + "\n";
    out += "TITULO: " + (s.titulo || "") + "\n";
    out += "AUDIO: " + (s.audio || "") + "\n";
    out += "CONTEUDO:\n" + (s.conteudo || "") + "\n";
    out += "---\n\n";
  });
  return out;
}

function exportarTxt() {
  const locais = snippets.filter(s => !ehPadrao(s) && s.atalho);
  if (!locais.length) {
    alert("Você ainda não tem snippets seus (tag LOCAL) para exportar.\nCrie com + Novo ou importe um arquivo.");
    return;
  }
  const data = new Date().toISOString().slice(0, 10);
  baixarArquivo("snippets-meus-" + data + ".txt", montarTxtExportacao(locais));
  fecharModalImpExp();
}

function baixarModelo() {
  const modelo =
    "# ============================================\n" +
    "# MODELO — Snippets CallCenter Tools\n" +
    "# Preencha um bloco para cada snippet e importe\n" +
    "# este arquivo na tela da extensão.\n" +
    "#\n" +
    "# REGRAS:\n" +
    "# - Linhas que começam com # são ignoradas.\n" +
    "# - --- separa um snippet do outro.\n" +
    "# - ATALHO: é obrigatório (comece com /).\n" +
    "# - TITULO: e AUDIO: são opcionais.\n" +
    "# - Depois de CONTEUDO: tudo vale como texto\n" +
    "#   (até o próximo --- ou até o fim do arquivo).\n" +
    "# - Você pode ter quantos blocos quiser.\n" +
    "# - Os snippets importados entram como LOCAL\n" +
    "#   (somente no seu navegador).\n" +
    "# ============================================\n\n" +
    "ATALHO: /exemplo\n" +
    "TITULO: Exemplo de snippet\n" +
    "AUDIO: \n" +
    "CONTEUDO:\n" +
    "Olá! Este é um exemplo de snippet.\n" +
    "Apague e coloque o seu texto aqui.\n" +
    "\n" +
    "---\n\n";
  const data = new Date().toISOString().slice(0, 10);
  baixarArquivo("modelo-snippets-" + data + ".txt", modelo);
}

// Lê o formato .txt em blocos --- (ATALHO/TITULO/AUDIO/CONTEUDO)
function parseTxtSnippets(texto) {
  const blocos = (texto || "").split(/^\s*---\s*$/m);
  const itens = [];
  blocos.forEach((bloco) => {
    const linhas = bloco.split(/\r?\n/);
    let atalho = "", titulo = "", audio = "";
    const conteudo = [];
    let emConteudo = false;
    linhas.forEach((l) => {
      if (emConteudo) { conteudo.push(l); return; }
      const t = l.trim();
      if (!t || t.startsWith("#")) return;
      const m = t.match(/^(ATALHO|TITULO|TÍTULO|AUDIO|CONTEUDO|CONTEÚDO)\s*:\s*(.*)$/i);
      if (!m) return;
      const chave = m[1].toUpperCase().replace(/Í/g, "I");
      const valor = m[2];
      if (chave === "ATALHO") atalho = valor;
      else if (chave === "TITULO") titulo = valor;
      else if (chave === "AUDIO") audio = valor;
      else { emConteudo = true; if (valor) conteudo.push(valor); }
    });
    const a = normalizarAtalho(atalho);
    if (!a) return;
    itens.push({
      atalho: a,
      titulo: (titulo || "").trim(),
      audio: (audio || "").trim(),
      conteudo: conteudo.join("\n").replace(/^\n+/, "").replace(/\s+$/, "")
    });
  });
  return itens;
}

function validarItemImportado(item) {
  return item && typeof item === "object" && typeof item.atalho === "string" && item.atalho.trim();
}

function aplicarImportacao(validos) {
  // Tamanhos defensivos: no máximo 500 itens por arquivo e campos aparados
  // (um .txt/.json gigante não enche o storage nem congela a lista).
  validos = validos.slice(0, 500);
  let adicionados = 0;
  let atualizados = 0;
  let ignoradosQtd = 0;

  validos.forEach(item => {
    const atalho = normalizarAtalho(item.atalho);
    if (!atalho) return;
    const tituloImp = (item.titulo || "").toString().trim().slice(0, 120);
    const conteudoImp = (item.conteudo || "").toString().slice(0, 8000);
    const audioBruto = typeof item.audio === "string" ? item.audio.trim() : "";
    const audioImp = /^[\w\-. ]{1,80}\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(audioBruto) ? audioBruto : "";
    const existente = snippets.find(s => s.atalho === atalho);
    if (existente) {
      if (ehPadrao(existente)) {
        // Padrão é intocável: não sobrescreve, não vira LOCAL
        ignoradosQtd++;
        return;
      }
      existente.titulo = tituloImp;
      existente.conteudo = conteudoImp;
      if (audioImp) existente.audio = audioImp;
      atualizados++;
    } else {
      snippets.push({
        id: uid(),
        atalho,
        titulo: tituloImp,
        conteudo: conteudoImp,
        audio: audioImp,
        padrao: false
      });
      adicionados++;
    }
  });

  salvarNoStorage(() => {
    renderLista();
    const extra = ignoradosQtd ? "\n" + ignoradosQtd + " ignorado(s): o atalho já é um snippet padrão (intocável)." : "";
    alert("Importação concluída: " + adicionados + " novo(s), " + atualizados + " atualizado(s)." + extra);
  });
}

$btnImpExp.addEventListener("click", () => $modalImpExp.classList.remove("oculto"));
$btnFecharImpExp.addEventListener("click", () => $modalImpExp.classList.add("oculto"));
$modalImpExp.addEventListener("click", (e) => { if (e.target === $modalImpExp) $modalImpExp.classList.add("oculto"); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$modalImpExp.classList.contains("oculto")) $modalImpExp.classList.add("oculto");
});

$btnExportarTxt.addEventListener("click", exportarTxt);
$btnModeloTxt.addEventListener("click", baixarModelo);
$btnImportarArquivo.addEventListener("click", () => {
  $inputImportar.value = "";
  $inputImportar.click();
});

$inputImportar.addEventListener("change", () => {
  const arquivo = $inputImportar.files && $inputImportar.files[0];
  if (!arquivo) return;
  if (arquivo.size > 512 * 1024) {
    alert("Arquivo muito grande (máx. 512 KB).");
    $inputImportar.value = "";
    return;
  }
  const nome = (arquivo.name || "").toLowerCase();
  const ehJson = nome.endsWith(".json") || arquivo.type === "application/json";

  const leitor = new FileReader();
  leitor.onload = () => {
    if (ehJson) {
      // Compatibilidade com o formato antigo (.json)
      let dados;
      try {
        dados = JSON.parse(leitor.result);
      } catch (err) {
        alert("Arquivo inválido: não é um JSON válido.");
        return;
      }
      if (!Array.isArray(dados)) {
        alert("Arquivo inválido: esperado um JSON com uma lista de snippets (ou use o modelo .txt).");
        return;
      }
      const validos = dados.filter(validarItemImportado);
      if (!validos.length) {
        alert("Nenhum snippet válido encontrado no arquivo.");
        return;
      }
      aplicarImportacao(validos);
      return;
    }
    // Formato principal: .txt
    const itens = parseTxtSnippets(leitor.result);
    if (!itens.length) {
      alert("Nenhum snippet encontrado no arquivo.\nConfira o formato: blocos com ATALHO:, TITULO:, AUDIO: e CONTEUDO:, separados por ---.\nVocê pode baixar o modelo na tela Importar / Exportar.");
      return;
    }
    aplicarImportacao(itens);
  };
  leitor.readAsText(arquivo);
});

// ===== Restaurar/atualizar lista padrão (embutida na extensão) =====
const $btnSincronizar = document.getElementById("btnSincronizar");
$btnSincronizar.addEventListener("click", () => {
  let restaurar = false;
  if (ignorados.length) {
    restaurar = confirm(
      "Foram apagados " + ignorados.length + " snippet(s) padrão antes.\n\n" +
      "OK = restaurá-los junto com a atualização\nCancelar = manter apagados (só atualizar o resto)"
    );
  }
  $btnSincronizar.disabled = true;
  const textoOriginal = $btnSincronizar.innerHTML;
  $btnSincronizar.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Atualizando...';
  chrome.runtime.sendMessage({ type: "syncSnippetsPadrao", restaurarApagados: restaurar }, (r) => {
    $btnSincronizar.disabled = false;
    $btnSincronizar.innerHTML = textoOriginal;
    if (chrome.runtime.lastError || !r) {
      alert("Não foi possível falar com a extensão. Recarregue-a em chrome://extensions.");
      return;
    }
    carregar();
    if (!r.ok) {
      alert("Não consegui aplicar a lista padrão.\n" + (r.erro || "") + "\n\nSeus snippets continuam como estavam.");
      return;
    }
    const avisoOrigem = r.origem === "embutido"
      ? "\nO GitHub não respondeu — apliquei a cópia local que vem com a extensão."
      : "";
    alert("Lista padrão atualizada!" + avisoOrigem + "\n" + r.adicionados + " novo(s), " + r.atualizados + " atualizado(s), " + r.removidos + " removido(s).\nSeus snippets criados/editados não foram alterados.");
  });
});

// ===== Seleção em massa / apagar vários (só os SEUS — LOCAL) =====
$chkTodos.addEventListener("change", () => {
  if ($chkTodos.checked) {
    ultimosFiltrados.forEach(s => { if (!ehPadrao(s)) selecionados.add(s.id); });
  } else {
    ultimosFiltrados.forEach(s => selecionados.delete(s.id));
  }
  renderLista();
});

$btnApagarSelecionados.addEventListener("click", () => {
  const alvos = snippets.filter(s => selecionados.has(s.id) && !ehPadrao(s));
  const qtd = alvos.length;
  if (!qtd) return;
  const confirmMsg = qtd === 1
    ? "Apagar o snippet selecionado?"
    : `Apagar os ${qtd} snippets selecionados?`;
  if (!confirm(confirmMsg)) return;

  const ids = new Set(alvos.map(s => s.id));
  const extras = registrarApagados(alvos);
  snippets = snippets.filter(s => !ids.has(s.id));
  if (ativoId && ids.has(ativoId)) {
    ativoId = null;
    mostrarEditor(true);
  }
  selecionados.clear();

  salvarNoStorage(renderLista, extras);
});

// Atalho de teclado: Ctrl/Cmd+S salva o snippet em edição
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && !$editorForm.classList.contains("oculto")) {
    e.preventDefault();
    salvar();
  }
});

carregarListaAudios();
carregar();
