# Política de Segurança

## Versões suportadas

| Versão | Suportada |
|---|---|
| 1.18.x (Chrome Web Store) | ✅ Sim |
| <= 1.17 (instalação local) | ⚠️ Somente correções críticas via novo release no repositório |

Use sempre a versão mais recente. Na Chrome Web Store, as atualizações são aplicadas automaticamente.

## Relatar uma vulnerabilidade

Se você encontrou uma falha de segurança nesta extensão:

1. **Não abra uma issue pública.**
2. Envie um e-mail ou mensagem privada para os mantenedores (Mometto / Diogo — Magista) pelo GitHub: [github.com/lv777x/call-center-tools](https://github.com/lv777x/call-center-tools)
3. Descreva: o que afeta, como reproduzir e o impacto potencial.
4. Você terá um retorno inicial em até **7 dias**. Correções críticas são priorizadas e publicadas como nova versão na loja.

Agradecemos a responsabilidade por reportar — creditamos quem ajuda a proteger a comunidade.

## Escopo de segurança da extensão

### O que esta extensão FAZ
- Roda apenas nos sites declarados no `manifest.json` (WhatsApp Web, Rocket.Chat e sites da Oquei) — além dos sites que o **usuário** liberar explicitamente pelo popup.
- Lê e grava dados **localmente** no `chrome.storage.local` (configurações, snippets, posição dos botões).
- Usa `chrome.scripting` para inserir seus scripts nas abas que você abriu/permitiu.
- Reproduz áudios locais da extensão via documento offscreen.

### O que esta extensão NÃO faz
- ❌ **Não baixa nem executa código de fora do pacote publicado** — não há nenhuma requisição de rede; código, áudios e lista padrão de snippets vêm embutidos (política de código remoto da Chrome Web Store — o antigo updater de arquivos e o sync remoto de snippets foram removidos).
- ❌ Não envia dados para servidores próprios — não há telemetria nem rastreamento.
- ❌ Não lê conteúdo de outras abas além das que você interage.
- ❌ Não usa `eval` nem `innerHTML` com dados remotos não confiáveis.
- ❌ Não exige nem armazena senhas/credenciais.

### Permissões e por que são necessárias

| Permissão | Motivo |
|---|---|
| `tabs` | Abrir links e injetar scripts nas abas liberadas |
| `scripting` | Injetar os scripts da extensão nas páginas (snippets, relatos, barra) |
| `activeTab` | Ação rápida na aba ativa quando você clica no ícone |
| `storage` | Salvar snippets, configurações e preferências localmente |
| `offscreen` | Tocar os áudios dos snippets (áudio precisa de documento em segundo plano na MV3) |

Permissões de site **opcionais** (`optional_host_permissions`): usadas apenas quando você clica em "Permitir snippets neste site" — o Chrome mostra o pedido e você decide.

### Boas práticas para quem instala localmente
- Baixe a extensão apenas deste repositório oficial.
- Confira o `manifest.json` se for contribuir com código de terceiros.
- Ao atualizar a instalação local, substitua a pasta inteira e recarregue em `chrome://extensions`.

## Preferências de privacidade (resumo para a Chrome Web Store)

- Dados coletados: **nenhum** sai do seu computador.
- Uso de rede: **nenhum** — a extensão não faz requisições externas.
- Compartilhamento com terceiros: nenhum.
