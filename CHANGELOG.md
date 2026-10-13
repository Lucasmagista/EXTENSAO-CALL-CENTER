# Changelog

Todas as mudanças notáveis nesta extensão são documentadas aqui.
O formato segue o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.18] — 2026-10-13

### Removido
- Sincronização da lista padrão de snippets com o GitHub: a lista agora vem **embutida no pacote** (`assets/snippets-padrao.json`) e é aplicada localmente na instalação/atualização, com as mesmas regras de mesclagem (snippets do usuário nunca são alterados).
- `https://raw.githubusercontent.com/*` das `host_permissions` — a extensão **não faz nenhuma requisição de rede**.
- Permissão `alarms` (era usada apenas pelo sync remoto).
- Arquivos de marca de terceiros: `assets/alares.png` e `assets/alares-icon.webp` (política de marca da Chrome Web Store).

### Adicionado
- Arte "Tropa do Call Center" (`assets/tropa.png`, fornecida pela equipe) aplicada em: ícone da extensão (`icons/icon*.png`), botão flutuante, botão da barra lateral, popup e gerenciador de snippets.
- `privacidade.html`: política de privacidade para publicação (GitHub Pages) e link na listagem da loja.

### Alterado
- Botão do rail, botão flutuante, popup e gerenciador de snippets passam a usar `assets/logo.png`.
- Textos do botão "🔄 Atualizar padrão" ajustados (agora aplica a lista embutida, não busca na internet).

---

## [1.17] — 2026-10-13

### Adicionado
- Documentação do projeto: `README.md`, `CHANGELOG.md`, `SECURITY.md`, `LICENSE` (MIT) e `CODE_OF_CONDUCT.md`.
- `homepage_url` no `manifest.json` apontando para o repositório GitHub.

### Removido
- Central de atualização via GitHub (`atualizar-extensao.js`, `update-manifest.json`, seção 🔄 Atualizações no popup e bloco correspondente no `background.js`).
  - Motivo: a Chrome Web Store proíbe a execução de código remoto — tudo que a extensão roda precisa estar no pacote aprovado. Na loja, as atualizações são feitas pela própria loja (publicação de nova versão).
- Permissão `notifications` (era usada apenas pelo updater removido).

### Nota
- Esta é a versão preparada para publicação na Chrome Web Store.

---

## [1.16] — 2026-10-13

### Adicionado
- Central de atualizações conectada ao GitHub (uso local/desenvolvedor):
  - `update-manifest.json` no repositório (versão + lista de arquivos).
  - `atualizar-extensao.js`: conexão única da pasta da extensão via File System Access API (handle guardado em IndexedDB), download e gravação de todos os arquivos com progresso.
  - Seção 🔄 Atualizações no popup: conectar pasta, verificar, baixar/implementar com spinner, botão de reiniciar.
  - Verificação automática no `background.js` a cada 30 minutos (alarme `update-check`), badge `↑` no ícone e notificação (uma por versão).
  - Notificação "update-pronto" com `requireInteraction` que reinicia a extensão via `chrome.runtime.reload()`.
- Permissão `notifications`.

### Removido
- Removido na 1.17 antes da publicação (política de código remoto da Chrome Web Store).

---

## [1.15] — 2026-10-13

### Adicionado
- Detecção de posição no WhatsApp Web reescrita com amostragem de tela:
  - `pontoOcupado(x, y)`: usa `document.elementsFromPoint` para saber se um ponto está coberto por ícones reais (filtra por tamanho e coluna, ignora elementos da própria extensão).
  - `retanguloLivre(x, y, lado)`: confere 4 cantos + centro antes de posicionar.
  - `ancoraColunaEsquerda()`: varre a coluna de ícones de cima pra baixo (x=28, a cada 6px) e encontra o **último ícone do grupo de cima** — inclusive ícones de outras extensões (ex.: WA Web Plus) — parando no primeiro vazio maior que 70px.
  - Empurrão de colisão: se o FAB sobrepor algum ícone, desloca 10px pra baixo (ou pra cima) até achar espaço livre.
- Botão flutuante passou a usar a mesma logo/formato do rail (`assets/alares-icon.webp`, 40×40, border-radius 11px) e o menu abre à esquerda (`left: 48px`).

---

## [1.14] — 2026-10-13

### Adicionado
- Botão da barra lateral usa a logo `assets/alares-icon.webp` em botão quadrado arredondado (40×40, radius 11px) — igual ao WA Web Plus — em vez de caixa/círculo.
- `assets/alares-icon.webp` declarado em `web_accessible_resources` (exigido para exibir imagem no DOM da página).
- Retry para o Rocket.Chat: gatilho da barra lateral é injetado ao lado da logo no rodapé ("Desenvolvido por Rocket.Chat"), com `agendarNovaTentativa`/`tentativasRocket` (até 40 tentativas, 600ms) enquanto o footer ainda não renderizou.

### Alterado
- Chave de posição do FAB migrada para `ccTools_fabPosicao_v2` (evita conflito com a posição salva na v1.13).

---

## [1.13] — 2026-10-13

### Adicionado
- Configuração de modo **por site** (`ccTools_configModos = { padrao, porSite }`):
  - Valores: `"flutuante"`, `"lateral"`, `"ambos"`; `porSite[origem]` vence o padrão.
  - Popup redesenhada (250px) com botão ⚙️ e tela de configurações: cartões de modo padrão, lista por site com seletor, 🧩 Restaurar posição e dicas.
  - Troca de modo aplica na hora nas abas abertas (sem F5), reagindo ao storage.
- Migração `migrarConfigModos()` no `background.js` (roda em `onInstalled`/`onStartup`): converte o antigo `ccTools_modoAcesso` para o novo formato e o handler `setModoAcesso` passou a preservar as regras `porSite`.
- Observer de DOM no `ferramentas-comuns.js` para reposicionar o rail/FAB quando a página muda (sem recarregar).

### Corrigido
- Bug do FAB que não sumia ao trocar para o modo lateral: CSS `#cctools-fab.fab-oculto { display: none !important; }` no root (a regra do próprio `#cctools-fab` tinha precedência igual e anulava a classe).

---

## [1.12] — 2026-10-13

### Adicionado
- `ferramentas-comuns.js`: ações compartilhadas (`window.__cctoolsAcoes = { LINKS, executar }`), resolução de modo (`window.__cctoolsModos.resolver`) e motor de posicionamento (`window.__cctoolsPosicionamento`).
- `barra-lateral.js` / `barra-lateral.css`: rail fixo com logo + painel deslizante com todas as ferramentas; atalho `Alt+X`; função global `toggleBarraLateral`.
- Auto-recuperação de injeção:
  - Handler `carregarAcoes` no `background.js` injeta `ferramentas-comuns.js` no frame/remetente quando um content script pede.
  - `quandoAcoesProntas(cb)` no fab/barra: retry 20×100ms + aviso claro na página se a versão esperada não carregar.

### Removido
- Side panel (`sidepanel.html` e suporte no `background.js`/`popup.js`): a barra lateral agora é **injetada na própria página**, como o WA Web Plus — sem janela lateral nativa do Chrome.

### Nota
- Log de confirmação no console da página: `[CCTools] ferramentas-comuns.js carregado`.

---

## [1.11] — 2026-10-13

### Adicionado
- `styles.css`: design system compartilhado (`--raio`, `.oculto`, `.btn-comum`, `.btn-fantasma`) usado por todas as telas.
- Botão flutuante (FAB) arrastável com posição persistida (`ccTools_fabPosicao`).
- Liberação dinâmica de sites extras via popup ("Permitir snippets neste site"):
  - `optional_host_permissions` + `chrome.permissions.request` no gesto do clique.
  - Lista salva em `ccTools_sitesPermitidos`; scripts injetados na aba atual na hora.

### Alterado
- Content scripts restringidos de `<all_urls>` para os sites suportados (princípio do menor privilégio).
- Removida a permissão `unlimitedStorage` (não era necessária).

---

## [1.10] — 2026-10-13

### Corrigido (segurança)
- `abrirLink` passou a validar contra whitelist de domínios — links fora da lista não são abertos (evita abuso se algum dado remoto for comprometido).
- Relatos passaram a rodar no `MAIN world` (`chrome.scripting.executeScript({ world: 'MAIN' })`) — o editor da página (DevExpress/Quill) só é acessível de lá; sem expor APIs internas ao content script.

---

## [1.9] e anteriores

Versão original da extensão (disponível em `teste-tropa-do-leleo/TESTE TROPA DO LOLO/` como referência histórica):

- Popup com: Enviar "prox" (`Alt+P`), Enviar ✅ (`Alt+L`), Relatos/Mensagens, Links, Configurar x6, Senha Wi-Fi, Snippets, volume do áudio.
- Snippets com atalho e áudio (reproduzido via documento offscreen), lista padrão sincronizada do GitHub com status de sincronização (`ccTools_padrao_status`) e opção de ignorar snippets individuais.
- Sincronização automática da lista padrão a cada 60 minutos (alarme `syncSnippetsPadrao`).
- Menu de mensagens rápidas do WhatsApp Web (`quickreply.js`).
- Painel de relatos (`relatos.js`).
- Configuração de ramal Huawei x6 (`huaweiconfig.js`).
- Atalhos de teclado `Alt+P` e `Alt+L`.
- Content script injetado em `<all_urls>` (posteriormente restringido na 1.11).

[1.17]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.16]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.15]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.14]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.13]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.12]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.11]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.10]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.9]: https://github.com/lv777x/call-center-tools/commit/HEAD
