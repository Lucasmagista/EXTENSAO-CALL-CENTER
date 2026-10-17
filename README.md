# CallCenter - TOOLS

Extensão do Google Chrome (Manifest V3) criada para agilizar o dia a dia de quem trabalha em call center: atalhos de digitação, snippets com áudio, relatos prontos, configuração de ramal e muito mais — tudo dentro do WhatsApp Web, Rocket.Chat e demais sites da Oquei.

> Criado por **[Mometto](https://github.com/lv777x)** e **[Diogo](https://github.com/PaulaoMecanicas11)** — [Magista](https://www.magista.dev/)

## Funcionalidades

### 🧩 Botão flutuante
Um botão com o ícone da extensão (`assets/alares-icon.webp`, arrastável, posição salva) que abre o painel de ferramentas em qualquer site liberado.

### 📐 Barra lateral injetada
Alternativa ao botão flutuante: um rail fixo com o mesmo ícone que abre um painel deslizante com todas as ferramentas — no estilo WA Web Plus. Pode ser usada sozinha ou junto do botão flutuante.

### 🔀 Modo por site
Cada site pode ter a forma de acesso própria (Flutuante, Barra lateral, Ambos ou **Sem botão** — aí a extensão é usada só pelo ícone fixado no Chrome e o atalho Alt+X), sem afetar os outros. Configurável em ⚙️ no popup.

### 📝 Snippets
- Frases prontas com atalho, inseridas com um clique ou pelo teclado.
- Snippets com **áudio** (volume ajustável no popup).
- Lista padrão que vem **embutida na extensão**, aplicada localmente (pode ignorar/restaurar snippet a snippet).
- Funciona nos sites liberados; outros sites podem ser liberados pelo próprio popup.

### 💬 Relatos / Mensagens
- **Relatos**: painel de relatos prontos que injeta direto no editor da página (Rocket.Chat).
- **Mensagens**: menu de mensagens rápidas do WhatsApp Web, acessível de qualquer site (abre ou foca o WhatsApp automaticamente).

### 🔐 Atalhos de teclado
- `Alt+L` — envia ✅ no grupo de rodízio.
- `Alt+X` — abre/fecha a barra lateral.

### 🛠 Outras ferramentas
- Configuração de ramal Huawei x6 pelo popup.
- Senha Wi-Fi do X6 em tela modal (conteúdo do arquivo `SENHA WIFI X6.html`).
- Lista de links úteis (ramais, planilhas, roteiros).

## Sites suportados

- `https://web.whatsapp.com`
- `https://chat.oquei.com.br`
- `https://elleven.oquei.com.br`
- `https://oquei.sz.chat`

Outros sites podem ser liberados pelo popup (botão "Permitir snippets neste site").

## Instalação

### Chrome Web Store (recomendado)
_Publicação em preparação._ Depois de publicada, a extensão atualiza automaticamente pela loja.

### Modo desenvolvedor (local)
1. Baixe ou clone este repositório.
2. Abra `chrome://extensions`.
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar expandida** e seleeione a pasta `CALLCENTER - TOOLS` (a que contém o `manifest.json`).

## Estrutura do projeto

| Arquivo | Função |
|---|---|
| `manifest.json` | Configuração da extensão (MV3) |
| `background.js` | Service worker: comandos, snippets padrão, migrações |
| `popup.html` / `popup.js` | Janela da extensão (principal + configurações) |
| `styles.css` | Design system compartilhado |
| `ferramentas-comuns.js` | Ações, modos e posicionamento compartilhados |
| `botao-flutuante.js` / `.css` | Botão arrastável (GIF Bonzi Buddy) |
| `barra-lateral.js` / `.css` | Rail + painel deslizante (mesmo GIF) |
| `snippets.html` / `snippets.js` | Gerenciador de snippets |
| `snippets-content.js` | Injeção de snippets nas páginas |
| `quickreply.js` | Mensagens rápidas do WhatsApp Web |
| `relatos.js` | Painel de relatos (injetado no MAIN world) |
| `huaweiconfig.js` | Configuração do ramal x6 |
| `PROX MODAL.html` / `prox-modal.js` | Modal do botão Enviar PROX (QR + grupos) |
| `SUGESTOES MODAL.html` / `sugestoes-modal.js` | Modal de Sugestões (formulário completo + área do admin) |
| `SUPORTE MODAL.html` / `suporte-modal.js` | Modal do admin (senha na modal de Sugestões): WhatsApp do suporte + grupo das sugestões |
| `SENHA WIFI X6.html` / `senha-wifi-x6.js` | Decodificador de senha Wi-Fi (modal) |
| `offscreen.html` / `offscreen.js` | Reprodução de áudio dos snippets |
| `assets/` | Áudios, imagens e lista padrão de snippets |

## Atualizações

- **Chrome Web Store**: automáticas — basta publicar a nova versão no painel.
- **Instalação local**: baixe a pasta atualizada e recarregue a extensão em `chrome://extensions`.

## Desenvolvimento

Após alterar o código:

```bash
# valida a sintaxe dos scripts alterados
node --check background.js
node --check popup.js
# valida o manifest
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"
```

Incrementa a `version` no `manifest.json` antes de publicar ou zipar.

## Segurança

Esta extensão **não baixa nem executa código de fora do pacote publicado**. As requisições de rede são só de **dados**: (1) a **lista padrão de snippets** (JSON) do repositório oficial `Lucasmagista/EXTENSAO-CALL-CENTER`, com fallback para a cópia embutida, (2) o **arquivo de configuração de suporte** `assets/suporte-config.json` do mesmo repositório (grupo de destino das sugestões e instância `sug-xxxxx` do suporte escolhidos pelo admin — dados, sem chave, mesma sincronização de 60 minutos; nas máquinas sem suporte local as sugestões saem pela instância do admin), e (3) as chamadas REST da **Evolution API** em `whatsapp.hubly.software` usadas pelo botão **Enviar PROX** e pelo botão **Sugestões** (instância, QR Code, grupos e envio), apenas quando você usa o botão. A **API Key vem embutida** no arquivo local `assets/prox-servidor.json` (gitignorado — fora do repositório) para a instalação já funcionar, ou é digitada em "Alterar API Key"; em qualquer caso ela fica só no `chrome.storage.local`. Os dados do usuário ficam apenas no `chrome.storage.local`. Veja [SECURITY.md](SECURITY.md) e [privacidade.html](privacidade.html).

## Licença

[MIT](LICENSE) — veja também [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Contato

- Issues: [github.com/Lucasmagista](https://github.com/Lucasmagista)
- Criadores: [Mometto](https://github.com/lv777x) e [Diogo](https://github.com/PaulaoMecanicas11) — [Magista](https://www.magista.dev/)
- Chrome Web Store: [CallCenter - TOOLS](https://chromewebstore.google.com/detail/callcenter-tools/acgdpiahfakpindcloiopmelfihkiefa)
