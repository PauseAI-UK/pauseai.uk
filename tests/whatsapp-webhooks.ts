// WhatsApp's webhooks, as Meta sends them, signed with the fixture build's
// app secret (lib/server/fixtures/fixture-env.mjs), for the storyboard's
// flows to post to /api/whatsapp.
// https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference
import { createHmac } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { FIXTURE_NOW } from "@/lib/server/fixtures/fixture-env.mjs";

const SECRET = "fixture-whatsapp-secret";

/** A time as WhatsApp gives it, in seconds, minutes after the fixture's clock. */
const at = (minutes = 0) => String(Math.floor(Date.parse(FIXTURE_NOW) / 1000) + minutes * 60);

/** A webhook carrying one change. */
const webhook = (field: string, value: object) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "fixture-account", changes: [{ field, value }] }],
});

/** What WhatsApp decided of a template, by the name it has it by. */
export const templateStatus = (name: string, event: string, reason = "NONE") =>
  webhook("message_template_status_update", {
    event,
    message_template_id: 1,
    message_template_name: name,
    message_template_language: "en_GB",
    reason,
  });

/** A message to us from `number` (digits alone), quoting our text `quoted`: words, or a press of its button. */
export const messageFrom = (
  number: string,
  id: string,
  quoted: string,
  said: { text: string } | { button: string },
  minutes = 0,
) =>
  webhook("messages", {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: "447700900000", phone_number_id: "fixture-phone" },
    messages: [
      {
        from: number,
        id,
        timestamp: at(minutes),
        context: { from: "447700900000", id: quoted },
        ...("text" in said
          ? { type: "text", text: { body: said.text } }
          : { type: "button", button: { text: said.button, payload: said.button } }),
      },
    ],
  });

/** What became of a text: delivered or read. */
export const statusOf = (id: string, number: string, status: "delivered" | "read", minutes = 1) =>
  webhook("messages", {
    messaging_product: "whatsapp",
    statuses: [{ id, status, timestamp: at(minutes), recipient_id: number }],
  });

/** Posts a webhook to the build at `base`, signed as WhatsApp signs it; how many changes it applied. */
export async function postWhatsAppWebhook(request: APIRequestContext, base: string, payload: object) {
  const body = JSON.stringify(payload);
  const res = await request.post(`${base}/api/whatsapp`, {
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`,
    },
    data: body,
  });
  if (!res.ok()) throw new Error(`WhatsApp webhook on ${base} failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { applied: number };
}
