import "server-only";
import { hasWay, TOPICS, type Topic } from "@/lib/contact-permissions";
import { query, transaction, type Queryable } from "./db";
import { recordOptOut, recordSourceResume } from "./opt-outs";

// Stops given in WhatsApp, whichever way: its "Offers and announcements"
// setting, a reply asking to stop, or a text WhatsApp refused as the person
// had stopped. A reply stops the topics the text it answers went under, the
// texts its footer means (TEMPLATE_FOOTER); WhatsApp's setting is for the
// whole number, so it and a refusal stop every text. Each topic's stop is
// an opt-out (source whatsapp), and the one that leaves no text topic open
// queues "Do not SMS" for CiviCRM (civicrm-updates.ts). A resume in
// WhatsApp's setting closes only the stops the setting made, leaving any
// other in force.

/** How a stop was given in WhatsApp. */
export type StopKind = "setting" | "reply" | "refused";

/** A number as WhatsApp gives it, its digits alone, in our international format. */
export function numberOf(waId: string): string {
  return `+${waId.replace(/\D/g, "")}`;
}

/** The topics a text goes under: every one. */
const TEXT_TOPICS = TOPICS.filter((topic) => hasWay(topic, "text"));

/**
 * The topics a stop given by `kind` stops: a reply to a copy, the copy's;
 * anything else, or a copy that doesn't say what it went under, every text,
 * to be safe.
 */
export async function stoppedTopics(kind: StopKind, copyId?: number, db?: Queryable): Promise<Topic[]> {
  if (kind !== "reply" || !copyId) return TEXT_TOPICS;
  const [copy] = await query<{ topics: Topic[] }>("SELECT topics FROM broadcast_messages WHERE id = $1", [copyId], db);
  const its = TEXT_TOPICS.filter((topic) => copy!.topics.includes(topic));
  return its.length ? its : TEXT_TOPICS;
}

/**
 * Records a stop of texts to `number`, given by `kind`, `ref` being
 * WhatsApp's ID for what said it, so the same stop told twice is kept once,
 * and `copyId` the copy it came from, if any, whose history then says
 * Stopped: a reply to a copy stops its topics, anything else, or a copy
 * that doesn't say its topics, every text.
 * Says whether it was new.
 */
export async function recordWhatsAppStop(
  number: string,
  kind: StopKind,
  ref: string,
  at: Date,
  copyId?: number,
  db?: Queryable,
): Promise<boolean> {
  if (!db) return transaction((tx) => recordWhatsAppStop(number, kind, ref, at, copyId, tx));
  const topics = await stoppedTopics(kind, copyId, db);
  let recorded = false;
  for (const topic of topics) {
    const made = await recordOptOut(
      {
        address: number,
        list: topic,
        way: "text",
        source: "whatsapp",
        sourceRef: `${kind} ${ref} ${topic}`,
        unsubscribedAt: at,
        ...(copyId && { messageId: copyId }),
      },
      db,
    );
    recorded ||= made;
  }
  if (recorded && copyId) {
    await query(
      "INSERT INTO broadcast_message_events (message_id, kind, at) VALUES ($1, 'opted-out', $2)",
      [copyId, at],
      db,
    );
  }
  return recorded;
}

/** Closes the stops WhatsApp's setting made for `number`, as the person turned it back on. Says whether any were open. */
export function recordWhatsAppResume(number: string, at: Date): Promise<boolean> {
  return recordSourceResume(number, "whatsapp", "setting ", at);
}
