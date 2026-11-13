import "server-only";
import { staffCopy } from "@/lib/content/staff-interface";
import type { Topic } from "@/lib/contact-permissions";
import { siteUrl } from "@/lib/site-url";
import { stopAnswer } from "@/lib/whatsapp-template";
import { textBackend } from "./broadcast-channels";
import { holdCopy } from "./broadcast-sending";
import { query, transaction } from "./db";
import { config } from "./config";
import { newNumberLink } from "./email-settings";
import { notifyStaff } from "./notifications";
import { managerLink, sendText } from "./outside-services/whatsapp";
import { problem } from "./problems";
import { numberOf, recordWhatsAppResume, recordWhatsAppStop, stoppedTopics } from "./whatsapp-stops";
import { markUnreachable, WHATSAPP_ERRORS } from "./whatsapp-texts";
import { applyTemplateStatus } from "./whatsapp-templates";

// What WhatsApp's webhook tells us (app/api/whatsapp/route.ts), each change
// by its field: what became of each text sent (delivered, read, failed),
// messages people send us, a stop or resume in WhatsApp's own setting, what
// it decided of a template, and anything about our number or account staff
// should know. Meta may send a webhook twice, so each is applied once.
// https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference

/** What a webhook's body is, as far as we read it. */
export type WhatsAppWebhook = { entry?: { changes?: { field?: string; value?: Record<string, unknown> }[] }[] };

type Status = {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  errors?: { code?: number; title?: string }[];
};

type Message = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  /** A button pressed on a template that has one, such as one made in WhatsApp Manager: a reply. */
  button?: { text?: string; payload?: string };
  context?: { id?: string };
};

type Preference = { wa_id: string; category?: string; value?: string; timestamp?: string | number };

/** A time WhatsApp gives, in seconds since 1970. */
const timeOf = (seconds: string | number | undefined): Date => new Date(Number(seconds ?? 0) * 1000);

/** The words a person sends to stop, as a text's footer says: compared in lower case, trimmed. */
const STOP_WORDS = ["stop", "unsubscribe"];

/** A copy of a broadcast by WhatsApp's ID for it, with its number. */
async function copyByMessage(messageId: string): Promise<{ id: number; status: string; sending: boolean } | undefined> {
  const [copy] = await query<{ id: number; status: string; sending: boolean }>(
    `SELECT c.id::int AS id, c.status, m.state = 'sending' AS sending
     FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id WHERE c.provider_message_id = $1`,
    [messageId],
  );
  return copy;
}

/** Adds an event to a copy's history, once of each kind but a failure. */
async function addEvent(copyId: number, kind: string, at: Date, details: object = {}): Promise<void> {
  await query(
    `INSERT INTO broadcast_message_events (message_id, kind, at, details)
     SELECT $1, $2, $3, $4 WHERE NOT EXISTS (
       SELECT 1 FROM broadcast_message_events WHERE message_id = $1 AND kind = $2 AND kind <> 'failed')`,
    [copyId, kind, at, JSON.stringify(details)],
  );
}

/**
 * What became of a text: delivered or read, which a copy's history keeps;
 * or failed, as the number isn't on WhatsApp, which then skips it; as the
 * person stopped marketing messages, a stop; as they'd had enough lately,
 * held a day, while its broadcast is still sending; or anything else, a
 * failure.
 */
async function applyStatus(status: Status): Promise<boolean> {
  const copy = await copyByMessage(status.id);
  if (!copy) return false;
  const at = timeOf(status.timestamp);
  if (status.status === "delivered" || status.status === "read") {
    await query("UPDATE broadcast_messages SET status = 'delivered' WHERE id = $1 AND status = 'sent'", [copy.id]);
    if (status.status === "read") await addEvent(copy.id, "delivered", at);
    await addEvent(copy.id, status.status, at);
    return true;
  }
  if (status.status !== "failed") return false;
  const [error] = status.errors ?? [];
  const number = numberOf(status.recipient_id);
  if (error?.code === WHATSAPP_ERRORS.unreachable) {
    await markUnreachable(number, copy.id);
    await query("UPDATE broadcast_messages SET status = 'skipped', skip_reason = 'not-on-whatsapp' WHERE id = $1", [
      copy.id,
    ]);
  } else if (error?.code === WHATSAPP_ERRORS.stopped) {
    await recordWhatsAppStop(number, "refused", status.id, at, copy.id);
    await query("UPDATE broadcast_messages SET status = 'skipped', skip_reason = 'unsubscribed' WHERE id = $1", [
      copy.id,
    ]);
    return true;
  } else if (error?.code === WHATSAPP_ERRORS.held && copy.sending) {
    await holdCopy(copy.id);
    return true;
  } else {
    await query("UPDATE broadcast_messages SET status = 'failed' WHERE id = $1", [copy.id]);
  }
  await addEvent(copy.id, "failed", at, { code: error?.code ?? null, title: error?.title ?? null });
  return true;
}

/**
 * The copy a message from `number` answers: the one it quotes, or whose
 * answer it quotes; else the newest sent to the number.
 */
async function copyAnswered(number: string, quoted: string | undefined): Promise<number | undefined> {
  const [copy] = await query<{ id: number }>(
    `SELECT id FROM (
       SELECT id::int AS id, 0 AS rank, now() AS at FROM broadcast_messages WHERE provider_message_id = $2
       UNION ALL
       SELECT r.message_id::int, 1, now() FROM broadcast_answers a JOIN broadcast_replies r ON r.id = a.reply_id
       WHERE a.provider_message_id = $2
       UNION ALL
       SELECT id::int, 2, sent_at FROM broadcast_messages WHERE address = $1 AND sent_at IS NOT NULL
     ) c ORDER BY rank, at DESC LIMIT 1`,
    [number, quoted ?? ""],
  );
  return copy?.id;
}

/** A message's words, or what it is when it has none, such as a photo. */
function wordsOf(message: Message): string {
  return message.text?.body ?? message.button?.text ?? staffCopy.broadcastPages.replies.notWords(message.type);
}

/** Whether a message asks to stop: its words say so, whatever their case. */
function asksToStop(message: Message): boolean {
  const words = wordsOf(message).trim().toLowerCase();
  return message.type === "text" && STOP_WORDS.includes(words);
}

/**
 * Answers a stop, in the day WhatsApp takes words of our own after a
 * message: what it stopped, and a link to the contact preferences page for
 * the number. A failure is reported, not thrown, as the stop is kept.
 */
async function answerStop(number: string, topics: Topic[]): Promise<void> {
  try {
    const backend = await textBackend();
    if (!backend) return;
    const link = siteUrl(await newNumberLink(number), undefined).toString();
    const sent = await sendText(backend.keys, backend.number.id, number, stopAnswer(topics, link));
    if (!sent.sent) throw new Error(sent.reason);
  } catch (error) {
    problem(staffCopy.problems.anywhere.stopNotAnswered, error);
  }
}

/**
 * A message someone sent us: a stop, if it asks to, answered the first
 * time; else a reply to the copy it answers, kept once, for staff; else, as
 * it answers no text, emailed to staff.
 */
async function applyMessage(message: Message): Promise<boolean> {
  const number = numberOf(message.from);
  const at = timeOf(message.timestamp);
  const copyId = await copyAnswered(number, message.context?.id);
  if (asksToStop(message)) {
    const recorded = await recordWhatsAppStop(number, "reply", message.id, at, copyId);
    if (recorded) await answerStop(number, await stoppedTopics("reply", copyId));
    return recorded;
  }
  if (!copyId) {
    const email = staffCopy.notifications.whatsAppMessage;
    await notifyStaff(email.subject(number), email.body(number, wordsOf(message)), null, "staff-alert");
    return true;
  }
  return transaction(async (db) => {
    const kept = await query(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, provider_message_id, body, automatic)
       VALUES ($1, $2, $3, '', $4, $5, false) ON CONFLICT (provider_message_id) DO NOTHING RETURNING id`,
      [copyId, at, number, message.id, wordsOf(message)],
      db,
    );
    if (kept.length === 0) return false;
    await query(
      "INSERT INTO broadcast_message_events (message_id, kind, at) VALUES ($1, 'replied', $2)",
      [copyId, at],
      db,
    );
    return true;
  });
}

/** A change to someone's WhatsApp setting for marketing messages: off is a stop of every text, back on a resume. */
async function applyPreference(preference: Preference): Promise<boolean> {
  if (preference.category !== "marketing_messages") return false;
  const number = numberOf(preference.wa_id);
  const at = timeOf(preference.timestamp);
  if (preference.value === "stop") {
    return recordWhatsAppStop(number, "setting", `${preference.wa_id} ${preference.timestamp}`, at);
  }
  return preference.value === "resume" && recordWhatsAppResume(number, at);
}

/** Changes to our number's quality or limit, a template's quality, or our account, which staff should hear of. */
const ALERTS = ["phone_number_quality_update", "message_template_quality_update", "account_update"];

/** Applies one change a webhook carries; says whether it changed anything. */
async function applyChange(field: string, value: Record<string, unknown>): Promise<number> {
  let applied = 0;
  if (field === "messages") {
    for (const status of (value.statuses ?? []) as Status[]) applied += Number(await applyStatus(status));
    for (const message of (value.messages ?? []) as Message[]) applied += Number(await applyMessage(message));
  } else if (field === "user_preferences") {
    for (const preference of (value.user_preferences ?? []) as Preference[]) {
      applied += Number(await applyPreference(preference));
    }
  } else if (field === "message_template_status_update") {
    const name = String(value.message_template_name);
    const reason = typeof value.reason === "string" ? value.reason : null;
    applied += Number(await applyTemplateStatus(name, String(value.event), reason));
  } else if (field === "template_category_update") {
    applied += Number(
      await applyTemplateStatus(String(value.message_template_name), "", null, String(value.new_category)),
    );
  } else if (ALERTS.includes(field)) {
    const email = staffCopy.notifications.whatsAppAlert;
    const body = email.body(field, JSON.stringify(value, null, 2), managerLink(config.whatsappAccountId));
    await notifyStaff(email.subject(field), body, null, "staff-alert");
    applied++;
  }
  return applied;
}

/** Applies every change a webhook carries. Returns how many changed anything. */
export async function recordWhatsAppWebhook(payload: WhatsAppWebhook): Promise<number> {
  let applied = 0;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field && change.value) applied += await applyChange(change.field, change.value);
    }
  }
  return applied;
}
