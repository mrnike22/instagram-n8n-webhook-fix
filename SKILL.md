---
name: meta-instagram-n8n-ativacao
description: "Checklist e troubleshooting para ativar a integração Instagram Business API + n8n (comentários e DMs automatizados via webhook)."
---

# Ativação Instagram Business API + n8n

Runbook baseado na depuração real do bot do Método ACTO (25/08/2026) e Nelson AI (08/09/2026). Percorra os passos NESSA ORDEM — cada um desbloqueia o próximo. Pular etapas é a causa mais comum de "não sei o que está errado".

## 0. Pré-requisitos

- App criado no Meta Developer Console, com o produto "Instagram API" (use case) adicionado.
- Conta do Instagram já é uma conta Business/Creator vinculada a uma Página do Facebook.
- Workflow n8n já existe (clonado de um template) com um node `Instagram Trigger` (`n8n-nodes-instagram-token.instagramTrigger`) e um node de credencial `instagramAccessTokenApi`.

## 0.5. App type "Negócio" — pré-requisito pra ter a tela certa (achado 26/08/2026, bot da Billie)

Existem dois produtos diferentes de Instagram no Meta Console, e qual deles fica disponível depende do **tipo do app**, definido na criação e **impossível de mudar depois**:

- **App tipo "Nenhum"** (apps antigos criados sem escolher tipo): só tem o produto clássico "Instagram Graph API" (baseado em Facebook Login, exige Página do Facebook, permissões `instagram_basic`/`instagram_manage_*`). **Não tem** o menu "Use cases" nem a tela "API setup with Instagram business login" com o botão "Add account"/"Generate access tokens" que este runbook usa.
- **App tipo "Negócio"**: tem o menu **Use cases → Customize → Instagram API** (ou já aparece direto como produto "Instagram" em Products), com a tela "API setup with Instagram business login" — é essa tela que os passos 1, 3 e 4 abaixo descrevem.

Se ao abrir o app o menu "Use cases"/produto "Instagram" com essa tela não existir, **não adianta procurar mais** — o app é tipo "Nenhum" e não dá pra converter. **Resolva assim:**
1. Crie um app NOVO em developers.facebook.com/apps/create/, tipo **"Negócio"**.
2. Na mesma tela de criação, já conecte ao Business Portfolio correto (campo "Business portfolio" — evita ter que conectar depois).
3. Em Products, clique "Set up" em **Instagram** (não confundir com o card de outro produto). Isso leva direto pra "API setup with Instagram business login".
4. Não precisa apagar o app antigo — os dois podem coexistir. Exclusão de app é ação irreversível, só o dono da conta pode fazer.

## 0.6. Instagram Tester — obrigatório antes de "Add account" funcionar

Na tela "API setup with Instagram business login", a seção "1. Generate access tokens" avisa: *"Before proceeding, make sure to assign the Instagram Tester role to the account in the Roles tab."* Sem isso, tentar adicionar a conta falha ou nunca aparece pra selecionar.

Como resolver:
1. App settings → **App roles → Papéis (Roles)** → botão "Add People".
2. Escolha o papel **"Instagram Tester"** (fica em "Additional roles for this app", separado dos papéis padrão tipo Administrator/Developer).
3. Digite o **username do Instagram** da conta do cliente (ex. `billie_loja`) e adicione.
4. O convite fica com status **"Pending"** — só o dono/quem tem login da conta consegue aceitar, dentro do próprio app do Instagram: **Configurações → Apps e sites → Convites em espera (Tester Invites)**. É um login, então só o cliente pode fazer esse passo — nunca insira credenciais por ele.
5. Só depois do convite aceito (status muda de "Pending") é que o botão "Add account" da tela de setup funciona de verdade.

## 1. Permissões do app (Meta Console → Customize → Instagram API → Permissions and features)

Confirme que estão marcadas:
- `instagram_business_basic`
- `instagram_business_manage_comments`
- `instagram_business_manage_messages`

Sem isso, nada mais funciona — resolva antes de seguir.

## 2. Tabelas do Postgres (se o workflow foi clonado de outro cliente)

Workflows clonados (ex. do template "SpecialCred") esperam tabelas com prefixo do novo projeto (ex. `acto_clients`, `acto_instagram_posts`, `acto_analytics`) que **não existem ainda** no banco compartilhado. Sintoma: execução do n8n falha em um node Postgres com `relation "xxx_clients" does not exist`.

Como resolver:
1. Descubra qual credencial Postgres o workflow usa (`list_credentials` no n8n) e a quais tabelas ele referencia (procure todos os nodes Postgres do workflow).
2. **Antes de criar tabelas**, rode uma query de diagnóstico pra confirmar que é um banco compartilhado multi-cliente e que os nomes novos não colidem com tabelas de outro cliente:
   ```sql
   SELECT current_database() AS db, current_user AS usr,
     (SELECT string_agg(table_name, ', ') FROM information_schema.tables WHERE table_schema='public') AS public_tables;
   ```
3. Crie as tabelas faltando com `CREATE TABLE IF NOT EXISTS`, usando SEMPRE um prefixo específico do cliente/projeto (ex. `billie_clients`, nunca `clients` genérico) — evita colisão com dados de outros clientes no mesmo Postgres.
4. **Cuidado com o n8n MCP `update_workflow` / `setNodeParameter`**: o `path` é relativo a `node.parameters`, não ao node inteiro. Pra editar o campo principal "Query" de um node Postgres, o path certo é `/query`, NÃO `/parameters/query` (isso cria um campo aninhado errado tipo `parameters.parameters.query` que a UI não usa). Se a query não aparecer certa na tela do n8n depois de editar, é sinal desse bug — use `updateNodeParameters` com `replace: true` pra substituir o objeto de parâmetros inteiro e limpo.
5. Depois de criar as tabelas, apague/arquive o workflow de diagnóstico temporário.

## 3. Instagram Business Account ID vs Instagram App ID (erro mais comum)

No Meta Console, a tela "API setup with Instagram login" mostra dois números parecidos só em formato:
- **Instagram app ID** (ex. `2150954802502871`) — identifica o APP no Meta, fica no topo da página.
- **Instagram Business Account ID** (ex. `17841462357933260`) — identifica a CONTA do Instagram, aparece embaixo do nome da conta na seção "2. Generate access tokens".

**É muito fácil copiar o App ID por engano** e colar no campo "Instagram Business Account ID" da credencial do n8n. Sintoma: token "funciona" (`connection tested successfully` no n8n) mas nada relacionado a webhook funciona, e a API pode até dar erros estranhos de permissão.

Como confirmar o ID certo: olhe o payload de qualquer execução real do `Instagram Trigger` no n8n — o campo `recipientId`/`entryId`/`senderId` (dependendo do evento) traz o ID real da conta.

## 4. Gerar o token E ligar o Webhook Subscription

Na mesma seção "2. Generate access tokens" do Meta Console, cada conta Instagram tem 3 colunas: **Instagram account**, **Token**, **Webhook Subscription**.

Ordem obrigatória (pular gera o erro "Webhook subscription change failed" em vermelho):
1. Confirme que o **Instagram Business Account ID** está correto (passo 3).
2. Clique no link **"Generate token"** dessa linha — isso abre um fluxo de login/autorização OAuth do Instagram. **Só o usuário pode fazer esse login** (nunca insira credenciais por ele). Enquanto esse link mostrar "Generate token" (em vez de um token mascarado), a conta não está de fato autorizada NESSA tela, mesmo que exista um token válido guardado em outro lugar (ex. copiado manualmente pra credencial do n8n).
3. Depois do login, copie o token gerado e cole na credencial `instagramAccessTokenApi` do n8n (salve e confirme "Connection tested successfully").
4. **Só agora** o toggle "Webhook Subscription" vai ligar com sucesso. Se ainda der erro, o token não foi gerado por ESSA tela (ex. foi copiado de outro lugar) — repita o passo 2.

### 4.1 Workaround: Toggle UI tem bug, use a API Graph diretamente (achado 08/09/2026, bot da Nelson AI)

Apesar de seguir todos os passos acima corretamente, **a toggle "Webhook Subscription" pode continuar falhando com "Webhook subscription change failed" mesmo com tudo certo** — é um bug conhecido do console Meta. Sintoma: a toggle permanece "Off" independentemente de quantas vezes você clica.

**Solução: chamar a API Graph diretamente** (bypass a UI bugada):

```javascript
// Execute isto em qualquer contexto que tenha acesso a fetch() (ex: console do navegador na aba de developers.facebook.com)
const igAccountId = "17841478644329280";  // Substituir pelo ID da conta Instagram do cliente
const accessToken = "IGAAWf2l...";         // O token gerado no passo 4.3
const webhookFields = "comments,messages,messaging_postbacks,messaging_optins,mentions,live_comments";

fetch(`https://graph.instagram.com/v24.0/${igAccountId}/subscribed_apps?subscribed_fields=${webhookFields}&access_token=${accessToken}`, {
  method: "POST"
}).then(r => r.json()).then(data => console.log(data));

// Resposta esperada: {"success":true}
```

**Onde rodar:**
- Abra aba de developers.facebook.com no navegador
- Pressione F12 (Console)
- Cole o código acima com os valores reais
- Pressione Enter
- Se retornar `{"success":true}`, a inscrição está ativa (mesmo que a toggle permaneça mostrando "Off" na UI)

**Confirmação de sucesso:**
- Teste enviando um comentário/DM real (de uma conta diferente) à conta Instagram — se chegar execução no n8n com `mode: "webhook"` e payload REAL (não o fixo `fromUsername: "test"`), está funcionando 100%.

## 5. Diferenciar evento de teste vs evento real

O Meta tem um payload de teste fixo que aparece ao clicar em "Test" no console, ou que fica sendo reenviado em retry quando a entrega falha repetidamente:
```
fromUsername: "test", commentId: "17865799348089039", mediaId: "123123123", text: "This is an example."
```
Se você ver esse exato payload em várias execuções seguidas, **não é o evento real que você acabou de mandar** — é o Meta reentregando o mesmo teste porque o webhook está retornando erro. Resolva o erro de verdade (ex. token/subscription) antes de tentar testar de novo com um evento real.

Outro detalhe: **comentar ou mandar DM usando a própria conta da página não dispara webhook** (Meta filtra "echo" — ações da própria página não geram evento de entrada). Sempre teste com uma conta diferente (pessoal, por exemplo).

**Correção importante (achado em 25/08/2026, bot da ACTO)**: essa filtragem de "echo" do Meta cobre a ação original (comentar/mandar DM direto pela própria conta), mas **NÃO cobre necessariamente uma resposta pública que o PRÓPRIO WORKFLOW posta** via node `Reply Comment` — Meta pode disparar um novo evento de webhook pra essa resposta como se fosse um comentário novo. Se o workflow não filtrar isso, o agente de IA responde à própria resposta, gera outro evento, responde de novo, e assim vira um loop infinito (sintoma: uma sequência de respostas cada vez mais curtas e sem contexto, tipo "Claro!", "Oi! Muito obrigada pelo carinho!", todas com a tag "Author" da própria conta).

A defesa contra isso é o node `Anti-Loop Comments` (IF que compara `fromUsername` do evento com o username da própria conta) — só que em workflows clonados de outro cliente, essa comparação costuma vir com um **valor placeholder tipo `"PLACEHOLDER_IG_USERNAME_ACTO"` que nunca foi preenchido com o username real**. Como esse placeholder nunca é igual ao `fromUsername` de verdade, a condição do IF sempre passa e o anti-loop não bloqueia nada — inclusive os próprios comentários do bot.

**Sempre confira, ao clonar o workflow pra um cliente novo:**
1. Abra os nodes `Anti-Loop Comments` e `Anti-Loop DMs` (ou equivalente) e confirme que o valor comparado é o **username real da conta Instagram do cliente** (ex. `metodo_acto_direcao_preventiva`), não um placeholder genérico.
2. Se um loop desses já aconteceu, as respostas fantasma ficam publicadas de verdade no post — depois de corrigir o node, é preciso apagar manualmente os comentários soltos (hover no comentário → "..." → Excluir) já que a correção não deleta os que já foram postados.

## 6. Mapeamento de outputs do node `Instagram Trigger` (n8n-nodes-instagram-token)

Esse node customizado tem 5 saídas fixas, nessa ordem (confirmado no código-fonte, `n8n-nodes-instagram-token` / `InstagramTrigger.node.ts`):

| Índice | Evento |
|---|---|
| 0 | Messages (DMs) |
| 1 | Postbacks |
| 2 | Opt-ins |
| 3 | Comments |
| 4 | Mentions |

Se DMs "não disparam nada" mas comentários funcionam (ou vice-versa), confira se a saída correspondente está conectada no canvas do workflow — é fácil esquecer de ligar uma das 5 saídas ao clonar/editar o workflow.

## 7. Checklist final de verificação end-to-end

1. `search_workflow_executions` no workflow alvo, filtrando por `mode: "webhook"` — confirme que a execução mais recente NÃO tem o payload de teste do passo 5.
2. Abra a execução com `includeData: true` e confira, node a node, que passou por: Trigger → Switch (Comment/Message) → Anti-Loop → Postgres (client/post exist) → Agente de IA → resposta enviada (Reply Comment / Send DM) → Analytics salvo.
3. Se algum node de notificação externa (ex. WhatsApp via Evolution API) falhar com número/instância placeholder (ex. `5500000000000@s.whatsapp.net`), isso é uma pendência separada e NÃO bloqueia o atendimento ao cliente real — só a notificação interna do time.

## 8. Política de Privacidade / Termos / Exclusão de Dados (App settings → Informação básica)

O app exige URLs públicas nos campos **Privacy policy URL**, **Terms of Service URL** e **User data deletion** (Data deletion instructions URL) pra poder ficar "Live" e passar por revisão.

- Se o cliente só tem um PDF com essas políticas (não uma URL pública), publique o conteúdo como página HTML pública (ex. via Artifact tool) e use essa URL — não dá pra colar um PDF direto nesses campos.
- Uma página só com âncoras (`#termos`, `#exclusao`) serve pros três campos, sem precisar de três páginas separadas.
- **Cuidado ao editar esses campos**: em alguns apps, os campos "Terms of Service URL" e "Data deletion instructions URL" vêm com um prefixo fixo `https://www.facebook.com/` que a digitação normal só *concatena* em vez de substituir (resultado tipo `https://www.facebook.com/https://sua-url.com` — inválido). Pra corrigir: clique no campo, `End` → `Shift+Home` (seleciona tudo) → digite a URL completa por cima. Só clicar e digitar direto, ou só Ctrl+A, pode não limpar o prefixo.
- Campo **Category** (categoria do app) também costuma ser obrigatório pra salvar — se o "Save Changes" não fizer efeito, confira se ele ficou vazio.

## 9. Acesso de admin de Página do Facebook — bloqueia conexão ao Business Portfolio (achado 25-26/08/2026, bot da Billie)

Se a conta do Instagram do cliente está vinculada a uma Página do Facebook administrada por outra pessoa (ex. a dona da loja, não quem está configurando o bot), adicionar essa Página ao Business Portfolio da agência falha com:

> "Unable to add Facebook Page ... Apenas as pessoas com acesso de controlo total da Página podem adicioná-la a este portfólio de negócios."

Causa: a Meta separa **"Acesso a tarefas" (Task access)** de **"Acesso ao Facebook" (Full Control)** nas Páginas — só o segundo permite adicionar/reivindicar a Página num Business Portfolio de terceiros. É comum o dono da Página conceder só o primeiro por engano, e o erro persistir mesmo depois de "ter dado acesso".

Como resolver: peça pro dono da Página ir em **Página → Configurações profissionais → Acesso à Página → seção "Pessoas com acesso ao Facebook"** (não a seção "Acesso a tarefas") e adicionar a pessoa que vai configurar o bot com papel de **Acesso total**. Confirme explicitamente qual seção foi usada — "eu já dei acesso" sem essa confirmação normalmente significa que foi na seção errada.

## Erros e onde cada um aponta

| Erro | Causa real |
|---|---|
| "Webhook subscription change failed" (toast vermelho) | Token não gerado por essa tela (passo 4), ou Business Account ID errado (passo 3) — se ambos estão corretos, é o bug da UI. Use o workaround da API Graph (seção 4.1) |
| `relation "xxx_clients" does not exist` | Tabelas do Postgres não criadas pro novo cliente (passo 2) |
| `Object with ID 'xxxxx' does not exist... error_subcode 33` ao responder comentário | Você está processando o payload de teste fixo do Meta, não um evento real (passo 5) |
| DM enviada mas nenhuma execução aparece no n8n | Testou com a própria conta da página (self-echo filtrado) OU webhook subscription ainda Off OU a saída correspondente do Trigger não está conectada (passo 6) |
| `"exists":false` ao enviar WhatsApp via Evolution API | Número/instância ainda com placeholder — pedir o número real ao cliente |
| Bot fica respondendo a própria resposta em loop (respostas cada vez mais curtas/sem sentido, tag "Author") | Node `Anti-Loop Comments`/`Anti-Loop DMs` comparando `fromUsername` com um placeholder genérico nunca preenchido — trocar pelo username real da conta (passo 5) |
| Não existe menu "Use cases" / tela "API setup with Instagram business login", só "Instagram Graph API" clássica | App é tipo "Nenhum" — precisa criar um app novo tipo "Negócio" (passo 0.5), não dá pra converter o existente |
| Botão "Add account" não lista a conta do cliente, ou convite fica "Pending" pra sempre | Instagram Tester não foi aceito pela própria conta — precisa do login do cliente dentro do app do Instagram (passo 0.6) |
| "Unable to add Facebook Page ... acesso de controlo total" ao conectar Página ao Business Portfolio | Dono da Página deu só "Acesso a tarefas", não "Acesso ao Facebook"/Full Control (passo 9) |
| Campo Terms of Service / Data deletion vira `https://www.facebook.com/https://...` (URL inválida) | Prefixo fixo do campo não foi sobrescrito — selecionar tudo (End → Shift+Home) antes de digitar (passo 8) |

## 10. Token que "nunca expira" na prática

Não existe token permanente — todo token de longa duração da Meta expira em 60 dias. Mas dá pra renovar automaticamente antes de vencer, e nesse caso ele nunca expira de fato:

- **Instagram API with Instagram Login** (app tipo Negócio, passo 0.5): `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={token-atual}` — só funciona com token de pelo menos 24h de vida, ainda não expirado. Resposta traz novo `access_token` válido por mais 60 dias.
- Automatize com um workflow n8n agendado (Schedule Trigger semanal/mensal) que chama esse endpoint e atualiza a credencial `instagramAccessTokenApi` com o novo token. Prioridade alta pra clientes com bastante movimento — token vencido derruba o bot sem aviso.
