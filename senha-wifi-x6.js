(() => {
/* ===================== Tema claro/escuro ===================== */
(function () {
  var themeBtn = document.getElementById('dx-tema');

  function alvoTema() {
    return document.getElementById('cc-senha-wifi-corpo') || document.body;
  }

  function setTheme(theme) {
    var light = theme === 'light';
    alvoTema().classList.toggle('light', light);
    themeBtn.textContent = light ? '🌙 Tema escuro' : '☀️ Tema claro';
    themeBtn.setAttribute('aria-label', light ? 'Mudar para tema escuro' : 'Mudar para tema claro');
    try {
      localStorage.setItem('wifiDecoderTheme', theme);
    } catch (e) {}
  }

  var saved = null;
  try { saved = localStorage.getItem('wifiDecoderTheme'); } catch (e) {}
  setTheme(saved === 'light' ? 'light' : 'dark');

  themeBtn.addEventListener('click', function () {
    setTheme(alvoTema().classList.contains('light') ? 'dark' : 'light');
  });
})();

/* ===================== AES-256 (decrypt only) — implementação pura em JS ===================== */
const Sbox = [
0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
];
const InvSbox = new Array(256);
for (let i = 0; i < 256; i++) InvSbox[Sbox[i]] = i;
const Rcon = [0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36,0x6c,0xd8,0xab,0x4d];

function mul(a, b) {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p & 0xff;
}
function keyExpansion(key) {
  const Nk = key.length / 4;
  const Nr = Nk + 6;
  const Nb = 4;
  const w = new Array(Nb * (Nr + 1));
  for (let i = 0; i < Nk; i++) w[i] = [key[4*i], key[4*i+1], key[4*i+2], key[4*i+3]];
  for (let i = Nk; i < Nb * (Nr + 1); i++) {
    let temp = w[i-1].slice();
    if (i % Nk === 0) {
      temp = [temp[1], temp[2], temp[3], temp[0]];
      temp = temp.map(b => Sbox[b]);
      temp[0] ^= Rcon[i / Nk];
    } else if (Nk > 6 && i % Nk === 4) {
      temp = temp.map(b => Sbox[b]);
    }
    w[i] = [ w[i-Nk][0]^temp[0], w[i-Nk][1]^temp[1], w[i-Nk][2]^temp[2], w[i-Nk][3]^temp[3] ];
  }
  return { w, Nr };
}
function addRoundKey(state, w, round) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) state[r][c] ^= w[round*4 + c][r];
}
function invSubBytes(state) {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) state[r][c] = InvSbox[state[r][c]];
}
function invShiftRows(state) {
  for (let r = 1; r < 4; r++) {
    const row = state[r].slice();
    for (let c = 0; c < 4; c++) state[r][c] = row[(c - r + 4) % 4];
  }
}
function invMixColumns(state) {
  for (let c = 0; c < 4; c++) {
    const a0=state[0][c], a1=state[1][c], a2=state[2][c], a3=state[3][c];
    state[0][c] = mul(a0,0x0e)^mul(a1,0x0b)^mul(a2,0x0d)^mul(a3,0x09);
    state[1][c] = mul(a0,0x09)^mul(a1,0x0e)^mul(a2,0x0b)^mul(a3,0x0d);
    state[2][c] = mul(a0,0x0d)^mul(a1,0x09)^mul(a2,0x0e)^mul(a3,0x0b);
    state[3][c] = mul(a0,0x0b)^mul(a1,0x0d)^mul(a2,0x09)^mul(a3,0x0e);
  }
}
function decryptBlock(block16, w, Nr) {
  const state = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for (let i = 0; i < 16; i++) state[i % 4][Math.floor(i / 4)] = block16[i];
  addRoundKey(state, w, Nr);
  for (let round = Nr - 1; round >= 1; round--) {
    invShiftRows(state); invSubBytes(state); addRoundKey(state, w, round); invMixColumns(state);
  }
  invShiftRows(state); invSubBytes(state); addRoundKey(state, w, 0);
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = state[i % 4][Math.floor(i / 4)];
  return out;
}
function aesCbcDecryptNoPadding(ciphertext, key, iv) {
  const { w, Nr } = keyExpansion(key);
  const out = new Uint8Array(ciphertext.length);
  let prevBlock = iv;
  for (let off = 0; off < ciphertext.length; off += 16) {
    const block = ciphertext.slice(off, off + 16);
    const dec = decryptBlock(block, w, Nr);
    for (let i = 0; i < 16; i++) out[off + i] = dec[i] ^ prevBlock[i];
    prevBlock = block;
  }
  return out;
}

/* ===================== Lógica de decodificação Huawei ===================== */
const BLOCK_SIZE = 0x14;
const KEY_HEX = "6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498";

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i*2,2), 16);
  return bytes;
}

function hwAscUnvisible(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out[i] = (code === 0x7e) ? 0x1e : ((code - 0x21) & 0xff);
  }
  return out;
}
function hwAesEnhSysToLong(buf5) {
  let output = 0, v3 = 1;
  for (let i = 0; i < 5; i++) { output += v3 * buf5[i]; v3 *= 0x5D; }
  return output;
}
function hwPlainToBin(buf) {
  if (buf.length % 5 !== 0) return null;
  const out = new Uint8Array(buf.length * 4 / 5);
  let period5 = 0, i = 0;
  while (i !== out.length) {
    const long_ = hwAesEnhSysToLong(buf.slice(period5, period5+5));
    out[i]   =  long_        & 0xff;
    out[i+1] = (long_ >>> 8) & 0xff;
    out[i+2] = (long_ >>> 16) & 0xff;
    out[i+3] = (long_ >>> 24) & 0xff;
    period5 += 5; i += 4;
  }
  return out;
}
function hwTrim(s) {
  if (s.length < 3) return "";
  if (s[0] !== "$" || s[1] !== "2" || s[s.length-1] !== "$") return "";
  return s.substring(2, s.length - 1);
}
function hwDecrypt(inputStr) {
  const trimmed = hwTrim(inputStr);
  if (!trimmed) return null;
  const unvisible = hwAscUnvisible(trimmed);
  const blockCount = Math.floor(unvisible.length / BLOCK_SIZE);
  if (unvisible.length !== BLOCK_SIZE * blockCount) return null;

  const ivEncoded = unvisible.slice(blockCount*BLOCK_SIZE - BLOCK_SIZE, blockCount*BLOCK_SIZE);
  const iv = hwPlainToBin(ivEncoded);
  const dataEncoded = unvisible.slice(0, blockCount*BLOCK_SIZE - BLOCK_SIZE);
  const dataAll = hwPlainToBin(dataEncoded);
  if (!iv || !dataAll || dataAll.length === 0) return null;

  const key = hexToBytes(KEY_HEX);
  const decrypted = aesCbcDecryptNoPadding(dataAll, key, iv);

  // remove trailing zero bytes (padding usado pela Huawei)
  let end = decrypted.length;
  while (end > 0 && decrypted[end-1] === 0) end--;
  const trimmedBytes = decrypted.slice(0, end);

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(trimmedBytes);
  } catch(e) {
    return "[" + Array.from(trimmedBytes).map(b=>b.toString(16).padStart(2,'0')).join('') + "]";
  }
}

function htmlUnescape(str) {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

function extractWifiCredentials(xmlText) {
  const results = [];
  const seen = new Set();
  const blockRegex = /<WLANConfigurationInstance[\s\S]*?<\/WLANConfigurationInstance>/g;
  let m;
  while ((m = blockRegex.exec(xmlText)) !== null) {
    const block = m[0];
    const ssidMatch = block.match(/SSID="([^"]*)"/);
    const pskMatch = block.match(/<PreSharedKeyInstance[^>]*PreSharedKey="([^"]*)"/);
    if (!ssidMatch || !pskMatch) continue;
    const ssid = htmlUnescape(ssidMatch[1]);
    if (/easymesh/i.test(ssid)) continue;
    const rawKey = htmlUnescape(pskMatch[1]);
    if (!rawKey) continue;
    const pw = hwDecrypt(rawKey);
    if (pw === null) continue;
    const id = ssid + '|' + pw;
    if (seen.has(id)) continue;
    seen.add(id);
    results.push({ ssid, pw });
  }
  return results;
}



/* ===================== UI ===================== */
const zona = document.getElementById('dx-zona');
const entrada = document.getElementById('dx-arquivo-entrada');
const botaoEscolher = document.getElementById('dx-escolher');
const nomeEl = document.getElementById('dx-nome-arquivo');
const statusEl = document.getElementById('dx-status');
const carregandoEl = document.getElementById('dx-carregando');
const resultadoEl = document.getElementById('dx-resultado');
const corpoTabelaEl = document.getElementById('dx-corpo-tabela');
const seloArquivoEl = document.getElementById('dx-arquivo-selo');

function definirStatus(texto, tipo) {
  statusEl.textContent = texto;
  statusEl.className = 'dx-status' + (tipo ? ' dx-' + tipo : '');
}

function mostrarCarregando(sim) {
  carregandoEl.classList.toggle('dx-visivel', !!sim);
}

botaoEscolher.addEventListener('click', function (e) {
  e.stopPropagation();
  entrada.click();
});

zona.addEventListener('click', function (e) {
  if (e.target && e.target.closest && e.target.closest('button')) return;
  entrada.click();
});

['dragenter', 'dragover'].forEach(function (evt) {
  zona.addEventListener(evt, function (e) {
    e.preventDefault();
    zona.classList.add('dx-arraste');
  });
});
['dragleave', 'drop'].forEach(function (evt) {
  zona.addEventListener(evt, function (e) {
    e.preventDefault();
    zona.classList.remove('dx-arraste');
  });
});

zona.addEventListener('drop', function (e) {
  const arquivo = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (arquivo) processarArquivo(arquivo);
});

entrada.addEventListener('change', function (e) {
  if (e.target.files && e.target.files[0]) processarArquivo(e.target.files[0]);
});

function processarArquivo(file) {
  nomeEl.textContent = 'Arquivo: ' + file.name;
  resultadoEl.style.display = 'none';
  corpoTabelaEl.innerHTML = '';
  definirStatus('', '');

  if (!/\.xml$/i.test(file.name)) {
    definirStatus('Envie apenas arquivos .xml (ex.: hw_ctree.xml).', 'erro');
    return;
  }

  mostrarCarregando(true);

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const creds = extractWifiCredentials(text);
      if (creds.length === 0) {
        definirStatus('Nenhuma rede WiFi com senha encontrada nesse arquivo. Verifique se é o backup correto (hw_ctree.xml).', 'erro');
        return;
      }
      renderizarResultados(creds, file.name);
      definirStatus(creds.length + ' rede(s) encontrada(s) e decodificada(s) com sucesso.', 'ok');
    } catch (err) {
      definirStatus('Erro ao processar o arquivo: ' + err.message, 'erro');
    } finally {
      mostrarCarregando(false);
    }
  };
  reader.onerror = () => {
    mostrarCarregando(false);
    definirStatus('Não foi possível ler o arquivo.', 'erro');
  };
  reader.readAsText(file, 'utf-8');
}

function renderizarResultados(creds, nomeArquivo) {
  seloArquivoEl.textContent = nomeArquivo;
  creds.forEach((c) => {
    const tr = document.createElement('tr');

    const tdSsid = document.createElement('td');
    tdSsid.textContent = c.ssid;

    const tdSenha = document.createElement('td');
    const senha = document.createElement('code');
    senha.className = 'dx-senha';
    senha.textContent = c.pw;
    tdSenha.appendChild(senha);

    const tdAcao = document.createElement('td');
    tdAcao.className = 'dx-acao';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'dx-copiar';
    copyBtn.textContent = '📋 Copiar';
    copyBtn.addEventListener('click', function () {
      copiarSenha(c.pw, copyBtn);
    });
    tdAcao.appendChild(copyBtn);

    tr.appendChild(tdSsid);
    tr.appendChild(tdSenha);
    tr.appendChild(tdAcao);
    corpoTabelaEl.appendChild(tr);
  });
  resultadoEl.style.display = 'block';
}

function copiarSenha(texto, botao) {
  function sucesso() {
    botao.textContent = '✓ Copiado';
    setTimeout(function () {
      botao.textContent = '📋 Copiar';
    }, 1500);
  }

  function reserva() {
    const temp = document.createElement('textarea');
    temp.value = texto;
    temp.setAttribute('readonly', '');
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    try {
      document.execCommand('copy');
      sucesso();
    } catch (e) {
      alert('Não foi possível copiar automaticamente. Selecione a senha e copie manualmente.');
    }
    document.body.removeChild(temp);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(sucesso).catch(reserva);
  } else {
    reserva();
  }
}
})();
