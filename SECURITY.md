# Política de Segurança

## Versões suportadas

| Versão | Suportada |
|---|---|
| 1.22.x (Chrome Web Store) | ✅ Sim |
| 1.21.x (Chrome Web Store) | ✅ Sim |
| 1.18–1.20.x (Chrome Web Store) | ✅ Sim |
| <= 1.17 (instalação local) | ⚠️ Somente correções críticas via novo release no repositório |

Use sempre a versão mais recente. Na Chrome Web Store, as atualizações são aplicadas automaticamente.

## Relatar uma vulnerabilidade

Se você encontrou uma falha de segurança nesta extensão:

1. **Não abra uma issue pública.**
2. Envie um e-mail ou mensagem privada para os mantenedores (Mometto / Diogo — Magista) pelo GitHub: [github.com/Lucasmagista/EXTENSAO-CALL-CENTER](https://github.com/Lucasmagista/EXTENSAO-CALL-CENTER)
3. Descreva: o que afeta, como reproduzir e o impacto potencial.
4. Você terá um retorno inicial em até **7 dias**. Correções críticas são priorizadas e publicadas como nova versão na loja.

Agradecemos a responsabilidade por reportar — creditamos quem ajuda a proteger a comunidade.

## Escopo de segurança da extensão

### O que esta extensão FAZ
- Roda apenas nos sites declarados no `manifest.json` (WhatsApp Web, Rocket.Chat e sites da Oquei) — além dos sites que o **usuário** liberar explicitamente pelo popup.
- Lê e grava dados **localmente** no `chrome.storage.local` (configurações, snippets, posição dos botões).
- Usa `chrome.scripting` para inserir seus scripts nas abas que você abriu/permitiu.
- Reproduz áudios locais da extensão via documento offscreen.
- Baixa a **lista padrão de snippets** (apenas dados JSON) do repositório oficial `Lucasmagista/EXTENSAO-CALL-CENTER` no GitHub, a cada 60 minutos e pelo botão "Atualizar padrão" da tela de snippets; se o GitHub estiver indisponível, usa a cópia embutida no pacote.
- **Botão PROX**: chama por REST a sua própria Evolution API em `whatsapp.hubly.software` (criar instância, QR Code, listar grupos, enviar a mensagem no grupo escolhido e desconectar) — somente quando você usa o botão, autenticado pela API Key que vem embutida no pacote (`assets/prox-servidor.json`, arquivo local **gitignorado** — o repositório público nunca contém a chave) ou por uma chave manual sobrescrita, guardada no `chrome.storage.local`.
- **Botão Sugestões**: abre uma modal com o formulário (função, nome obrigatório, email opcional, setor, período e descrição) e usa as chamadas REST da Evolution API (estado da instância + `message/sendText`) para entregar a **mensagem padrão** ao grupo de suporte no WhatsApp — instância própria do suporte (`sug-xxxxx`, escolhida pelo admin na área protegida por senha dentro da própria modal), ou o campo opcional `grupoSuporte` do `assets/prox-servidor.json` / a sobrescrita local `ccTools_sugestaoGrupo` — somente quando você clica em "Enviar sugestão"; sem destino configurado, nenhuma requisição é feita e o texto pronto é copiado para a área de transferência.

### O que esta extensão NÃO faz
- ❌ **Não baixa nem executa código de fora do pacote publicado** — as requisições de rede são de **dados**: o JSON da lista padrão de snippets e as chamadas REST da Evolution API do PROX; nenhuma extensão de código é baixada ou executada remotamente (política de código remoto da Chrome Web Store — o antigo updater de arquivos foi removido).
- ❌ Não envia dados para servidores próprios — não há telemetria nem rastreamento.
- ❌ Não lê conteúdo de outras abas além das que você interage.
- ❌ Não usa `eval` nem `innerHTML` com dados remotos não confiáveis.
- ❌ Não lê nem guarda senhas de sites. A **API Key do seu servidor de Zap** vem embutida no pacote de instalação (fora do git) ou é digitada por você via "Alterar API Key"; fica só no `chrome.storage.local` e é usada unicamente como cabeçalho de autenticação no seu servidor Evolution.

### Medidas de endurecimento (1.22)
- **Validação de toda mensagem recebida pelo service worker**: o background confere tipo, tamanho e formato de cada campo antes de agir (sugestões: nome obrigatório, texto de 10–1500 caracteres, email com regex rígida, campos aparados contra caracteres de controle; API Key: formato `^[A-Za-z0-9._\-]{8,200}$` testado antes de qualquer chamada à rede; grupos: id/nome limitados).
- **Rate limit por finalidade**: PROX mantém 5 mensagens/30s; Sugestões têm janela própria de 3 mensagens/10min — contagem persistida no `chrome.storage.local`.
- **Segredo no service worker**: a API Key embutida no pacote nunca é devolvida nas respostas `proxLerConfig`/`suporteLerConfig` — apenas uma chave digitada manualmente volta (para o campo de edição das modais).
- **Remetente verificado**: o listener das telas de configuração recusa mensagens cujo `sender.id` não seja o da própria extensão.
- **CSP explícito** no `manifest.json`: `script-src 'self'; object-src 'self'`.
- **Áudios**: `playCustom` exige `data:audio/` (máx. 700.000 caracteres); `play` exige caminho em `assets/` sem `..` e extensão conhecida; o popup valida tipo/tamanho do arquivo de som antes de gravar no storage.
- **Snippets**: importação limitada a 512 KB e 500 itens, campos aparados (título 120, conteúdo 8000), áudio só como nome de arquivo da lista; lista padrão limitada a 400 itens.
- **Áreas do admin** (snippets e sugestões): 5 tentativas erradas bloqueiam por 3 minutos; senha guardada fora do texto puro; campos com `maxlength`.
- **Escape de HTML** em todo texto dinâmico que entra em `innerHTML` (painéis, menus e listas) e logs sem nomes de conversas/grupos.

### Permissões e por que são necessárias

| Permissão | Motivo |
|---|---|
| `tabs` | Abrir links e injetar scripts nas abas liberadas |
| `scripting` | Injetar os scripts da extensão nas páginas (snippets, relatos, barra) |
| `activeTab` | Ação rápida na aba ativa quando você clica no ícone |
| `storage` | Salvar snippets, configurações e preferências localmente |
| `offscreen` | Tocar os áudios dos snippets (áudio precisa de documento em segundo plano na MV3) |
| `alarms` | Atualizar a lista padrão de snippets do GitHub a cada 60 minutos |

Permissão de host para `https://raw.githubusercontent.com/*`: usada **apenas** para baixar o JSON da lista padrão de snippets do repositório oficial.

Permissão de host para `https://whatsapp.hubly.software/*`: usada **apenas** pelas chamadas REST do botão PROX (instância, QR Code, grupos, envio e desconexão) na sua Evolution API.

Permissões de site **opcionais** (`optional_host_permissions`): usadas apenas quando você clica em "Permitir snippets neste site" — o Chrome mostra o pedido e você decide.

### Boas práticas para quem instala localmente
- Baixe a extensão apenas deste repositório oficial.
- Confira o `manifest.json` se for contribuir com código de terceiros.
- Ao atualizar a instalação local, substitua a pasta inteira e recarregue em `chrome://extensions`.

## Preferências de privacidade (resumo para a Chrome Web Store)

- Dados coletados: **nenhum** sai do seu computador (exceto a API Key do seu servidor de Zap, usada como autenticação no próprio servidor, e a mensagem PROX que você escolheu enviar para o seu grupo).
- Uso de rede: **duas finalidades** — baixar o JSON da lista padrão de snippets do repositório oficial `Lucasmagista/EXTENSAO-CALL-CENTER` no GitHub (dados, não código) e falar com a sua Evolution API em `whatsapp.hubly.software` (ações do botão PROX). Sem telemetria.
- Compartilhamento com terceiros: nenhum.
