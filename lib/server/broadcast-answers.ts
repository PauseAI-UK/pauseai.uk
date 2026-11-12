import "server-only";
import { named } from "@/lib/email-parsing/addresses";
import { answerSubject } from "@/lib/email-parsing/subjects";
import { checkDoc, isBlank, toHtml, toText, type LetterDoc } from "@/lib/letter-format";
import { logChange } from "./audit";
import { query, transaction } from "./db";
import { send } from "./email";

// Staff's answers to replies to email broadcasts, written on the copy's
// Thread page (broadcast_answers). Each goes by Gmail from the mailbox the
// reply came to, as the broadcast's name, in the reply's thread there, naming
// the reply and our email (In-Reply-To, References), so it's in that
// mailbox's Sent and the person's conversation. Sending one settles the
// reply, unless it was recorded as an opt-out. Reading the mailbox skips it
// (gmail-reading.ts, isOurs), and a reply to it joins the copy's thread
// (broadcast-replies.ts, copyAnswered).

/** Where an answer is: recorded before it goes, and sent once Gmail has it. */
export type AnswerStatus = "sending" | "sent";

/** An answer sent to a reply, or being sent, as its Thread page shows it. */
export type BroadcastAnswer = {
  id: number;
  replyId: number;
  sentBy: string;
  /** When it went; null while it's being sent, or if the run sending it stopped. */
  sentAt: Date | null;
  body: LetterDoc;
};

/** The answers to a copy's replies, oldest first. */
export async function answersTo(copyId: number): Promise<BroadcastAnswer[]> {
  const rows = await query<Omit<BroadcastAnswer, "body"> & { body: unknown }>(
    `SELECT a.id::int AS id, a.reply_id::int AS "replyId", a.sent_by AS "sentBy", a.sent_at AS "sentAt", a.body
     FROM broadcast_answers a JOIN broadcast_replies r ON r.id = a.reply_id
     WHERE r.message_id = $1 ORDER BY a.created_at, a.id`,
    [copyId],
  );
  return rows.map((row) => ({ ...row, body: checkDoc(row.body)! }));
}

/** What became of an answer: sent; or not, as it had no words, the reply's gone, the address is blocked, or Gmail failed. */
export type AnswerResult = { sent: true } | { sent: false; reason: "blank" | "gone" | "blocked" | "failed" };

/**
 * Sends staff member `by`'s answer, `body`, to reply `replyId`, once for
 * each `draftId`: a second press of Send finds it sent, or sending. One that
 * fails is forgotten, so it can be sent again. Sent, it settles the reply as
 * answered, unless it's an opt-out.
 */
export async function answerReply(replyId: number, draftId: string, body: unknown, by: string): Promise<AnswerResult> {
  const doc = checkDoc(body);
  if (!doc || isBlank(doc)) return { sent: false, reason: "blank" };
  const [reply] = await query<{
    account: string;
    to: string;
    subject: string;
    threadId: string;
    rfcMessageId: string | null;
    copyMessageId: string | null;
    fromName: string | null;
  }>(
    `SELECT r.account, r.from_address AS to, r.subject, r.gmail_thread_id AS "threadId",
       r.rfc_message_id AS "rfcMessageId", c.rfc_message_id AS "copyMessageId", m.from_name AS "fromName"
     FROM broadcast_replies r JOIN broadcast_messages c ON c.id = r.message_id JOIN mailings m ON m.id = c.mailing_id
     WHERE r.id = $1 AND NOT r.automatic`,
    [replyId],
  );
  if (!reply) return { sent: false, reason: "gone" };
  const [answer] = await query<{ id: number }>(
    `INSERT INTO broadcast_answers (reply_id, draft_id, sent_by, body, status) VALUES ($1, $2, $3, $4, 'sending')
     ON CONFLICT (draft_id) DO NOTHING RETURNING id::int AS id`,
    [replyId, draftId, by.toLowerCase(), JSON.stringify(doc)],
  );
  if (!answer) return { sent: true };
  // Our email, then the reply, as a mail app writes References; it answers the last.
  const thread = [reply.copyMessageId, reply.rfcMessageId]
    .filter((id): id is string => Boolean(id))
    .map((id) => `<${id}>`);
  const result = await send(
    {
      From: named(reply.fromName, reply.account),
      To: reply.to,
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
    "broadcast-answer",
    null,
    { backend: { name: "gmail", account: reply.account }, threadId: reply.threadId },
  );
  if (!result.sent) {
    await query("DELETE FROM broadcast_answers WHERE id = $1", [answer.id]);
    return { sent: false, reason: result.reason };
  }
  await transaction(async (db) => {
    await query(
      `UPDATE broadcast_answers SET status = 'sent', sent_at = now(), gmail_message_id = $2, rfc_message_id = $3
       WHERE id = $1`,
      [answer.id, result.id, result.messageId],
      db,
    );
    await query(
      `UPDATE broadcast_replies SET outcome = 'answered', dealt_by = $2, dealt_at = now()
       WHERE id = $1 AND outcome IS DISTINCT FROM 'opted-out'`,
      [replyId, by.toLowerCase()],
      db,
    );
    await logChange(by, "answer reply", { replyId, answerId: answer.id }, db);
  });
  return { sent: true };
}
