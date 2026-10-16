# Changelog

Todas as mudanças notáveis nesta extensão são documentadas aqui.
O formato segue o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.22] — 2026-10-16

### Adicionado
- **Botão "Mensagens" não abre mais o WhatsApp Web**: o painel de mensagens rápidas agora abre **na aba que você já está usando** (qualquer site) — a extensão parou de criar/focar uma aba do web.whatsapp.com. Se o WhatsApp já estiver aberto, use o painel por ele; se não, ele aparece na tela atual, como os Relatos já faziam.
- **Snippets: padrão só o admin mexe**: os snippets **padrão** agora estão **bloqueados** para operadoras (campos desabilitados, excluir desabilitado, checkbox de exclusão em massa travado). Quem quiser mexer entra na nova **Área do administrador** (rodapé da lista, mesma senha do admin das sugestões): ele edita/apaga padrões (as edições ficam protegidas da sobrescrita automática do GitHub) e pode marcar um snippet LOCAL como padrão com o checkbox "Marcar como padrão". Snippets novos do admin ganham o selo **NOVO** e viram padrão automaticamente **7 dias** depois.
- **Snippets: tags LOCAL e NOVO**: tudo que a operadora criar ganha a tag **LOCAL** (amarela) — só existe no navegador dela; os continuam com a tag **padrão** (verde). "Selecionar todos" e "Apagar selecionados" só mexem nos LOCAL — **nunca** nos padrão.
- **Snippets: aviso ao criar novo**: ao clicar em + Novo aparece o aviso de que o snippet é **somente seu**; para compartilhar com o time, use o botão **Sugestões** da extensão.
- **Snippets: Importar/Exportar em um botão só (modal)**: um único botão abre a modal com **Exportar meus snippets (.txt)** — leva **apenas os LOCAL**, nunca os padrão —, **Importar arquivo (.txt ou .json)** — entra como LOCAL, não sobrescreve padrão, e mostra quanto adicionou/atualizou/ignorou — e **Baixar modelo em branco (.txt)** comentado (blocos `ATALHO:`/`TITULO:`/`AUDIO:`/`CONTEUDO:` separados por `---`, quantidade ilimitada). O formato antigo .json continua aceito.
- **Snippets: layout corrigido**: a tela agora usa altura flexível (nada sai da janela nem precisa de zoom), barra lateral com lista rolável, área do administrador fixa no rodapé da lista e tamanhos proporcionais em telas de 1280px+.
- **Configuração de som movida para a tela Configurações**: o slider "Volume dos sons" e o "Som de confirmação" (Trocar…/Ouvir/Padrão) saíram da tela principal e agora ficam na tela **⚙️ Configurações**, logo abaixo de "Forma de acesso (padrão)" (Flutuante / Barra lateral / Ambos) — tudo que mexe com o comportamento da extensão reunido no mesmo lugar.
- **Créditos "Magista" viram link**: em todas as telas da extensão (popup, snippets, modal PROX, modal do suporte, modal de Sugestões, senha Wi-Fi x6, barra lateral, README e política de privacidade) o nome **Magista** agora é um link clicável para **https://www.magista.dev/** (abre em nova aba, sem sair da página em uso).

### Security
- **Endurecimento geral do pacote** (varredura de segurança em todos os arquivos): background agora **valida tudo que chega por mensagem** — sugestões com nome obrigatório, texto de 10 a 1500 caracteres, email com regex rígida e todos os campos aparados (sem caracteres de controle); API Key testada contra formato rígido (`8 a 200 caracteres`) **antes** de qualquer chamada à rede; id/nome de grupo limitados; lista de snippets com teto de 400 itens, títulos de 200 e conteúdos de 10000 caracteres, áudio só como nome de arquivo válido.
- **Anti-spam das sugestões com janela própria**: no máximo **3 sugestões a cada 10 minutos** por navegador (independente do limite do PROX, que continua 5 em 30 segundos) — o grupo do suporte não vira fila de spam.
- **Chave embutida não sai mais do background**: `proxLerConfig`/`suporteLerConfig` passaram a devolver a API Key **somente quando ela foi digitada manualmente** (a chave do pacote fica só no service worker; as modais continuam pré-preenchendo a chave manual normalmente).
- **Só a própria extensão acessa as telas de configuração**: o listener de mensagens do PROX/suporte/sugestões recusa qualquer mensagem cujo remetente não seja a extensão (`sender.id` conferido).
- **CSP explícito no manifest** (`script-src 'self'; object-src 'self'`), reforçando o padrão do Manifest V3 contra script injetado.
- **Áudios trancados no offscreen e no popup**: som personalizado só toca se for `data:audio/` com até 700.000 caracteres; áudios de arquivo precisam estar em `assets/`, sem `..` no caminho e com extensão conhecida (mp3/wav/ogg/m4a/aac/webm); o popup valida tipo e tamanho do arquivo **antes** de salvar no storage.
- **Importação de snippets com limites**: arquivo de no máximo 512 KB, até 500 itens por importação, título aparado em 120 e conteúdo em 8000 caracteres, áudio só se for nome de arquivo válido da lista — formato .txt e .json.
- **Bloqueio por tentativa nas áreas do admin** (snippets e sugestões): 5 senhas erradas bloqueiam a caixa por 3 minutos; os campos de senha/chave ganharam `maxlength`; as senhas deixaram de aparecer em texto puro nos arquivos (guardadas em códigos) e saíram das menções do CHANGELOG.
- **Menos vazamento em log e HTML**: console do fluxo de relatos não imprime mais os nomes de conversas/grupos, e todo texto dinâmico que entra em `innerHTML` passou por escape (incluindo aspas) nos painéis e menus.

---

## [1.21] — 2026-10-15

### Adicionado
- **Limite anti-spam no envio do PROX**: no máximo **5 mensagens em 30 segundos** por navegador; atingindo o limite, o próximo envio é bloqueado com aviso claro ("Aguarde Xs… limite anti-spam de 5 mensagens a cada 30 segundos — enviar em rajada coloca sua conta do WhatsApp em risco de bloqueio"), liberado automaticamente quando a janela deslizar. O aviso aparece no popup, no botão flutuante, na barra lateral e na modal (que também informa o tempo restante ao abrir). Contagem só de mensagens enviadas com sucesso e guardada no `chrome.storage.local`.
- **Aviso de segurança na modal PROX**: banner "Ambiente seguro e criptografado (HTTPS) — sua chave e os dados ficam somente neste navegador, nada é compartilhado com terceiros" no topo da tela de conexão (e o mesmo aviso curto no passo da API Key), para a operadora conectar sem receio.
- **Animação ao conectar**: depois de ler o QR, a tela passa a mostrar spinner + "Conectado! Buscando os grupos do seu WhatsApp…" na coluna dos grupos, com entrada suave (fade/slide) dos painéis de conectado e de grupos — a busca de até 30 segundos não parece mais uma tela travada.
- **Som de confirmação quando o comando dá certo**: ao inserir/enviar uma mensagem no chat por resposta rápida (botão "Mensagens"), relato, snippet ou fluxo "✅" (Alt+L), a extensão emite um "ding" curto avisando a operadora que funcionou. O som é sintetizado na hora (não é arquivo, funciona offline), respeita e é regulado pelo slider **Volume dos sons** do popup — que agora vale para os áudios dos snippets e para essa notificação; em 0% tudo fica mudo. Painéis que rodam no contexto da página (MAIN world) avisam a extensão por um evento local, sem permissão nova.
- **Menu do proprietário por gesto secreto**: o link "Alterar API Key" da modal PROX passou a vir oculto; **4 cliques em até 2 segundos** no rodapé da modal ("Desenvolvido por Magista") ou no logo Alares liberam o botão e mostram o aviso "Menu do proprietário liberado." — assim a operadora comum não troca a chave sem querer, mas o administrador continua com acesso sem precisar de modo de desenvolvedor.
- **Ícones vetoriais Lucide em toda a interface** (SVGs inline oficiais, licença ISC, embutidos no pacote — nenhum CDN): modal PROX (chave, smartphone, grupos, QR, atualizar, desconectar, checks), popup (sprite de 18 símbolos), botão flutuante, barra lateral e as telas de snippets, decodificador Wi-Fi e relatório Huawei. Os emojis decorativos de interface foram todos substituídos por esses ícones; emojis dentro de mensagens enviadas ao chat (relatos, respostas rápidas, fluxo "✅") permanecem, pois fazem parte do conteúdo.
- **Card do grupo fixo na modal PROX**: depois de escolher o grupo ele não some mais — fica um card fixo no topo da coluna ("Grupo escolhido" + nome + ✓ verde brilhando) e a lista de busca fica recolhida, liberando espaço; um botão **"Trocar grupo"** (ícone de atualizar, gira no hover) reabre a busca e atualiza a lista na hora, sem precisar reconectar.
- **Botão "Aa" de caixa alta nos painéis de relatos e mensagens rápidas**: canto superior direito dos dois painéis, alterna entre mandar a mensagem **como digitada** ou **toda em MAIÚSCULAS**; o estado fica guardado no navegador (`ccTools_maiusculas`), vale para os dois painéis e a resposta vem do relay da extensão — os painéis rodam no contexto da página (MAIN world) e não têm acesso direto ao storage.
- **Som de confirmação personalizado**: junto do slider "Volume dos sons", a operadora pode trocar o "ding" padrão por um **arquivo de áudio dela** (MP3/WAV/OGG até 500 KB, "Trocar…"), ouvir na hora ("Ouvir") e voltar ao padrão ("Padrão"). O arquivo fica guardado **só neste navegador** (`chrome.storage.local`, data URL — nunca sai do computador) e passa a tocar no volume escolhido em todos os comandos que dão certo no chat; sem arquivo, toca o sintetizado de sempre.
- **Botão "Sugestões" vira MODAL na aba (igual à do WhatsApp)**: o botão da popup agora abre a tela **"Sugestões" como modal injetada na aba ativa** — mesmo visual dark da modal do PROX, com logo Alares, botão de fechar e Esc. A tela interna da popup foi removida. O formulário foi **ampliado e padronizado**: **função** da extensão, **nome (obrigatório)**, **email (opcional — validação rígida: só email de verdade com domínio e final, ex.: ana@empresa.com; e antes de enviar a pessoa **confirma se é esse o email onde quer receber as notificações** do suporte — "Sim, confirmar" ou "Corrigir email"; editar o email volta a exigir a confirmação)**, **setor** e **período** como **campos de texto livre** (a pessoa escreve), e **"O que você quer adicionar"** com contador de 1500. A mensagem que chega no grupo do suporte segue um **padrão fixo com todos os campos** (`💡 SUGESTÃO — CallCenter Tools` + função, nome, email informado/não, setor, período e o texto); sem grupo configurado, o texto pronto é copiado para colar. A **área do admin** (senha) também migrou para dentro da modal (rodapé).
- **Área do admin na tela de Sugestões (senha do proprietário)**: no rodapé da tela de Sugestões há uma caixa discreta com cadeado ("Área do admin"); com a senha certa o admin abre a **modal "WhatsApp do Suporte"** — cópia da modal do PROX — onde **conecta o WhatsApp da equipe** (instância própria `sug-xxxxx`, com QR que se renova sozinho) e **escolhe o grupo que vai receber as sugestões** das operadoras. A API Key é a mesma do PROX (compartilhada); instância, grupo e envio são próprios do suporte. Escolher o grupo atualiza na hora o destino do botão "Enviar sugestão" (as operadoras continuam com o fluxo normal — só o admin vê a caixa). O "Alterar API Key" já aparece direto nesta modal (quem chegou aqui tem a senha).

- **Botão "Enviar PROX" de volta, agora via WhatsApp (Evolution API do servidor `whatsapp.hubly.software`)**: dividido "meio a meio" na popup — o lado esquerdo envia direto no grupo escolhido e fica **verde ✓ Conectado**; o lado direito (⚙) abre a modal de configuração. Os mesmos dois itens ("📨 Enviar PROX" e "⚙ Configurar PROX") aparecem no menu do botão flutuante e na barra lateral, e o atalho **Alt+P** voltou no manifest. A modal tem **duas colunas**: à esquerda o status e o **QR Code** (que se renova sozinho até ser lido); à direita a **lista dos grupos** do número — que só aparece depois de conectar — com busca, grupo atual, campo da **mensagem (editável, padrão "prox")** e botão **[🔌 Desconectar]**. Cada navegador cria a sua própria instância na Evolution API (`prox-xxxxx`), então cada operadora escaneia com o próprio zap. **A API Key vem embutida no pacote** no arquivo local `assets/prox-servidor.json` (gitignorado: o repositório é público e a chave jamais é versionada) — quem instala o pacote oficial já vai direto pro QR sem digitar nada; o campo da chave só aparece se o arquivo faltar, e "Alterar API Key" permite sobrescrever ou voltar para a do pacote. Endpoints usados: `instance/create`, `instance/connect` (QR), `instance/connectionState`, `group/fetchAllGroups`, `message/sendText` e `instance/logout` — só chamadas REST de dados, nenhum código remoto é executado (justificativa da loja atualizada).
- **Sincronização da lista padrão de snippets com o GitHub restaurada**: o botão "🔄 Atualizar padrão" da tela de snippets volta a buscar o arquivo `assets/snippets-padrao.json` do repositório público `Lucasmagista/EXTENSAO-CALL-CENTER` (branche `main`), com sincronização automática a cada 60 minutos (alarme `syncSnippetsPadrao`) e fallback para a cópia embutida no pacote quando o GitHub não responde. O status na tela de snippets indica a origem da última atualização ("do GitHub" ou "(cópia local)"). Regras de mesclagem inalteradas: snippets criados/editados pelo usuário nunca são alterados; apagados não voltam sem confirmação.
- Arquivos de marca Alares restaurados no pacote (removidos na 1.18): `assets/alares.png`, `assets/alares-icon.webp` e `assets/Logo-Alares.png` — agora usados no popup, tela de snippets e no modal do decodificador (a 1.18 os removeu por política de marca, mas a equipe decidiu manter a identidade Alares).

### Alterado
- **Redesign visual completo da modal PROX**: paleta tinta/azul escura (`#0d1b3d → #16305e`) com card `#0a1224`, logo Alares no topo, título sem emoji, badge de status com ícones alternados e botões com rótulos dinâmicos (Salvar chave / Salvar padrão / Desconectar) — visual consistente com o restante da extensão.
- **Tela de "Conectado" da modal PROX renovada**: card verde em gradiente com glow interno, check grande que pulsa (mesmo efeito do site) e texto "Conectado! Grupos carregando…" que sobe com fade — parece a mesma linguagem visual do site da Alares, não mais um card genérico.
- **Animações de ícone em todos os botões** (mesmas do site: pulse, bounce e fade de entrada): ícones crescem no hover, o "Enviar PROX" dá bounce enquanto o mouse está em cima, o ✓ verde pulsa quando conectado, e os painéis de relatos/mensagens rápidas ganham fade + scale de entrada — popup, tela de snippets, botão flutuante e barra lateral.
- **Rodapé da modal PROX só com créditos Magista** ("Ferramenta interna · Alares Internet — Desenvolvido por Magista"); popup, menus e demais telas mantêm "Mometto e Diogo — Magista".
- Moldura da modal de Senha Wi-Fi x6 (frame do background) com ícones Lucide no título (Wi-Fi) e no botão fechar; telas de snippets (Atualizar/Exportar/Importar/Apagar/Testar/Salvo) e decodificador (tema, copiar, selo, dropzone) idem.
- Ícone da barra fixada do Chrome trocado: o swoosh Alares do `icons/favicon.ico` foi extraído e gerado em `icons/toolbar16/32/48.png`, usado pelo `action.default_icon` (a arte "Tropa do Call Center" continua no ícone da página de gestão/loja).
- Foto do popup (tela ao clicar no ícone da barra) trocada pela assinatura branca Alares (`assets/alares.png`).
- Logo da Alares (`assets/alares.png`) também na tela de snippets: cabeçalho e estado vazio do editor.
- Botão "💬 Mensagens" agora funciona de **qualquer site**: se o WhatsApp já estiver aberto, a extensão foca a aba dele; se não, abre uma nova e injeta o painel de mensagens rápidas assim que a página carrega.
- Logo da Alares no popup virou link para o site oficial (`www.alaresinternet.com.br`).
- Permissões de volta no `manifest.json`: `alarms`, `https://raw.githubusercontent.com/*` (JSON da lista padrão) e `https://whatsapp.hubly.software/*` (Evolution API do botão PROX — só chamadas REST de dados; nenhum código remoto é executado; as justificativas de "código remoto" da loja descrevem os dois casos).
- `privacidade.html`, `SECURITY.md` e `README.md` atualizados para refletir as duas requisições de rede (JSON de dados da lista padrão no GitHub e chamadas REST da Evolution API de PROX).
- Rótulo do controle de volume na popup: "Volume do áudio" virou **"Volume dos sons"**, deixando claro que ele regula tanto os áudios dos snippets quanto o som de confirmação dos comandos no chat.

### Corrigido
- **Campos de relatos e mensagens rápidas saindo em MAIÚSCULAS sem querer**: o CSS do WhatsApp (`text-transform: uppercase` herdado) fazia o número digitado na busca e o texto dos campos de preenchimento aparecerem todos em caixa alta. Agora todos os campos dos painéis forçam `text-transform: none` — o que a operadora digita sai exatamente como digitou (e o botão "Aa" dá a escolha de mandar em maiúsculas quando ela quiser).
- **Botão "Mensagens" do popup travado no WhatsApp**: ele recusava com "Abra o WhatsApp Web para usar as mensagens rápidas" se a aba ativa não fosse do WhatsApp. Agora funciona em qualquer tela — se o WhatsApp já estiver aberto em alguma aba ele foca ela; se não, abre uma nova e injeta o painel assim que a página carrega (com espera extra se a aba ainda estiver carregando). Painéis de injeções antigas são removidos antes de abrir um novo.
- **Erro de runtime no `prox-modal.js` ao interagir com a modal depois de ela fechar**: funções como `atualizarQR`, `carregarGrupos` e `renderGrupos` seguiam rodando após o `await` e tentavam escrever em elementos já removidos (`Cannot set properties of null`), poluindo o console e, em alguns caminhos, quebrando o fluxo. Todas as operações passaram a checar `modalViva()` antes de tocar no DOM, com guardas nos pós-`await` e nas pinturas de status.
- **"Desconectar" acusava falha mesmo com a instância já caída**: o servidor da Evolution pode responder `400 The instance is not connected` (já desconectada) ou `500` na corrida em que a instância termina de fechar durante o logout — os dois casos mostravam "Falha ao desconectar (HTTP …)". Agora `400 "not connected"` conta como sucesso e qualquer outro erro confere o estado real (`connectionState`) antes de avisar: se não está mais `open`, a desconexão aconteceu.
- **Campo "Áudio ao usar" dos snippets ignorava o som escolhido**: ao expandir um atalho no chat era tocado sempre o mesmo arquivo fixo (bonk), nunca o áudio configurado no snippet. Agora o snippet toca o áudio escolhido (em volume do slider); sem áudio configurado, toca o som de confirmação padrão.
- **Botão flutuante e barra lateral criando vários botões** em sites com iframes (paineis, ads, `about:blank`): os content scripts de UI rodavam com `all_frames: true` e cada iframe recebia o seu próprio botão. Agora a UI só é injetada no frame principal — no `manifest.json` os scripts foram separados (snippets seguem em `all_frames`, UI em frame principal) e o registro dinâmico dos sites extras ganhou o prefixo `ccTools-ui-*` também só no topo, com atualização automática dos registros antigos. Camadas extras de segurança: guarda `window.top !== window` nos dois scripts e remoção de órfãos deixados por injeções anteriores.
- **Decodificador de senha Wi-Fi (X6) não encontrava as redes** em vários arquivos `hw_ctree.xml`: a extração só entendia uma estrutura específica (atributo `PreSharedKey="..."` dentro de `<WLANConfigurationInstance>`). Reescrita para varrer o XML inteiro e decodificar qualquer formato — atributo ou elemento (`<PreSharedKey>`, `<KeyPassphrase>`, `<WPAPsk>`), com o SSID capturado antes ou depois da chave — além de leitura com detecção de codificação (UTF-8/UTF-16/windows-1252), validação pelo conteúdo (não mais só pela extensão `.xml`) e aviso claro quando o arquivo enviado é o backup criptografado `.enc` do roteador. Criptografia AES-256 validada contra o test vector público e round-trip (15 testes automatizados).
- **Tabela de resultados não aparecia na modal do X6** mesmo com a decodificação funcionando: a regra `body { display: flex; justify-content: center; }` do HTML é reescrita para `#cc-senha-wifi-corpo` na injeção da modal, transformando o corpo em flex container de altura fixa que esmagava as seções inferiores — o cartão da tabela colapsava para ~2px (duas linhas finas escuras) e o conteúdo era cortado. A centralização da página passou a usar `margin: 0 auto` no `.dx-wrap`, sem flex no `body`; a tabela (SSID, senha e botão "📋 Copiar") agora renderiza inteira dentro da modal.

### Removido
- Botão **"📨 Enviar prox" antigo** (que mandava "prox" no Rocket.Chat via automação de DOM) e o atalho `Alt+P` daquele fluxo: substituídos pelo novo PROX via WhatsApp descrito acima — o atalho `Alt+P` voltou apontando para o fluxo novo e o botão "✅ Enviar ✅" (`Alt+L`) no Rocket.Chat permanece como estava.

---

## [1.19] — 2026-10-13

### Adicionado
- Tela modal "Senha Wi-Fi x6": os três botões (popup, botão flutuante e barra lateral) agora abrem um modal sobre a página (760×560, fecha no ✕, no fundo escuro ou no ESC) com o conteúdo do arquivo `SENHA WIFI X6.html` (Decodificador de Senha WiFi — Oquei Telecom).
- `senha-wifi-x6.js`: JavaScript do decodificador (extraído do HTML) executado como content script dentro da modal — dropzone, decodificação AES, tabela com senha/copy e tema claro/escuro funcionam sem depender do CSP da página.

### Alterado
- O botão deixou de abrir o site externo `oquei-decodificar.lovable.app`; toda a lógica fica no background (handler `mostrarModalSenhaWifi`), compartilhada pelos três botões.
- O conteúdo é injetado direto na página (`innerHTML`) em vez de iframe: o CSP do WhatsApp (`frame-src` sem `chrome-extension:`) bloqueia molduras da extensão. O CSS do arquivo é reescrito para aplicar apenas dentro do container da modal (`#cc-senha-wifi-corpo`), sem afetar o layout da página.
- Redesign completo do decodificador (baseado no mockup `decodificador_wifi_oquei_telecom.html`, mas com decodificação real e sem CDNs): selo com o modelo do aparelho (Huawei OptiXstar EG8041X6-10), card de instruções com o caminho passo a passo, dropzone com ícone e estados de hover/arraste, spinner de carregamento, tabela de resultados com coluna "Ação" (copiar) e nome do arquivo no cabeçalho, animações de entrada e estilos 100% autocontidos.
- Rebranding: ícone e logotipo Alares (`assets/alares-icon.webp` e `assets/Logo-Alares.png`) embutidos como data URI (o CSP das páginas só permite `data:` em `img-src`), rodapé "Ferramenta interna · Alares Internet" e créditos "Desenvolvido por Mometto, Diogo e Magista".
- Estilos escopados com prefixo `dx-` (ids e classes) para não colidir com CSS/IDs das páginas onde a modal é injetada.

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

[1.22]: https://github.com/Lucasmagista/EXTENSAO-CALL-CENTER/commits/main
[1.21]: https://github.com/Lucasmagista/EXTENSAO-CALL-CENTER/commits/main
[1.20]: https://github.com/Lucasmagista/EXTENSAO-CALL-CENTER/commits/main
[1.19]: https://github.com/Lucasmagista/EXTENSAO-CALL-CENTER/commits/main
[1.18]: https://github.com/Lucasmagista/EXTENSAO-CALL-CENTER/commits/main
[1.17]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.16]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.15]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.14]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.13]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.12]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.11]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.10]: https://github.com/lv777x/call-center-tools/commit/HEAD
[1.9]: https://github.com/lv777x/call-center-tools/commit/HEAD
