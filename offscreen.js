// Som de confirmação sintetizado (Web Audio) — usado quando um comando
// (resposta rápida, relato, snippet ou fluxo ✅) insere/envia mensagem no chat.
// Não depende de arquivo: o "ding" é gerado na hora e o volume vem do slider
// do popup (ccTools_volume), enviado pelo background na mensagem.
let ctxNotificacao = null;

function tocarNotificacao(volume) {
  if (!(volume > 0)) return; // slider em 0 = mudo, como nos áudios dos snippets
  try {
    if (!ctxNotificacao) {
      ctxNotificacao = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = ctxNotificacao;
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = Math.min(1, volume);
    master.connect(ctx.destination);

    // Dois tons ascendentes (880 Hz → 1318,5 Hz) com envelope suave:
    // curto, discreto e reconhecível como "deu certo".
    const tons = [
      { f: 880, ini: 0, dur: 0.10 },
      { f: 1318.5, ini: 0.10, dur: 0.22 }
    ];
    tons.forEach((t) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = t.f;
      const ini = t0 + t.ini;
      g.gain.setValueAtTime(0.0001, ini);
      g.gain.exponentialRampToValueAtTime(0.9, ini + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ini + t.dur);
      osc.connect(g);
      g.connect(master);
      osc.start(ini);
      osc.stop(ini + t.dur + 0.02);
    });
  } catch (e) {
    console.error("[Offscreen] Erro ao tocar notificação:", e);
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.target === "offscreen" && message.type === "notificacao") {
    const vol = typeof message.volume === "number" ? message.volume : 0.7;
    tocarNotificacao(Math.min(1, Math.max(0, vol)));
    return;
  }
  if (message && message.target === "offscreen" && message.type === "playCustom") {
    // Som de confirmação personalizado (arquivo da própria operadora, guardado
    // como data URL no storage). Só aceita data:audio/ e tamanho razoável —
    // nunca URL externa — para não virar beacon; o volume é o do slider.
    const url = typeof message.audio === "string" ? message.audio : "";
    if (!url.startsWith("data:audio/") || url.length > 700000) {
      console.warn("[Offscreen] Som personalizado bloqueado (não é data:audio/ ou grande demais):", url.slice(0, 40));
      return;
    }
    const audio = new Audio(url);
    const vol = typeof message.volume === "number" ? message.volume : 0.7;
    audio.volume = Math.min(1, Math.max(0, vol));
    audio.play().catch((erro) => {
      console.error("[Offscreen] Erro ao tocar som personalizado:", erro);
    });
    return;
  }
  if (message.target === "offscreen" && message.type === "play") {
    // Só toca áudios da própria pasta assets/ da extensão (mesma regra do
    // background) — impede que qualquer script use o offscreen como beacon
    // para URLs externas.
    const prefixoAssets = chrome.runtime.getURL("assets/");
    const url = typeof message.url === "string" ? message.url : "";
    if (!url.startsWith(prefixoAssets) || url.indexOf("..") !== -1) {
      console.warn("[Offscreen] Áudio bloqueado (fora de assets/ ou com caminho suspeito):", url);
      return;
    }
    if (!/\.(mp3|wav|ogg|m4a|aac|webm)(\?|#|$)/i.test(url)) {
      console.warn("[Offscreen] Áudio bloqueado (extensão não reconhecida):", url);
      return;
    }

    const audio = new Audio(url);
    const vol = typeof message.volume === "number" ? message.volume : 0.7;
    audio.volume = Math.min(1, Math.max(0, vol));

    audio.play().catch((erro) => {
      console.error("[Offscreen] Erro ao reproduzir áudio:", erro);
    });
  }
});
