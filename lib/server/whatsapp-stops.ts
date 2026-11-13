import "server-only";
import { hasWay, TOPICS } from "@/lib/contact-permissions";
import { query, transaction, type Queryable } from "./db";
import { recordOptOut, recordSourceResume } from "./opt-outs";

// Stops given in WhatsApp, whichever way: its "Offers and announcements"
// setting, a text's Stop button, a reply asking to stop, or a text WhatsApp
// refused as the person had stopped. Each stops every text to the number,
// of every topic, as WhatsApp's own setting and button are for the whole
// number; choosing less is for the contact preferences page. Each topic's
// stop is an opt-out (source whatsapp), and the last of them queues "Do not
// SMS" for CiviCRM (civicrm-updates.ts). A resume in WhatsApp's setting
// closes only the stops the setting made, leaving any other in force.

/** How a stop was given in WhatsApp. */
export type StopKind = "setting" | "button" | "reply" | "refused";

/** A number as WhatsApp gives it, its digits alone, in our international format. */
export function numberOf(waId: string): string {
  return `+${waId.replace(/\D/g, "")}`;
}

/** The topics a text goes under: every one. */
const TEXT_TOPICS = TOPICS.filter((topic) => hasWay(topic, "text"));

/**
 * Records a stop of every text to `number`, given by `kind`, `ref` being
 * WhatsApp's ID for what said it, so the same stop told twice is kept once,
 * and `copyId` the copy it came from, if any, whose history then says
 * Stopped. Says whether it was new.
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
  let recorded = false;
  for (const topic of TEXT_TOPICS) {
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
