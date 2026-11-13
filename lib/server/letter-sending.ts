import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { copy } from "@/lib/content/email-your-mp";
import { campaignBySlug } from "@/lib/email-your-mp";
import { checkDoc, toHtml, toText } from "@/lib/letter-format";
import { query } from "./db";
import { isBlocked, send, sentBy, type Backend, type Purpose } from "./email";
import { gmailAccount } from "./gmail-accounts";
import { letterEvent, SentUnrecorded, sendLetterVia, transition } from "./letter-lifecycle";
import { lettersInbox, proxyAddress } from "./letters-inbox";
import { lettersInboxEmail } from "./mailing-channels";
import { staffCopy } from "@/lib/content/staff-interface";
import { reportSupporterBounces, tellOfficesOfHeldReplies } from "./held-replies";
import { notifyStaff, reportMailingBounces, staffLink } from "./notifications";
import { mpName, nameLine, proxyLine } from "./proxies";
import { resendAfterFix, sendRelay, uncertainRelays } from "./relays";
import { problem } from "./problems";

// Supporters' letters to MPs, sent from the letters inbox
// (lib/server/letters-inbox.ts): the letter, from the supporter's proxy to
// the MP's address, then the supporter's copy, from their proxy to them,
// with Reply-To the MP's proxy, so replying to it reaches only our proxies. Once a
// letter passes the form's checks it's kept, queued, and never deleted for
// failing to send: the request tries at once, and whatever stops it waits,
// with its reason, for the hourly run (sendLetterQueue), or, for a blocked
// MP's address, for staff to fix it.

/**
 * Why a letter, a copy or a relay waits: the letters inbox isn't
 * connected, it's at its daily limit, Gmail refused or couldn't be
 * reached, or the address it's to is blocked.
 */
export type QueueReason = "not_connected" | "daily_limit" | "failed" | "blocked";

/** What a letter needs to go, from its rows: who it's from and to, by name, address and proxy, and what it says. */
export type OutgoingLetter = {
  id: number;
  status: string;
  copyState: string;
  campaign: string;
  subject: string;
  letter: unknown;
  senderName: string;
  senderEmail: string;
  supporterTag: string;
  mpName: string;
  mpEmail: string | null;
  mpTag: string;
};

/** A letter sent from the letters inbox, by its ID. */
export async function outgoingLetter(id: number): Promise<OutgoingLetter | undefined> {
  const [row] = await query<OutgoingLetter>(
    `SELECT l.id::int AS id, l.status, s.copy_state AS "copyState", s.campaign, s.subject, s.letter,
       f.name AS "senderName", f.email AS "senderEmail", sp.tag AS "supporterTag",
       n.name AS "mpName", n.email AS "mpEmail", mp.tag AS "mpTag"
     FROM letters_from_supporters s JOIN letters l USING (id) JOIN form_entries f ON f.id = s.entry_id
       JOIN proxies sp ON sp.id = s.proxy_id JOIN notable_people n ON n.id = l.notable_person_id
       JOIN proxies mp ON mp.notable_person_id = n.id
     WHERE l.id = $1`,
    [id],
  );
  return row;
}

/** The letters inbox as send() takes it. */
export function lettersBackend(): Backend {
  return { name: "gmail", account: lettersInbox()! };
}

/** Why the letters inbox can't send `count` more emails now, if it can't. */
export async function cannotSend(count: number): Promise<QueueReason | undefined> {
  const inbox = lettersInbox();
  if (!inbox || !(await gmailAccount(inbox))) return "not_connected";
  if ((await lettersInboxEmail.remainingToday(inbox))! < count) return "daily_limit";
  return undefined;
}

/** The Message-ID a letter's email of `purpose` went with, if it went. */
export async function sentMessageId(letterId: number, purpose: Purpose): Promise<string | undefined> {
  const [row] = await query<{ id: string }>(
    `SELECT rfc_message_id AS id FROM email_sends
     WHERE letter_id = $1 AND purpose = $2 AND outcome = 'sent' AND rfc_message_id IS NOT NULL ORDER BY id DESC LIMIT 1`,
    [letterId, purpose],
  );
  return row?.id;
}

/** In-Reply-To and References naming `messageId`, so an email joins its thread; none without one. */
export function threading(messageId: string | undefined) {
  return messageId ? ["In-Reply-To", "References"].map((Name) => ({ Name, Value: `<${messageId}>` })) : undefined;
}

async function attachments(campaignSlug: string) {
  const campaign = campaignBySlug(campaignSlug)!;
  return Promise.all(
    campaign.attachments.map(async ({ file }) => ({
      Name: file,
      Content: (await readFile(join(process.cwd(), "public", "pdfs", file))).toString("base64"),
      ContentType: "application/pdf",
    })),
  );
}

/** Puts a letter back in the queue, saying why in its history unless it already said so last. */
async function requeue(letterId: number, reason: QueueReason): Promise<{ sent: false; reason: QueueReason }> {
  const [last] = await query<{ status: string; reason: string | null }>(
    `SELECT status, details->>'reason' AS reason FROM letter_events WHERE letter_id = $1 ORDER BY at DESC, id DESC LIMIT 1`,
    [letterId],
  );
  const said = last?.status === "queued" && last.reason === reason;
  await transition(letterId, ["sending"], "queued", said ? {} : { event: "queued", details: { reason } });
  return { sent: false, reason };
}

/**
 * Sends a queued letter, then its copy: to the MP's address as it is now,
 * which may have changed since it was written. Takes the letter first, so
 * a run that's sending it too doesn't. Says whether it went, or why not.
 */
export async function sendLetter(id: number): Promise<{ sent: true } | { sent: false; reason: QueueReason }> {
  const [taken] = await transition(id, ["queued"], "sending", { stamp: "taken_at" });
  if (!taken) return { sent: true };
  try {
    return await sendTaken(id);
  } catch (error) {
    const words = staffCopy.problems.anywhere;
    if (error instanceof SentUnrecorded) {
      // It went: it stays sending, for uncertainLetters to mark uncertain, so it isn't sent twice. The run goes on.
      problem(words.sentUnrecorded(words.letterOf(id)), error.cause);
      return { sent: true };
    }
    // It never went: back in the queue, so the next run tries again; whoever wrote it is told it's on its way.
    problem(words.letterNotSent(id), error);
    return requeue(id, "failed");
  }
}

/**
 * Sends a letter sendLetter has taken, from the supporter's proxy to the
 * MP's address, by the letters inbox; once it's gone, their copy.
 */
async function sendTaken(id: number): Promise<{ sent: true } | { sent: false; reason: QueueReason }> {
  const letter = (await outgoingLetter(id))!;
  const to = letter.mpEmail;
  const result = await sendLetterVia(lettersInboxEmail, {
    id,
    purpose: "letter",
    held: async () => {
      if (!to || (await isBlocked(to))) return requeue(id, "blocked");
      // Room for the copy too, so the two go together.
      const full = await cannotSend(2);
      return full ? requeue(id, full) : undefined;
    },
    message: async () => {
      const doc = checkDoc(letter.letter)!;
      return {
        from: { name: letter.senderName, address: proxyAddress(letter.supporterTag) },
        to: { name: mpName(letter.mpName), address: to! },
        subject: letter.subject,
        text: toText(doc),
        html: toHtml(doc),
        attachments: await attachments(letter.campaign),
        letterId: id,
      };
    },
    sentDetails: (sent) => ({
      from: proxyLine(letter.senderName, letter.supporterTag),
      to,
      messageId: sent.messageId,
      ...sentBy(lettersBackend()),
    }),
    // A block found only as it went is one the next try finds first.
    unsent: () => requeue(id, "failed"),
  });
  if (result.sent) await sendCopy(id);
  return result;
}

/**
 * Sends the supporter their copy of a letter that has gone: the letter,
 * with a line above it saying what it is, from their proxy to them, by
 * name, with Reply-To their MP's proxy, so Reply and Reply all reach the
 * MP through us. Addressed to them, not Bcc'd: mail they're only Bcc'd on
 * is more likely to be filed as junk. Held while their address is
 * blocked; left queued while the letters inbox can't send.
 */
export async function sendCopy(id: number): Promise<void> {
  const [taken] = await query(
    `UPDATE letters_from_supporters s SET copy_state = 'sending', copy_taken_at = now() FROM letters l
     WHERE s.id = $1 AND l.id = s.id AND l.status = 'sent' AND s.copy_state = 'queued' RETURNING s.id`,
    [id],
  );
  if (!taken) return;
  const state = async (copyState: string) =>
    query("UPDATE letters_from_supporters SET copy_state = $2 WHERE id = $1", [id, copyState]);
  const words = staffCopy.problems.anywhere;
  let sent: Awaited<ReturnType<typeof sendTakenCopy>>;
  try {
    sent = await sendTakenCopy(id, state);
  } catch (error) {
    // Nothing went (send never throws after it has): back in the queue, to go next run.
    await state("queued");
    problem(words.notSentYet(words.letterCopyOf(id)), error);
    return;
  }
  if (!sent) return;
  try {
    await state("sent");
    await letterEvent(id, "copy_sent", sent);
  } catch (error) {
    // It went: left sending, for uncertainLetters to mark uncertain, never sent twice.
    problem(words.sentUnrecorded(words.letterCopyOf(id)), error);
  }
}

/** Sends a copy sendCopy has taken, unless held or left queued (`state`), saying what its event records once it went. */
async function sendTakenCopy(id: number, state: (copyState: string) => Promise<unknown>) {
  const letter = (await outgoingLetter(id))!;
  if (await isBlocked(letter.senderEmail)) {
    await state("held");
    await letterEvent(id, "copy_held", { to: letter.senderEmail, reason: "blocked" });
    return undefined;
  }
  if (await cannotSend(1)) return void (await state("queued"));
  const doc = checkDoc(letter.letter)!;
  const line = copy.letterCopy(mpName(letter.mpName));
  const from = proxyLine(letter.senderName, letter.supporterTag);
  const replyTo = proxyLine(mpName(letter.mpName), letter.mpTag);
  const result = await send(
    {
      From: from,
      To: nameLine(letter.senderName, letter.senderEmail),
      ReplyTo: replyTo,
      Subject: letter.subject,
      // The line set apart from the letter: italic and grey, over a rule; in plain text, over a dash.
      TextBody: `${line}\n—\n\n${toText(doc)}`,
      HtmlBody: `<p style="color:#666666"><em>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</em></p><hr style="border:0;border-top:1px solid #dddddd">${toHtml(doc)}`,
      Attachments: await attachments(letter.campaign),
    },
    "letter-copy",
    id,
    { backend: lettersBackend() },
  );
  if (!result.sent) return void (await state("queued"));
  return { from, to: letter.senderEmail, replyTo, messageId: result.messageId, ...sentBy(result.backend) };
}

/**
 * Marks as uncertain each letter, of a mailing or from the letters inbox,
 * and each supporter's copy, that a run took to send and left sending, as
 * it may have gone, or not: a person checks, as sending it again could
 * send it twice. Only those left a while, so a run going now isn't caught.
 * A mailing waits for none of them to finish.
 */
export async function uncertainLetters(): Promise<number> {
  const left = await query<{ id: number; to: string | null }>(
    `SELECT l.id::int AS id, n.email AS to FROM letters l JOIN notable_people n ON n.id = l.notable_person_id
     WHERE l.status = 'sending' AND l.taken_at < now() - interval '15 minutes' ORDER BY l.id`,
  );
  // Who it may have gone to, as every email's change says; one a run finished meanwhile is left as it is.
  const letters = [];
  for (const { id, to } of left) {
    letters.push(...(await transition(id, ["sending"], "uncertain", { event: "uncertain", details: { to } })));
  }
  const copies = await query<{ id: number; to: string }>(
    `UPDATE letters_from_supporters s SET copy_state = 'uncertain' FROM form_entries f
     WHERE f.id = s.entry_id AND s.copy_state = 'sending' AND s.copy_taken_at < now() - interval '15 minutes'
     RETURNING s.id::int AS id, f.email AS to`,
  );
  for (const { id, to } of copies) await letterEvent(id, "copy_uncertain", { to });
  return letters.length + copies.length;
}

/**
 * How many days after it was written a letter that bounced, or after it
 * came a relay to the MP that bounced, still goes again once the MP's
 * address works. Past that it never goes, and its sender is told so
 * (tellOfNotResent).
 */
export const RESEND_DAYS = 7;

/**
 * Our own short email to a letter's sender, `notice` of copy.notices, from
 * the letters inbox's own address as "PauseAI", in the thread of their
 * copy. `about` is the message in Gmail it's about, when that's a relay
 * and not the letter. Says whether it went.
 */
export async function noticeToSender(
  letterId: number,
  notice: "bounced" | "resent" | "notResent",
  about?: string,
): Promise<boolean> {
  const letter = await outgoingLetter(letterId);
  if (!letter || (await cannotSend(1))) return false;
  const result = await send(
    {
      From: `"PauseAI" <${lettersInbox()}>`,
      To: nameLine(letter.senderName, letter.senderEmail),
      Subject: `Re: ${letter.subject}`,
      TextBody: copy.notices[notice](mpName(letter.mpName)),
      Headers: threading(await sentMessageId(letterId, "letter-copy")),
    },
    "supporter-notice",
    letterId,
    { backend: lettersBackend() },
  );
  if (result.sent) {
    await letterEvent(letterId, "notice", {
      to: letter.senderEmail,
      notice,
      ...(about ? { gmailMessageId: about } : {}),
      ...sentBy(result.backend),
    });
  }
  return result.sent;
}

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
 * address; and, once a day, reports how often that happens (held-replies.ts)
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
