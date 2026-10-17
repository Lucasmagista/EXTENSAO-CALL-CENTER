# Política de Segurança

## Versões suportadas

| Versão | Suportada |
|---|---|
| 1.25.x (Chrome Web Store) | ✅ Sim |
| 1.24.x (Chrome Web Store) | ✅ Sim |
| 1.23.x (Chrome Web Store) | ✅ Sim |
| 1.22.x (Chrome Web Store) | ✅ Sim |
| 1.21.x (Chrome Web Store) | ✅ Sim |
| 1.18–1.20.x (Chrome Web Store) | ✅ Sim |
| <= 1.17 (instalação local) | ⚠️ Somente correções críticas via novo release no repositório |

Use sempre a versão mais recente. Na Chrome Web Store, as atualizações são aplicadas automaticamente.

## Relatar uma vulnerabilidade

Se você encontrou uma falha de segurança nesta extensão:

1. **Não abra uma issue pública.**
2. Envie um e-mail ou mensagem privada para os mantenedores ([Mometto](https://github.com/lv777x) / [Diogo](https://github.com/PaulaoMecanicas11) — Magista) pelo GitHub: [github.com/Lucasmagista](https://github.com/Lucasmagista)
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
- Baixa também o **arquivo de configuração de suporte** `assets/suporte-config.json` do mesmo repositório (apenas dados: o `grupoSuporte` e a `instancia` (`sug-xxxxx`, identificador sem credencial) escolhidos pelo admin — **sem nenhuma chave**), na mesma sincronização de 60 minutos, com cache local de 30 minutos e fallback para a cópia embutida no pacote.
- **Botão PROX**: chama por REST a sua própria Evolution API em `whatsapp.hubly.software` (criar instância, QR Code, listar grupos, enviar a mensagem no grupo escolhido e desconectar) — somente quando você usa o botão, autenticado pela API Key que vem **embutida no pacote** (`assets/prox-servidor.json`, arquivo local **gitignorado** — o repositório nunca contém a chave) ou por uma chave **digitada por você** via "Alterar API Key"; em ambos os casos a chave usada fica apenas no `chrome.storage.local`.
- **Botão Sugestões**: abre uma modal com o formulário (função, nome obrigatório, email opcional, setor, período e descrição) e usa as chamadas REST da Evolution API (estado da instância + `message/sendText`) para entregar a **mensagem padrão** ao grupo de suporte no WhatsApp — instância própria do suporte (`sug-xxxxx`, escolhida pelo admin na área protegida por senha dentro da própria modal; nas máquinas sem suporte local a instância **propagada pelo admin** em `assets/suporte-config.json` é usada no lugar, com o destino vindo do grupo publicado ali ou da sobrescrita local `ccTools_sugestaoGrupo`) — somente quando você clica em "Enviar sugestão"; sem destino configurado, nenhuma requisição é feita e o texto pronto é copiado para a área de transferência.

### O que esta extensão NÃO faz
- ❌ **Não baixa nem executa código de fora do pacote publicado** — as requisições de rede são de **dados**: o JSON da lista padrão de snippets, o `assets/suporte-config.json` (grupo de suporte e instância `sug-xxxxx` escolhidos pelo admin) e as chamadas REST da Evolution API do PROX/Sugestões; nenhuma extensão de código é baixada ou executada remotamente (política de código remoto da Chrome Web Store — o antigo updater de arquivos foi removido).
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

### Medidas de endurecimento (1.24)
- **Senha do admin verificada só no fundo**: as telas não guardam senha — enviam `adminValidarSenha` e o service worker valida com **PBKDF2-SHA256, 250.000 iterações e salt próprio** (a senha não existe em HTML/JS/CSS de nenhuma tela); a interface só recebe um **token de sessão de 8 horas**.
- **Bloqueio de tentativas persistente**: 5 senhas erradas bloqueiam a área do admin por 3 minutos com o bloqueio **salvo no storage** (não zera ao fechar a tela, vale para a próxima abertura).
- **Área do suporte atrás do token**: abrir a modal do suporte e ler/gravar instância/grupo (`suporte*`) exigem o token de admin; sem ele, a resposta é `sessaoExpirada` com aviso para entrar de novo.
- **Chave do pacote com fallback limpo**: o ZIP oficial segue trazendo a chave em `assets/prox-servidor.json` (arquivo local, **fora do git**); o fundo agora aceita o arquivo também **sem `apikey`** — instalação sem chave só pede a digitação na modal, sem quebrar — e continua **nunca devolvendo** a chave do pacote nas respostas `proxLerConfig`/`suporteLerConfig`.
- **Validação uniforme em todos os cinco listeners do fundo**: `ehRemetenteProprio` (remetente = própria extensão), tipo de mensagem conhecido, `msgTexto` aparando textos na entrada (runFlow: grupo 200, mensagem 4000, tag 30) e `msgOrigemSite` exigindo `https://host` para sites de snippet; `tabId` só numérico.
- **Só HTTPS para sites extras**: `optional_host_permissions` restrito a `https://*/*` e a popup recusa sites http ("Sites não HTTPS não são liberados").
- **Shadow DOM nas modais** (PROX, Suporte, Sugestões): conteúdo montado em `attachShadow` — CSS/JS da página não alcança a modal e o CSS da modal não vaza para a página.
- **Propagação de config sem segredo**: o `assets/suporte-config.json` baixado do GitHub carrega **apenas** `grupoSuporte`/`grupoNome`/`instancia` (identificador `sug-xxxxx`, validado por `normalizarSuporteCfg` com formato rígido antes de usar — sem a API Key não serve para nada) /`atualizadoEm`, com cache de 30 minutos, TTL de 60 minutos no alarme e fallback para a cópia embutida. Editar a propagação continua sendo só na área do admin (senha + token).

### Permissões e por que são necessárias

| Permissão | Motivo |
|---|---|
| `tabs` | Abrir links e injetar scripts nas abas liberadas |
| `scripting` | Injetar os scripts da extensão nas páginas (snippets, relatos, barra) |
| `activeTab` | Ação rápida na aba ativa quando você clica no ícone |
| `storage` | Salvar snippets, configurações e preferências localmente |
| `offscreen` | Tocar os áudios dos snippets (áudio precisa de documento em segundo plano na MV3) |
| `alarms` | Atualizar a lista padrão de snippets e a config do suporte do GitHub a cada 60 minutos |

Permissão de host para `https://raw.githubusercontent.com/*`: usada **apenas** para baixar dados JSON do repositório oficial — a lista padrão de snippets (`assets/snippets-padrao.json`) e a configuração de suporte (`assets/suporte-config.json`, sem chave).

Permissão de host para `https://whatsapp.hubly.software/*`: usada **apenas** pelas chamadas REST do botão PROX/Sugestões (instância, QR Code, grupos, envio e desconexão) na sua Evolution API.

Permissões de site **opcionais** (`optional_host_permissions`): restritas a `https://*/*`, usadas apenas quando você clica em "Permitir snippets neste site" — o Chrome mostra o pedido e você decide; sites sem HTTPS não são sequer solicitáveis.

### Boas práticas para quem instala localmente
- Baixe a extensão apenas deste repositório oficial.
- Confira o `manifest.json` se for contribuir com código de terceiros.
- Ao atualizar a instalação local, substitua a pasta inteira e recarregue em `chrome://extensions`.

## Preferências de privacidade (resumo para a Chrome Web Store)

- Dados coletados: **nenhum dado pessoal** sai do seu computador. O que trafega: a API Key digitada por você (como autenticação no **seu** servidor, nunca em terceiros), a mensagem PROX que você escolheu enviar para o seu grupo e, se você usar o formulário de Sugestões, o conteúdo preenchido (função, nome, email opcional, setor, período e descrição) entregue ao **grupo de suporte escolhido pelo admin**.
- Uso de rede: **três finalidades** — (1) baixar dados JSON do repositório oficial `Lucasmagista/EXTENSAO-CALL-CENTER` no GitHub (lista padrão de snippets + config de suporte, sem chave, nunca código executável); (2) falar com a sua Evolution API em `whatsapp.hubly.software` (PROX e envio de sugestões, só quando você usa os botões). Sem telemetria.
- Compartilhamento com terceiros: nenhum.
