# Instagram n8n Webhook Fix

**Solução para o erro "Webhook subscription change failed" na Meta Console** 🔧

## O Problema

Você está tentando ativar webhooks do Instagram no Meta Developer Console pra receber comentários e DMs em tempo real no seu workflow n8n, mas a toggle **"Webhook Subscription"** retorna um erro genérico:

```
Webhook subscription change failed
```

Mesmo com **tudo correto**:
- ✅ Callback URL validado (green checkmark)
- ✅ App Mode em Live
- ✅ Instagram Tester role aceito  
- ✅ Token gerado na tela correta
- ✅ Permissões configuradas (`instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`)

**Isso é um bug conhecido da Meta.** A UI toggle falha mesmo quando a configuração está 100% correta.

## A Solução

**Bypass a UI bugada e ative o webhook diretamente via API Graph:**

```javascript
// Execute no console do navegador (F12) em developers.facebook.com
const igAccountId = "SEU_INSTAGRAM_BUSINESS_ACCOUNT_ID";  // Seu Instagram Business Account ID
const accessToken = "IGAA...SEU_TOKEN_AQUI...";            // Seu token gerado no Meta Console
const webhookFields = "comments,messages,messaging_postbacks,messaging_optins,mentions,live_comments";

fetch(`https://graph.instagram.com/v24.0/${igAccountId}/subscribed_apps?subscribed_fields=${webhookFields}&access_token=${accessToken}`, {
  method: "POST"
}).then(r => r.json()).then(data => console.log(data));

// Resposta esperada: {"success":true}
```

Se receber `{"success":true}`, **seu webhook está ativo**, mesmo que a toggle continue mostrando "Off" na UI.

## Confirmação de Sucesso

Envie um comentário ou DM **de uma conta diferente** pro seu Instagram Business:

1. Abra seu workflow n8n
2. Vá pra execuções recentes (`Executions`)
3. Procure por um `mode: "webhook"` que começou após ativar a API
4. Abra e confirme que o payload é **real** (não o fixo de teste do Meta):
   - ✅ `senderId` = ID único real
   - ✅ `text` = o que você digitou (não "This is an example.")
   - ✅ `eventType` = "message" ou "comment"

## Stack Testado

- **n8n**: v2.19+ (self-hosted em EasyPanel)
- **Instagram API**: v24.0 (Business Login)
- **Workflow**: Instagram Trigger + Postgres + AI Agent
- **Clientes**: ACTO, Billie, Nelson AI (produção)

## Por que acontece?

A Meta tem um bug na UI do console — a toggle "Webhook Subscription" faz uma requisição que falha com mTLS ou conectividade, mesmo quando o token e a conta estão corretos. A API Graph, porém, funciona direto.

**Referência oficial**: https://developers.facebook.com/docs/instagram-platform/webhooks

## Como Usar (Runbook Completo)

Veja **[SKILL.md](./SKILL.md)** para o runbook completo com:
- Pré-requisitos
- Criação do app tipo "Negócio"
- Instagram Tester role
- Permissões
- Tabelas Postgres
- Instagram Business Account ID vs App ID
- **Seção 4.1 com o workaround**
- Diferenciar eventos reais vs testes
- Anti-loop
- Mapeamento de outputs
- Verificação end-to-end
- Política de Privacidade/Termos
- Acesso de admin de Página
- Token que nunca expira

## Exemplos

Veja a pasta `examples/` pra:
- `fetch-webhook.js` — Script pronto pra copiar-colar no console
- `webhook-fields.json` — Todos os campos disponíveis
- `test-comment.md` — Como testar com comentário real

## Suporte

Encontrou um problema?

1. Confirme que seu **Instagram Business Account ID** está correto (não App ID)
2. Confirme que seu **token foi gerado NESTA tela** do Meta Console (não importado de outro lugar)
3. Se ambos estão corretos e ainda falha, abra uma Issue aqui

## Autoria

- **Descoberta do bug + workaround**: Machado (NEOSIX AUTO / Nelson AI)
- **Data**: 08/09/2026
- **Tempo pra resolver**: 4 dias (testado em produção)

## Licença

MIT — Use, copie, compartilhe livremente.

---

**Gostou? Compartilhe com outras pessoas que estão nessa!** 

Se isso funcionou pra você, considere dar uma ⭐ no repo ou compartilhar na comunidade n8n / grupos de Instagram automation.
