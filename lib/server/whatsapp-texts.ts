import "server-only";
import { fieldsIn, type MailingDoc, type MailingRecipientValues } from "@/lib/mailing-doc";
import { paramName } from "@/lib/whatsapp-template";
import { query } from "./db";
import type { ChannelResult } from "./mailing-channels";
import type { TemplateParam, WhatsAppSend } from "./outside-services/whatsapp";

// Sending a text by its template (lib/whatsapp-template.ts): each person's
// words for its fields, and what became of a send. A template's words are
// the same for everyone, so a text has fields but no parts for only some.

/** The words of each of a text's fields for one person, or as an example, as a send or a template gives them. */
export function templateParams(body: MailingDoc, recipient: MailingRecipientValues): TemplateParam[] {
  return fieldsIn(body).map((field) => ({ name: paramName(field), text: recipient.values[field] ?? "" }));
}

/**
 * The name a template is sent to WhatsApp by: its own, in the lower case,
 * digits and underscores WhatsApp allows, then its ID, so two of the same
 * name don't clash.
 */
export function metaName(name: string, id: number): string {
  const words = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 400);
  return words ? `${words}_${id}` : `text_${id}`;
}

/**
 * WhatsApp's error codes for a message it refused, by what we do about it
 * (https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes):
 * the number isn't on WhatsApp; the person stopped marketing messages; the
 * person has had enough marketing messages lately, so try in a day; we've
 * sent too many too fast, our number is limited, the template is paused, or
 * WhatsApp can't take messages just now, so try later, as it passes by
 * itself; or our access token expired (190), or the template is disabled
 * for good, so try later, once someone has fixed it.
 */
export const WHATSAPP_ERRORS = {
  unreachable: 131026,
  stopped: 131050,
  held: 131049,
  later: [130429, 131056, 131048, 80007, 132015, 131016],
  fix: [190, 132016],
} as const;

/** What a send by WhatsApp was, as sending keeps it. */
export function textResult(send: WhatsAppSend): ChannelResult {
  if (send.sent) return { sent: true, id: send.id };
  if (send.code === WHATSAPP_ERRORS.unreachable) return { sent: false, reason: "unreachable" };
  if (send.code === WHATSAPP_ERRORS.stopped) return { sent: false, reason: "stopped" };
  if (send.code === WHATSAPP_ERRORS.held) return { sent: false, reason: "held" };
  if ((WHATSAPP_ERRORS.later as readonly (number | null)[]).includes(send.code)) {
    return { sent: false, reason: "failed", retry: true, detail: send.reason };
  }
  if ((WHATSAPP_ERRORS.fix as readonly (number | null)[]).includes(send.code)) {
    return { sent: false, reason: "failed", retry: true, fixNeeded: true, detail: send.reason };
  }
  return { sent: false, reason: "failed", detail: send.reason };
}

/** Marks a number as not on WhatsApp, from the copy that found it, so texts skip it from then on. */
export async function markUnreachable(number: string, copyId: number): Promise<void> {
  await query(
    `INSERT INTO whatsapp_unreachable (number, message_id) VALUES ($1, $2)
     ON CONFLICT (number) DO UPDATE SET at = now(), message_id = excluded.message_id`,
    [number, copyId],
  );
}

/** Which of `numbers` aren't on WhatsApp, as far as we know. */
export async function unreachable(numbers: string[]): Promise<Set<string>> {
  const rows = await query<{ number: string }>("SELECT number FROM whatsapp_unreachable WHERE number = ANY($1)", [
    numbers,
  ]);
  return new Set(rows.map((row) => row.number));
}

/**
 * How many more people texts can reach today: the number's daily limit,
 * less those texted in the last day; null for no limit.
 */
export async function textsLeftToday(dailyLimit: number | null): Promise<number | null> {
  if (dailyLimit === null) return null;
  const [{ n }] = await query<{ n: number }>(
    `SELECT count(DISTINCT c.address)::int AS n FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id
     WHERE m.channel = 'text' AND c.sent_at > now() - interval '1 day'`,
  );
  return Math.max(0, dailyLimit - n);
}
