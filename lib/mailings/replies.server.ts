import "server-only";
import { named } from "@/lib/email-parsing/addresses";
import { answerSubject } from "@/lib/email-parsing/subjects";
import { gmailAccess } from "@/lib/email/gmail-accounts.server";
import { send } from "@/lib/email/sending.server";
import { emailCopy } from "@/lib/email/copy";
import { checkDoc, isBlank, toHtml, toText } from "@/lib/letters/format";
import { keepReply } from "@/lib/letters/replies.server";
import { logChange } from "@/lib/server/audit.server";
import { config } from "@/lib/server/config.server";
import { query, transaction } from "@/lib/server/db.server";
import { gmailMessageHeaders } from "@/lib/server/outside-services/gmail.server";
import { problem } from "@/lib/server/problems.server";
import { replyToCheck } from "@/lib/letters/copy-states";
import type { AnswerResult } from "./answers";
import { mailingsCopy } from "./copy";

// What staff do with a politician's reply to a mailing's letter, on the
// letter's page. A reply waits for them (replyToCheck in
// lib/letters/copy-states.ts) until something deals with it: Nothing to do,
// pressed on it or a later one; our answer, sent here or written in the
// mailbox's Gmail; or the politician's answer to the mailing's ask set
// since. An answer here goes by Gmail from the mailbox the reply came to,
// as the mailing's From name, in the reply's thread there, naming the reply
// and our letter (In-Reply-To, References), so it's in that mailbox's Sent
// and the office's conversation. Only a shared mailbox, the policy team's,
// can be answered from by any staff member; one of a person's own, only by
// that person. Reading the mailbox skips our own sends
// (gmail-reading.server.ts, isOurs), so the answer is kept on the letter as
// it goes.

/** Whether staff member `staff` may answer from mailbox `account`: the policy team's, or their own. */
export function canAnswerFrom(account: string, staff: string): boolean {
  const mailbox = account.toLowerCase();
  return mailbox === config.policyInbox || mailbox === staff.toLowerCase();
}

/**
 * The politician's reply on a mailing's letter `letterId` that its page puts
 * the buttons under: their latest, while any reply waits for staff
 * (replyToCheck), with the mailbox it came to, or null if none waits; and
 * whether staff member `staff` can answer it from that mailbox.
 */
export async function replyWaiting(
  letterId: number,
  staff: string,
): Promise<{ waiting: { id: number; account: string } | null; canAnswer: boolean }> {
  const [reply] = await query<{ id: number; account: string }>(
    `SELECT r.id::int AS id, r.account FROM letter_replies r
       JOIN letters_from_pauseai p ON p.id = r.letter_id JOIN mailings m ON m.id = p.mailing_id
     WHERE r.letter_id = $1 AND ${replyToCheck("m.ask")}
     ORDER BY r.at DESC, r.id DESC LIMIT 1`,
    [letterId],
  );
  return { waiting: reply ?? null, canAnswer: Boolean(reply && canAnswerFrom(reply.account, staff)) };
}

/**
 * Marks reply `replyId` to a mailing's letter, and so those before it, as
 * needing nothing, by staff member `by`. Says whether it did: not for a
 * message of ours, one marked already, or one on a supporter's letter.
 */
export async function markNothingToDo(replyId: number, by: string): Promise<boolean> {
  return transaction(async (db) => {
    const [marked] = await query<{ letterId: number }>(
      `UPDATE letter_replies r SET dealt_by = $2, dealt_at = now()
       FROM letters_from_pauseai p
       WHERE r.id = $1 AND p.id = r.letter_id AND NOT r.from_us AND r.dealt_at IS NULL
       RETURNING r.letter_id::int AS "letterId"`,
      [replyId, by.toLowerCase()],
      db,
    );
    if (!marked) return false;
    await logChange(by, "nothing to do on letter reply", { replyId, letterId: marked.letterId }, db);
    return true;
  });
}

/** A reply to answer, as kept, with what the answer names: our letter's Message-ID. */
type Answering = {
  letterId: number;
  account: string;
  threadId: string;
  rfcMessageId: string | null;
  letterMessageId: string | null;
  to: string;
  toName: string;
  subject: string;
  fromName: string | null;
};

/** The headers a kept message is read by (keepReply). */
const KEPT_HEADERS = ["From", "To", "Cc", "Reply-To", "Subject", "Message-ID"];

/**
 * Sends staff member `by`'s answer, `body`, to reply `replyId` to a
 * mailing's letter, once for each `draftId`: a second press of Send finds it
 * sent, or sending. One that fails is forgotten, so it can be sent again.
 * Sent, it's kept on the letter as ours, which deals with the reply and
 * those before it. A reply staff member `by` can't answer from its mailbox
 * (canAnswerFrom), or not read from Gmail, is gone, as the page offers no
 * answer to it.
 */
export async function answerLetterReply(
  replyId: number,
  draftId: string,
  body: unknown,
  by: string,
): Promise<AnswerResult> {
  const doc = checkDoc(body);
  if (!doc || isBlank(doc)) return { sent: false, reason: "blank" };
  const [reply] = await query<Answering>(
    `SELECT r.letter_id::int AS "letterId", r.account, r.gmail_thread_id AS "threadId",
       r.rfc_message_id AS "rfcMessageId", r.from_address AS to, r.from_name AS "toName", r.subject,
       coalesce(nullif(m.from_name, ''), (SELECT a.gmail_name FROM staff_accounts a WHERE a.email = r.account))
         AS "fromName",
       (SELECT s.rfc_message_id FROM email_sends s WHERE s.letter_id = r.letter_id AND s.outcome = 'sent'
        ORDER BY s.id DESC LIMIT 1) AS "letterMessageId"
     FROM letter_replies r JOIN letters_from_pauseai p ON p.id = r.letter_id JOIN mailings m ON m.id = p.mailing_id
     WHERE r.id = $1 AND NOT r.from_us AND r.gmail_thread_id IS NOT NULL`,
    [replyId],
  );
  if (!reply || !canAnswerFrom(reply.account, by)) return { sent: false, reason: "gone" };
  const [answer] = await query<{ id: number }>(
    `INSERT INTO letter_answers (reply_id, draft_id, sent_by) VALUES ($1, $2, $3)
     ON CONFLICT (draft_id) DO NOTHING RETURNING id::int AS id`,
    [replyId, draftId, by.toLowerCase()],
  );
  if (!answer) return { sent: true };
  // Our letter, then the reply, as a mail app writes References; it answers the last.
  const thread = [reply.letterMessageId, reply.rfcMessageId]
    .filter((id): id is string => Boolean(id))
    .map((id) => `<${id}>`);
  let result: Awaited<ReturnType<typeof send>>;
  try {
    result = await send(
      {
        From: named(reply.fromName, reply.account),
        To: named(reply.toName || null, reply.to),
        Subject: answerSubject(reply.subject),
        TextBody: toText(doc),
        HtmlBody: toHtml(doc),
        Headers: thread.length
          ? [
              { Name: "In-Reply-To", Value: thread.at(-1)! },
              { Name: "References", Value: thread.join(" ") },
            ]
          : [],
      },
      "mailing-answer",
      reply.letterId,
      { backend: { name: "gmail", account: reply.account }, threadId: reply.threadId },
    );
  } catch (error) {
    // Nothing went (send never throws after it has): gone, so it can be sent again.
    await query("DELETE FROM letter_answers WHERE id = $1", [answer.id]);
    problem(emailCopy.problems.notSentYet(mailingsCopy.answers.answerTo(replyId)), error);
    return { sent: false, reason: "failed" };
  }
  if (!result.sent) {
    await query("DELETE FROM letter_answers WHERE id = $1", [answer.id]);
    return { sent: false, reason: result.reason };
  }
  await logChange(by, "answer letter reply", { replyId, letterId: reply.letterId, answerId: answer.id });
  try {
    const token = await gmailAccess(reply.account);
    await keepReply(reply.account, token, reply.letterId, await gmailMessageHeaders(token, result.id, KEPT_HEADERS), {
      fromUs: true,
    });
    await query(
      `UPDATE letter_answers a SET kept_id = r.id FROM letter_replies r
       WHERE a.id = $1 AND r.account = $2 AND r.gmail_message_id = $3`,
      [answer.id, reply.account, result.id],
    );
  } catch (error) {
    // It went, but isn't on the letter, so the reply still waits, and staff are told to check before sending again.
    problem(emailCopy.problems.sentUnrecorded(mailingsCopy.answers.answerTo(replyId)), error);
  }
  return { sent: true };
}
