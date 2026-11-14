import "server-only";
import { checkMailingDoc, type MailingRecipientValues } from "./doc";
import { IN_FLIGHT, statusIn } from "@/lib/letter-status";
import { now } from "@/lib/now";
import { SENDING } from "@/lib/staff-time";
import { logChange } from "@/lib/server/audit.server";
import { query } from "@/lib/server/db.server";
import { isBlocked, sentBy } from "@/lib/server/email.server";
import { gmailAccount } from "@/lib/accounts/gmail-accounts.server";
import { SentUnrecorded, sendLetterVia, transition } from "@/lib/server/letter-lifecycle.server";
import { problem } from "@/lib/server/problems.server";
import { staffCopy } from "@/lib/content/staff-interface";
import { attachmentsOf, emailFor } from "./drafts.server";
import { mailingChannel, paced, type MailingChannel } from "./channels.server";
import type { SkipReason } from "./records.server";
import { sql } from "@/lib/server/sql.server";

// Sending the mailings that are due: the send-mailings job starts each
// scheduled one whose time has come, then sends its letters one at a
// time, at Gmail's pace, marking each as it goes, so a run that stops
// partway is taken up by the next. Each letter is checked again just
// before it goes: a politician who has left office, or whose address has
// been blocked since, is skipped, and the letter says why. Only mailings to
// politicians: a message to supporters goes by its own channel, and this
// job would otherwise find it has no letters and call it sent.

/** Who the audit log says started a mailing. */
const JOB = "send-mailings";

/** The gap between two sends from one account: Gmail takes 60 a minute. */
const SEND_GAP_MS = 1000;

/**
 * Starts every scheduled mailing that's due, but none overnight, before
 * SENDING.firstHour (lib/staff-time.ts), though the job runs all night:
 * one due then starts with the morning's first run. Returns their IDs.
 */
export async function startDueMailings(): Promise<number[]> {
  if (now().getUTCHours() < SENDING.firstHour) return [];
  const started = await query<{ id: number }>(
    `UPDATE mailings SET state = 'sending', updated_at = now()
     WHERE state = 'scheduled' AND audience = 'politicians' AND due_at <= $1 RETURNING id::int AS id`,
    [now()],
  );
  for (const { id } of started) await logChange(JOB, "start mailing", { id });
  return started.map(({ id }) => id).sort((a, b) => a - b);
}

/** What a run of sending did, and what's left: letters still to go, and whether an account has reached its limit for the day. */
export type SendingRun = { sent: number; skipped: number; failed: number; left: number; waiting: string[] };

type Mailing = { id: number; subject: string; body: unknown; sentFrom: string; fromName: string };

type Letter = {
  id: number;
  name: string;
  email: string | null;
  inOffice: boolean;
  mergeValues: MailingRecipientValues;
};

/** Takes the next letter of a mailing to send, marking it sending, so no other run sends it too. */
async function nextLetter(mailingId: number): Promise<Letter | undefined> {
  const [id] = await transition(
    sql`SELECT l.id FROM letters l JOIN letters_from_pauseai p USING (id)
        WHERE p.mailing_id = ${mailingId} AND l.status = 'scheduled' ORDER BY l.id LIMIT 1 FOR UPDATE SKIP LOCKED`,
    ["scheduled"],
    "sending",
    { stamp: "taken_at" },
  );
  if (!id) return undefined;
  try {
    const [letter] = await query<Letter>(
      `SELECT l.id::int AS id, n.name, n.email, n.status = 'in_office' AS "inOffice", p.merge_values AS "mergeValues"
       FROM letters l JOIN letters_from_pauseai p USING (id) JOIN notable_people n ON n.id = l.notable_person_id
       WHERE l.id = $1`,
      [id],
    );
    return letter;
  } catch (error) {
    // Taken but not read, so never sent: back to go next run, rather than left sending.
    await transition(id, ["sending"], "scheduled");
    throw error;
  }
}

async function skip(letterId: number, reason: SkipReason): Promise<void> {
  await query("UPDATE letters_from_pauseai SET skip_reason = $2 WHERE id = $1", [letterId, reason]);
  await transition(letterId, ["sending"], "skipped", { event: "skipped", details: { reason } });
}

/** Marks every mailing sending with no letter left to send as sent. */
async function finishMailings(): Promise<void> {
  const finished = await query<{ id: number }>(
    `UPDATE mailings m SET state = 'sent', updated_at = now() WHERE m.state = 'sending' AND m.audience = 'politicians' AND NOT EXISTS (
       SELECT 1 FROM letters_from_pauseai p JOIN letters l USING (id)
       WHERE p.mailing_id = m.id AND ${statusIn("l.status", IN_FLIGHT)})
     RETURNING m.id::int AS id`,
  );
  for (const { id } of finished) await logChange(JOB, "finish mailing", { id });
}

/** Letters of mailings being sent still to go. */
async function lettersLeft(): Promise<number> {
  const [{ left }] = await query<{ left: number }>(
    `SELECT count(*)::int AS left FROM letters l JOIN letters_from_pauseai p USING (id) JOIN mailings m ON m.id = p.mailing_id
     WHERE m.state = 'sending' AND l.status = 'scheduled'`,
  );
  return left;
}

/** What became of a mailing's letter that didn't go: skipped, with its reason, failed, or `waiting` for the next run. */
type Unsent = { sent: false; skipped: boolean; waiting?: true };

/** A letter skipped, with why. */
async function skipped(letterId: number, reason: SkipReason): Promise<Unsent> {
  await skip(letterId, reason);
  return { sent: false, skipped: true };
}

/**
 * Sends the letters of the mailings being sent, oldest due first, one at a
 * time, `gap` apart, until there are none or it's `until` (a time in ms).
 * An account at its daily limit, or no longer connected, or one Gmail
 * answers can't send for now, sends no more this run: its letters wait
 * for the next.
 */
export async function sendDueLetters({
  until,
  gap = SEND_GAP_MS,
  channel = mailingChannel("email")!,
}: {
  until: number;
  gap?: number;
  channel?: MailingChannel;
}): Promise<SendingRun> {
  const run: SendingRun = { sent: 0, skipped: 0, failed: 0, left: 0, waiting: [] };
  const pacedChannel = paced(channel, gap);
  const mailings = await query<Mailing>(
    // In its From name, or with none the name its Gmail sends as, written into the From line: whether
    // Gmail would fill in a name left out isn't documented, so none is left to it.
    `SELECT m.id::int AS id, m.subject, m.body, m.sent_from AS "sentFrom",
       coalesce(nullif(m.from_name, ''), a.gmail_name, '') AS "fromName"
     FROM mailings m LEFT JOIN staff_accounts a ON a.email = m.sent_from
     WHERE m.state = 'sending' AND m.audience = 'politicians' ORDER BY m.due_at, m.id`,
  );
  for (const mailing of mailings) {
    if (run.waiting.includes(mailing.sentFrom)) continue;
    const body = checkMailingDoc(mailing.body)!;
    const attachments = await attachmentsOf(mailing.id);
    while (Date.now() + gap < until) {
      const account = await gmailAccount(mailing.sentFrom);
      if (!account || (await channel.remainingToday(mailing.sentFrom))! <= 0) {
        run.waiting.push(mailing.sentFrom);
        break;
      }
      const letter = await nextLetter(mailing.id);
      if (!letter) break;
      const to = letter.email;
      let result: { sent: true } | Unsent;
      try {
        result = await sendLetterVia<Unsent>(pacedChannel, {
          id: letter.id,
          purpose: "mailing",
          held: async () => {
            if (!letter.inOffice) return skipped(letter.id, "left-office");
            if (!to) return skipped(letter.id, "no-email");
            if (await isBlocked(to)) return skipped(letter.id, "blocked");
            return undefined;
          },
          message: async () => ({
            from: { name: mailing.fromName, address: mailing.sentFrom },
            to: { name: letter.name, address: to! },
            ...emailFor({ subject: mailing.subject, body }, letter.mergeValues),
            attachments,
            letterId: letter.id,
          }),
          sentDetails: (sent) => ({
            from: mailing.sentFrom,
            to,
            messageId: sent.messageId,
            threadId: sent.threadId,
            // A mailing's letter goes from its mailing's Gmail.
            ...sentBy({ name: "gmail", account: mailing.sentFrom }),
          }),
          unsent: async ({ reason, retry, detail }) => {
            if (reason === "blocked") return skipped(letter.id, "blocked");
            if (retry) {
              // Gmail can't send for now: it waits for the next run, as the rest from its account do.
              await transition(letter.id, ["sending"], "scheduled");
              return { sent: false, skipped: false, waiting: true };
            }
            // Gmail's own words, for the letter's history.
            await transition(letter.id, ["sending"], "not_sent", { event: "failed", details: { detail } });
            return { sent: false, skipped: false };
          },
        });
      } catch (error) {
        const words = staffCopy.problems.anywhere;
        if (error instanceof SentUnrecorded) {
          // It went: it stays sending, for uncertainLetters to mark uncertain, so it isn't sent twice.
          problem(words.sentUnrecorded(words.letterOf(letter.id)), error.cause);
          run.sent++;
          continue;
        }
        // It never went (NotSentYet): back to go next run, and the rest of this mailing with it.
        await transition(letter.id, ["sending"], "scheduled");
        problem(words.notSentYet(words.letterOf(letter.id)), error);
        break;
      }
      if (result.sent) run.sent++;
      else if (result.skipped) run.skipped++;
      else if (result.waiting) {
        run.waiting.push(mailing.sentFrom);
        break;
      } else run.failed++;
    }
  }
  await finishMailings();
  return { ...run, left: await lettersLeft() };
}
