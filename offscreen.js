chrome.runtime.onMessage.addListener((message) => {
  if (message.target === "offscreen" && message.type === "play") {
    // Só toca áudios da própria pasta assets/ da extensão (mesma regra do
    // background) — impede que qualquer script use o offscreen como beacon
    // para URLs externas.
    const prefixoAssets = chrome.runtime.getURL("assets/");
    const url = typeof message.url === "string" ? message.url : "";
    if (!url.startsWith(prefixoAssets)) {
      console.warn("[Offscreen] Áudio bloqueado (fora de assets/):", url);
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
