# Como Testar o Webhook (Passo a Passo)

## 1. Ativar a API (via fetch-webhook.js)

```javascript
// Execute no console (F12) de developers.facebook.com
// Veja fetch-webhook.js pra script completo
// Resposta esperada: {"success":true}
```

## 2. Preparar o n8n

Antes de testar, confirme que:

- [ ] Seu workflow `Instagram Trigger` está **publicado** (Published=true)
- [ ] O `webhookId` no node está correto (ex: `00000000-0000-4000-8000-000000000000`)
- [ ] A Callback URL no Meta Console aponta pra: `https://seu-n8n-domain.com/webhook/{webhookId}/webhook`
- [ ] A credencial `instagramAccessTokenApi` tá **salva** no n8n

## 3. Enviar Comentário de Teste

**Importante**: Use uma conta **DIFERENTE** da sua página Instagram. Meta filtra ações da própria conta (echo).

### Opção A: Instagram Web
1. Abra https://instagram.com/seu_perfil
2. Vá num post seu
3. Clique no comentário (outro usuário)
4. Escreva algo tipo: `"Olá, teste do webhook!"`
5. Pressione Enter

### Opção B: Instagram App (Mobile)
1. Abra o app do Instagram
2. Procure um post seu
3. Toque no ícone de comentário
4. Escreva um comentário
5. Envie

**Espere 2-5 segundos** pro webhook chegar.

## 4. Confirmar no n8n

### Executar Busca
```
Workflow → "NELSON AI - Instagram Atendimento" (ou seu workflow)
Abra aba "Executions"
Filtro: startedAfter = "agora - 5 minutos"
```

### Verificar Payload

Procure por uma execução com:
- ✅ `status: "success"` ou `"error"` (não pending)
- ✅ `mode: "webhook"` (não "manual")
- ✅ `startedAt` ≈ horário que você enviou o comentário

**Abra a execução** e expanda o node `Instagram Trigger`:

```json
{
  "senderId": "123456789000",
  "recipientId": "17841400000000000",
  "eventType": "comment",
  "commentId": "aWdfZAG1faXRlbTox...",
  "mediaId": "175555555555555",
  "text": "Olá, teste do webhook!"
}
```

### ✅ Sucesso!

Se conseguir ver:
- **senderId** = ID real (não fixo)
- **text** = seu comentário (não "This is an example.")
- **eventType** = "comment" ou "message" (real)

**Parabéns! Seu webhook está 100% funcional.** 🎉

## ❌ Nada Apareceu?

### Diagnóstico

1. **Confira o horário**
   - A execução chegou com `startedAt` certo?
   - Ou você testou ANTES de rodar fetch-webhook.js?

2. **Verificar se é o Meta testando**
   - Procure por execuções com:
     ```
     fromUsername: "test"
     text: "This is an example."
     ```
   - Se só aparecer isso, o webhook ainda está retornando erro
   - Re-rode fetch-webhook.js

3. **Verificar se testou com a própria conta**
   - Meta filtra ações da própria página
   - Teste com outra conta pessoal (amigo, etc)

4. **Verificar a Callback URL**
   ```
   Meta Console → API setup → seção 2. Configure webhooks
   Callback URL deve estar: https://seu-n8n/webhook/{webhookId}/webhook
   Com um green checkmark ✅
   ```

5. **Verificar o token**
   - Token ainda é válido?
   - Tokens do Meta expiram em 60 dias
   - Rode `refresh_access_token` se necessário

### Nada Funcionou?

1. Abra uma **Issue** neste repo com:
   - Seu n8n domain (sem credential)
   - Screenshot da Callback URL validation
   - Screenshot do Meta Console (seção 2)
   - Horário que testou (UTC)

2. Confira **SKILL.md** seção "Erros e onde cada um aponta"

## 5. Testar DM (Mensagem Direta)

Para testar mensagens diretas em vez de comentários:

1. **Enviar DM**
   - Abra Instagram
   - Vá em mensagens (Direct Messages)
   - Procure seu perfil comercial
   - Envie uma mensagem

2. **Confirmar no n8n**
   - Procure por execução com `eventType: "message"`
   - Payload deve ter campo `messageId`

## 6. Loop Testing (Opcional)

Se seu workflow **responde** ao comentário:

1. Envie um comentário
2. Dentro de alguns segundos, confirme que seu bot respondeu
3. Procure por uma segunda execução (a resposta do bot pode gerar webhook se configurado)

**Dica**: Use o node `Anti-Loop Comments` pra evitar que o bot responda a si mesmo infinitamente.

---

**Tempo esperado**: 30 segundos pra o webhook chegar ao n8n após você enviar o comentário.

Se demorarem mais de 5 minutos = algo está errado (confira o diagnóstico acima).
