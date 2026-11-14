import "server-only";
import { staffCopy } from "@/lib/content/staff-interface";
import { query } from "./db.server";
import { reportSupporterBounces, tellOfficesOfHeldReplies } from "./held-replies.server";
import { cannotSend, noticeToSender, RESEND_DAYS, sendCopy, sendLetter } from "./letter-sending.server";
import { notifyStaff, reportMailingBounces, staffLink } from "./notifications.server";
import { resendAfterFix, sendRelay, uncertainRelays } from "./relays.server";

// The letters inbox's hourly run through what waits to go: relays, letters
// and copies (letter-sending.server.ts, relays.server.ts), then what it tells staff,
// senders and MPs' offices of what's waited, bounced or been held.

/**
 * Sends again what bounced to an MP whose address has changed since: each
 * letter or relay to them that bounced, and isn't past RESEND_DAYS, once
 * their address is one that isn't blocked and isn't the one it bounced
 * from (resendAfterFix).
 */
async function resendToChangedAddresses(): Promise<void> {
  const changed = await query<{ id: number }>(
    `SELECT DISTINCT n.id::int AS id FROM notable_people n JOIN letters l ON l.notable_person_id = n.id
     WHERE n.email IS NOT NULL AND NOT EXISTS (SELECT 1 FROM email_blocks b WHERE b.address = lower(n.email))
       AND (EXISTS (SELECT 1 FROM letters_from_supporters s JOIN email_sends e ON e.letter_id = s.id AND e.purpose = 'letter'
                    WHERE s.id = l.id AND s.proxy_id IS NOT NULL AND l.status = 'bounced' AND e.address <> lower(n.email)
                      AND l.created_at > now() - interval '${RESEND_DAYS} days')
         OR EXISTS (SELECT 1 FROM letter_relays r JOIN email_sends e ON e.rfc_message_id = r.rfc_message_id
                    WHERE r.letter_id = l.id AND r.status = 'bounced' AND NOT r.to_supporter AND e.address <> lower(n.email)
                      AND r.created_at > now() - interval '${RESEND_DAYS} days'))`,
  );
  for (const { id } of changed) await resendAfterFix({ politicianId: id });
}

/**
 * Tells the sender of each letter, and each relay to the MP, that bounced
 * and is past RESEND_DAYS, that it wasn't sent and won't be: once each. A
 * letter's only if they were told it bounced, and so that it would go
 * again: a soft bounce marks a letter bounced too, and tells nobody. None
 * while the sender's own address is blocked, or the letters inbox can't
 * send, when a later run tells them.
 */
async function tellOfNotResent(): Promise<void> {
  const told = (notice: string, about: string) =>
    `EXISTS (SELECT 1 FROM letter_events e WHERE e.letter_id = l.id AND e.status = 'notice'
       AND e.details->>'notice' = '${notice}' AND e.details->>'gmailMessageId' ${about})`;
  const past = (column: string) => `${column} <= now() - interval '${RESEND_DAYS} days'`;
  const stale = await query<{ id: number; about: string | null }>(
    `SELECT x.id, x.about FROM (
       SELECT l.id::int AS id, NULL AS about FROM letters l JOIN letters_from_supporters s USING (id)
       WHERE s.proxy_id IS NOT NULL AND l.status = 'bounced' AND ${past("l.created_at")}
         AND ${told("bounced", "IS NULL")} AND NOT ${told("notResent", "IS NULL")}
       UNION ALL
       SELECT l.id::int, m.gmail_message_id FROM letter_relays r JOIN letters l ON l.id = r.letter_id
         JOIN letter_replies m ON m.id = r.reply_id
       WHERE r.status = 'bounced' AND NOT r.to_supporter AND ${past("r.created_at")}
         AND NOT ${told("notResent", "= m.gmail_message_id")}) x
       JOIN letters_from_supporters s ON s.id = x.id JOIN form_entries f ON f.id = s.entry_id
     WHERE NOT EXISTS (SELECT 1 FROM email_blocks b WHERE b.address = lower(btrim(f.email)))
     ORDER BY x.id, x.about NULLS FIRST`,
  );
  for (const { id, about } of stale) await noticeToSender(id, "notResent", about ?? undefined);
}

/**
 * Sends each of `ids` in turn with `send`, while it's before `until` and the
 * letters inbox has room for `room` more. Returns how many `send` says went.
 */
async function drain(ids: number[], until: number, room: number, send: (id: number) => Promise<boolean>) {
  let sent = 0;
  for (const id of ids) {
    if (Date.now() >= until || (await cannotSend(room))) break;
    if (await send(id)) sent++;
  }
  return sent;
}

/** How long a letter to an MP waits to go before the notification inbox is told. */
const LATE_HOURS = 3;

/** The letters waiting to go, oldest first, but those whose MP's address is blocked, which wait for staff. */
const SENDABLE = `SELECT l.id::int AS id FROM letters l JOIN letters_from_supporters s USING (id) JOIN notable_people n ON n.id = l.notable_person_id
     WHERE l.status = 'queued' AND n.email IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM email_blocks b WHERE b.address = lower(n.email))`;

/**
 * Emails the notification inbox when letters have waited LATE_HOURS to go:
 * how many, and why. Once: the email is logged against the oldest, and
 * none goes while a letter it was logged against is still waiting.
 */
async function tellOfLateLetters(request: Request | undefined): Promise<void> {
  const late = await query<{ id: number }>(
    `${SENDABLE} AND l.created_at < now() - interval '${LATE_HOURS} hours' ORDER BY l.created_at, l.id`,
  );
  if (!late.length) return;
  const [told] = await query(
    `SELECT 1 FROM email_sends e JOIN letters l ON l.id = e.letter_id
     WHERE e.purpose = 'staff-alert' AND e.outcome = 'sent' AND l.status = 'queued'`,
  );
  if (told) return;
  const words = staffCopy.notifications.lettersWaiting;
  const why = staffCopy.letters.detail.reasons[(await cannotSend(2)) ?? "failed"];
  await notifyStaff(
    words.subject(late.length, LATE_HOURS),
    words.body(late.length, LATE_HOURS, why, staffLink("/staff/campaigns", request)),
    late[0].id,
  );
}

/** What a run through the queue sent, and what's left in it. */
export type LetterQueueRun = { sent: number; left: number };

/**
 * Works through the letters inbox's queue, until it's `until` (a time in
 * ms): first marking relays a stopped run left sending as uncertain; then
 * relays waiting to be tried again, so an MP's reply is never held up
 * behind new letters; then letters, oldest first; then copies. A letter
 * whose MP's address is still blocked is passed over. Stops when the
 * letters inbox can't send. Then tells the notification inbox if letters
 * have waited too long (tellOfLateLetters), linking from `request`'s site;
 * tells senders of what bounced too long ago to go again (tellOfNotResent);
 * tells MPs' offices of replies held a day for a supporter's bouncing
 * address; and, once a day, reports how often that happens (held-replies.server.ts)
 * and which MPs' addresses bounced a mailing (reportMailingBounces).
 */
export async function sendLetterQueue(until: number, request?: Request): Promise<LetterQueueRun> {
  await uncertainRelays();
  await resendToChangedAddresses();
  const ids = async (sql: string) => (await query<{ id: number }>(sql)).map((row) => row.id);
  const relays = await ids("SELECT id::int AS id FROM letter_relays WHERE status = 'queued' ORDER BY created_at, id");
  let sent = await drain(relays, until, 1, async (id) => (await sendRelay(id)).sent);
  const letters = await ids(`${SENDABLE} ORDER BY l.created_at, l.id`);
  sent += await drain(letters, until, 2, async (id) => (await sendLetter(id)).sent);
  const copies = await ids(
    "SELECT s.id::int AS id FROM letters_from_supporters s JOIN letters l USING (id) WHERE s.copy_state = 'queued' AND l.status = 'sent' ORDER BY s.id",
  );
  await drain(copies, until, 1, async (id) => (await sendCopy(id), false));
  const [{ left }] = await query<{ left: number }>(
    `SELECT (SELECT count(*) FROM letter_relays WHERE status = 'queued')
       + (SELECT count(*) FROM letters WHERE status = 'queued')
       + (SELECT count(*) FROM letters_from_supporters s JOIN letters l USING (id) WHERE s.copy_state = 'queued' AND l.status = 'sent') AS left`,
  );
  await tellOfLateLetters(request);
  await tellOfNotResent();
  await tellOfficesOfHeldReplies();
  await reportSupporterBounces(request);
  await reportMailingBounces(request);
  return { sent, left: Number(left) };
}
