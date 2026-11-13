import { createHmac } from "node:crypto";

// The token Meta sends back when WhatsApp's webhook callback URL is set
// (app/api/whatsapp/route.ts), worked out from the Meta app's secret, so
// there's no other secret to keep. Plain JavaScript, so
// `npm run whatsapp:verify-token` can print it for whoever sets the webhook up.

/** @param {string} appSecret */
export function verifyToken(appSecret) {
  return createHmac("sha256", appSecret).update("whatsapp webhook verify token").digest("hex").slice(0, 32);
}
