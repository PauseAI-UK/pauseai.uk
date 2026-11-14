import { createHash } from "node:crypto";
import { config } from "../config.server";
import { GRAPH_VERSION } from "../outside-services/graph-api";
import { saveNoteToOutbox } from "./outbox";
import { textNote } from "./whatsapp-outbox";

// The fake WhatsApp Cloud API a fixture build and the tests talk to: the
// account's one number, sends it takes, and templates it takes for
// approval, all answered as Meta answers them. Each text sent, and each
// template sent for approval, is written to the outbox as a text file
// (lib/server/fixtures/outbox.ts). Approval, delivery and replies come by
// its webhook, which the storyboard posts itself (tests/whatsapp-webhooks.ts).

/** The keys a fixture build uses where none are set: the fake takes any. */
export const FIXTURE_KEYS = { token: "fixture", accountId: "fixture-account" };

/** Meta's ID for our number in a fixture build, which sends go to. */
export const FIXTURE_PHONE_ID = "fixture-phone";

// Made up: a number Ofcom keeps for drama (https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbers-for-drama).
const FIXTURE_NUMBER = "+44 7700 900000";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** The most characters WhatsApp takes in a template's words (https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components). */
export const FIXTURE_BODY_LIMIT = 1024;

/** An ID that depends only on what was sent, so the same send has the same ID every run. */
const idOf = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 16);

/** Writes `words` to the outbox, as Postmark's fake does an email: OUTBOX_DIR, or tmp/outbox in the dev server. */
function toOutbox(words: string): void {
  const outbox = config.outboxDir ?? (config.nodeEnv === "development" ? "tmp/outbox" : undefined);
  if (outbox) console.info(`WhatsApp's fake wrote ${saveNoteToOutbox(outbox, words)}`);
}

type Send = {
  to: string;
  type: "template" | "text";
  template?: { name: string; components: { parameters: { parameter_name: string; text: string }[] }[] };
  text?: { body: string };
};

/** A send, as its file in the outbox says it: who it's to, and its template and fields, or its own words. */
function sendWords(send: Send): string {
  const to = `+${send.to}`;
  if (send.type === "text") return textNote(FIXTURE_NUMBER, { to, words: send.text!.body });
  const fields = send.template!.components.flatMap((component) => component.parameters);
  const params = Object.fromEntries(fields.map((field) => [field.parameter_name, field.text]));
  return textNote(FIXTURE_NUMBER, { to, template: { name: send.template!.name, params } });
}

type NewTemplate = { name: string; components: { type: string; text: string }[] };

/** A template sent for approval, as words: its name, words and footer. */
function templateWords(template: NewTemplate): string {
  const part = (type: string) => template.components.find((component) => component.type === type);
  return [
    `WhatsApp template sent for approval: ${template.name}`,
    "",
    part("BODY")!.text,
    "",
    part("FOOTER")!.text,
    "",
  ].join("\n");
}

/** The fake's answer to a call to the Graph API, if it's one it knows. */
export function whatsAppResponse(pathname: string, init?: RequestInit): Response | undefined {
  const path = pathname.replace(`/${GRAPH_VERSION}/`, "");
  const method = init?.method ?? "GET";
  if (path.endsWith("/phone_numbers")) {
    return json({ data: [{ id: FIXTURE_PHONE_ID, display_phone_number: FIXTURE_NUMBER }] });
  }
  if (path === FIXTURE_PHONE_ID && method === "GET") {
    return json({ id: FIXTURE_PHONE_ID, whatsapp_business_manager_messaging_limit: "TIER_250" });
  }
  if (path === `${FIXTURE_PHONE_ID}/messages` && method === "POST") {
    const body = String(init!.body);
    const send = JSON.parse(body) as Send;
    toOutbox(sendWords(send));
    return json({ messaging_product: "whatsapp", messages: [{ id: `wamid.fixture-${idOf(body)}` }] });
  }
  if (path.endsWith("/message_templates") && method === "POST") {
    const template = JSON.parse(String(init!.body)) as NewTemplate;
    // Words too long refused, as Meta refuses them, with its words for people.
    const words = template.components.find((component) => component.type === "BODY")!.text;
    if (words.length > FIXTURE_BODY_LIMIT) {
      return json(
        {
          error: {
            message: "Invalid parameter",
            code: 100,
            error_user_title: "Message too long",
            error_user_msg: `The message body can have at most ${FIXTURE_BODY_LIMIT} characters.`,
          },
        },
        400,
      );
    }
    toOutbox(templateWords(template));
    return json({ id: `fixture-template-${idOf(template.name)}`, status: "PENDING", category: "MARKETING" });
  }
  if (path.endsWith("/message_templates") && method === "DELETE") return json({ success: true });
  if (path.endsWith("/message_templates")) return json({ data: [] });
  return undefined;
}
