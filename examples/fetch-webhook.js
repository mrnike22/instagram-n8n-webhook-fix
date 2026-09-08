/**
 * Script: Ativar Instagram Webhook via API Graph
 *
 * Como usar:
 * 1. Abra https://developers.facebook.com/apps/[seu-app-id]/instagram-business/api-setup/
 * 2. Pressione F12 (abre Developer Tools)
 * 3. Vá pra aba "Console"
 * 4. Cole este script com seus valores reais
 * 5. Pressione Enter
 * 6. Se receber {"success":true}, webhook está ativo!
 */

// ============ CONFIGURAÇÃO ============
const igAccountId = "17841478644329280";  // Substitua pelo seu Instagram Business Account ID
const accessToken = "IGAAWf2l...";         // Substitua pelo seu token (gerado no Meta Console)
const webhookFields = "comments,messages,messaging_postbacks,messaging_optins,mentions,live_comments";

// ============ EXECUTAR ============
fetch(`https://graph.instagram.com/v24.0/${igAccountId}/subscribed_apps?subscribed_fields=${webhookFields}&access_token=${accessToken}`, {
  method: "POST"
})
  .then(r => r.json())
  .then(data => {
    console.log("✅ Resposta da API:");
    console.log(data);

    if (data.success) {
      console.log("\n🎉 SUCESSO! Webhook subscription ativado.");
      console.log("Agora envie um comentário/DM real pra sua conta e confira no n8n.");
    } else {
      console.log("\n❌ Erro:");
      console.log("- Confirme que igAccountId está correto (não é App ID)");
      console.log("- Confirme que accessToken foi gerado NESTA tela do Meta Console");
    }
  })
  .catch(err => {
    console.error("❌ Erro na requisição:", err.message);
  });

// ============ ENCONTRAR SEUS VALORES ============
//
// 1. Instagram Business Account ID:
//    - Vai tá embaixo do nome da sua conta na Meta Console
//    - Exemplo: 17841478644329280
//    - NÃO é o "Instagram app ID" (que fica no topo da página)
//
// 2. Access Token:
//    - Gerado ao clicar "Generate token" na seção "2. Generate access tokens"
//    - Começará com "IGAA..."
//    - NÃO copie de outro lugar (precisa ser desta tela específica)
//    - ⚠️  Depois, gere um novo token e atualize sua credencial n8n
//    - Nunca reutilize o token exposto aqui
//
