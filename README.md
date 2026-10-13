# CallCenter - TOOLS

Extensão do Google Chrome (Manifest V3) criada para agilizar o dia a dia de quem trabalha em call center: atalhos de digitação, snippets com áudio, relatos prontos, configuração de ramal e muito mais — tudo dentro do WhatsApp Web, Rocket.Chat e demais sites da Oquei.

> Criado por **Mometto** e **Diogo — Magista**

## Funcionalidades

### 🧩 Botão flutuante
Um botão com a logo da extensão (arrastável, posição salva) que abre o painel de ferramentas em qualquer site liberado.

### 📐 Barra lateral injetada
Alternativa ao botão flutuante: um rail fixo com a logo que abre um painel deslizante com todas as ferramentas — no estilo WA Web Plus. Pode ser usada sozinha ou junto do botão flutuante.

### 🔀 Modo por site
Cada site pode ter a forma de acesso própria (Flutuante, Barra lateral ou Ambos), sem afetar os outros. Configurável em ⚙️ no popup.

### 📝 Snippets
- Frases prontas com atalho, inseridas com um clique ou pelo teclado.
- Snippets com **áudio** (volume ajustável no popup).
- Lista padrão que vem **embutida na extensão**, aplicada localmente (pode ignorar/restaurar snippet a snippet).
- Funciona nos sites liberados; outros sites podem ser liberados pelo próprio popup.

### 💬 Relatos / Mensagens
- **Relatos**: painel de relatos prontos que injeta direto no editor da página (Rocket.Chat).
- **Mensagens**: menu de mensagens rápidas para o WhatsApp Web.

### 🔐 Atalhos de teclado
- `Alt+P` — envia "prox" no grupo de rodízio.
- `Alt+L` — envia ✅ no grupo de rodízio.
- `Alt+X` — abre/fecha a barra lateral.

### 🛠 Outras ferramentas
- Configuração de ramal Huawei x6 pelo popup.
- Senha de Wi-Fi com decodificador (aba externa).
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
| `botao-flutuante.js` / `.css` | Botão 🧩 arrastável |
| `barra-lateral.js` / `.css` | Rail + painel deslizante |
| `snippets.html` / `snippets.js` | Gerenciador de snippets |
| `snippets-content.js` | Injeção de snippets nas páginas |
| `quickreply.js` | Mensagens rápidas do WhatsApp Web |
| `relatos.js` | Painel de relatos (injetado no MAIN world) |
| `huaweiconfig.js` | Configuração do ramal x6 |
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

Esta extensão **não baixa nem executa código de fora do pacote publicado** e não faz nenhuma requisição de rede — todo o conteúdo (código, áudios e lista padrão de snippets) vem embutido. Os dados do usuário ficam apenas no `chrome.storage.local`. Veja [SECURITY.md](SECURITY.md) e [privacidade.html](privacidade.html).

## Licença

[MIT](LICENSE) — veja também [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Contato

- Issues: [github.com/lv777x/call-center-tools/issues](https://github.com/lv777x/call-center-tools/issues)
- Criadores: Mometto e Diogo — Magista
