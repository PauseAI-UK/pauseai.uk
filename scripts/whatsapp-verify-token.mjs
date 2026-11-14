// Prints the verify token for WhatsApp's webhook, worked out from the Meta
// app's secret, to paste beside the callback URL in the App Dashboard's
// "Configure Webhooks" (docs/development.md, "WhatsApp"):
//
//   WHATSAPP_APP_SECRET=... npm run whatsapp:verify-token
import { verifyToken } from "../lib/broadcasts/whatsapp-verify-token.mjs";

const secret = process.env.WHATSAPP_APP_SECRET;
if (!secret) {
  console.error("Set WHATSAPP_APP_SECRET to the Meta app's secret, from its basic settings.");
  process.exit(1);
}
console.log(verifyToken(secret));
