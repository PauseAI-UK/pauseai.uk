import "server-only";
import { notifyStaff, staffLink } from "@/lib/email/notifications.server";
import { now } from "@/lib/now";
import { phoneWords } from "@/lib/phone";
import { query } from "@/lib/server/db.server";
import { REPLY_WINDOW_HOURS } from "./answers.server";
import { broadcastsCopy } from "./copy";

// The email to staff about replies to texts nobody has dealt with. WhatsApp
// takes words of ours only within REPLY_WINDOW_HOURS of the person's message,
// and nothing else tells staff of one, so a reply waiting ALERT_AFTER_HOURS
// is emailed about, once, to the notification inbox and whoever made its
// broadcast, while there's still time to answer it. A reply to an email
// needs none: the dashboard lists it, and there's no hurry.

/** How long a reply to a text waits for staff before they're emailed about it. */
const ALERT_AFTER_HOURS = 2;

/** A reply to a text waiting for staff, as the email names it. */
type Waiting = {
  id: number;
  copyId: number;
  mailingId: number;
  title: string;
  createdBy: string;
  from: string;
  name: string | null;
  receivedAt: Date;
};

const HOUR = 60 * 60 * 1000;

/**
 * Emails staff about the replies to texts that have waited ALERT_AFTER_HOURS
 * or more, still in WhatsApp's window, that no email has named: one email
 * each broadcast, to the notification inbox, copied to whoever made it,
 * each reply with how long is left to answer it and a link to its thread.
 * Each reply is named once: those in an email that went are marked as
 * named. Says how many replies it named. `request` is the job's call, for
 * links; a staff member's run has none.
 */
export async function alertWaitingTexts(request?: Request): Promise<number> {
  const at = now();
  const waiting = await query<Waiting>(
    `SELECT r.id::int AS id, c.id::int AS "copyId", m.id::int AS "mailingId", m.title, m.created_by AS "createdBy",
       r.from_address AS from, c.merge_values ->> 'name' AS name, r.received_at AS "receivedAt"
     FROM broadcast_replies r JOIN broadcast_messages c ON c.id = r.message_id JOIN mailings m ON m.id = c.mailing_id
     WHERE r.provider_message_id IS NOT NULL AND r.outcome IS NULL AND NOT r.automatic AND r.alerted_at IS NULL
       AND r.received_at <= $1 AND r.received_at > $2
     ORDER BY m.id, r.received_at, r.id`,
    [new Date(at.getTime() - ALERT_AFTER_HOURS * HOUR), new Date(at.getTime() - REPLY_WINDOW_HOURS * HOUR)],
  );
  const email = broadcastsCopy.notifications.textsWaiting;
  let named = 0;
  for (const mailingId of new Set(waiting.map((reply) => reply.mailingId))) {
    const replies = waiting.filter((reply) => reply.mailingId === mailingId);
    const { title, createdBy } = replies[0];
    const lines = replies.map((reply) =>
      email.line(
        reply.name || phoneWords(reply.from),
        Math.max(1, Math.floor(REPLY_WINDOW_HOURS - (at.getTime() - reply.receivedAt.getTime()) / HOUR)),
        staffLink(`/staff/broadcasts/${mailingId}/${reply.copyId}`, request),
      ),
    );
    const told = await notifyStaff(
      email.subject(replies.length, title),
      email.body(title, lines),
      null,
      "staff-alert",
      createdBy,
    );
    if (!told) continue;
    await query("UPDATE broadcast_replies SET alerted_at = $2 WHERE id = ANY($1::bigint[])", [
      replies.map((reply) => reply.id),
      at,
    ]);
    named += replies.length;
  }
  return named;
}
