import "server-only";
import { named } from "@/lib/email-parsing/addresses";
import { answerSubject } from "@/lib/email-parsing/subjects";
import { checkDoc, isBlank, toHtml, toText, type LetterDoc } from "@/lib/letter-format";
import { logChange } from "./audit";
import { problem } from "./problems";
import { staffCopy } from "@/lib/content/staff-interface";
import { now } from "@/lib/now";
import { textBackend } from "./broadcast-channels";
import { query, transaction } from "./db";
import { send } from "./email-sending";
import { sendText } from "./outside-services/whatsapp";

// Staff's answers to replies to broadcasts, written on the copy's Thread
// page (broadcast_answers). An answer to an email goes by Gmail from the
// mailbox the reply came to, as the broadcast's name, in the reply's thread
// there, naming the reply and our email (In-Reply-To, References), so it's
// in that mailbox's Sent and the person's conversation. Reading the mailbox
// skips it (gmail-reading.ts, isOurs), and a reply to it joins the copy's
// thread (broadcast-replies.ts, copyAnswered). An answer to a text goes by
// WhatsApp, as words of our own, which it takes only within a day of the
// person's message; a reply to it joins the copy's thread too
// (whatsapp-webhooks.ts). Sending one settles the reply, unless it was
// recorded as an opt-out.

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

/**
 * What became of an answer: sent; or not, as it had no words, the reply's
 * gone, the address is blocked, Gmail or WhatsApp failed, or it's more than
 * a day since a reply to a text, when WhatsApp takes no words of ours.
 */
export type AnswerResult = { sent: true } | { sent: false; reason: "blank" | "gone" | "blocked" | "failed" | "window" };

/**
 * Sends staff member `by`'s answer, `body`, to reply `replyId`, once for
 * each `draftId`: a second press of Send finds it sent, or sending. One that
 * fails is forgotten, so it can be sent again. Sent, it settles the reply as
 * answered, unless it's an opt-out.
 */
/** A reply to answer, as kept: for an email, the Gmail thread it's in; for a text, when it came. */
type Answering = {
  account: string | null;
  to: string;
  subject: string;
  threadId: string | null;
  rfcMessageId: string | null;
  copyMessageId: string | null;
  fromName: string | null;
  toName: string | null;
  text: boolean;
  receivedAt: Date;
};

/** What became of an answer's send: its IDs, if it went. */
type AnswerSend =
  | { sent: true; gmailId: string | null; rfcMessageId?: string | null; providerId: string | null }
  | { sent: false; reason: "blocked" | "failed" };

/**
 * Sends an answer to a reply to an email by Gmail, from the mailbox it came
 * to, as the broadcast's name, in the reply's thread there, naming the reply
 * and our email.
 */
async function emailAnswer(reply: Answering, doc: LetterDoc): Promise<AnswerSend> {
  // Our email, then the reply, as a mail app writes References; it answers the last.
  const thread = [reply.copyMessageId, reply.rfcMessageId]
    .filter((id): id is string => Boolean(id))
    .map((id) => `<${id}>`);
  const result = await send(
    {
      From: named(reply.fromName, reply.account!),
      // Their name, as the copy to them had it, when it's from the address the copy went to.
      To: named(reply.toName, reply.to),
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
    { backend: { name: "gmail", account: reply.account! }, threadId: reply.threadId! },
  );
  return result.sent
    ? { sent: true, gmailId: result.id, rfcMessageId: result.messageId, providerId: null }
    : { sent: false, reason: result.reason };
}

/** Sends an answer to a reply to a text by WhatsApp, as words of our own. */
async function textAnswer(reply: Answering, doc: LetterDoc): Promise<AnswerSend> {
  const backend = await textBackend();
  if (!backend) return { sent: false, reason: "failed" };
  const result = await sendText(backend.keys, backend.number.id, reply.to, toText(doc));
  return result.sent ? { sent: true, gmailId: null, providerId: result.id } : { sent: false, reason: "failed" };
}

/** How long after someone's last message WhatsApp takes words of our own to them. */
const WINDOW_HOURS = 24;

/** Whether WhatsApp still takes an answer to a reply to a text that came at `receivedAt`: within a day of it. */
export function inWindow(receivedAt: Date): boolean {
  return now().getTime() - receivedAt.getTime() < WINDOW_HOURS * 60 * 60 * 1000;
}

export async function answerReply(replyId: number, draftId: string, body: unknown, by: string): Promise<AnswerResult> {
  const doc = checkDoc(body);
  if (!doc || isBlank(doc)) return { sent: false, reason: "blank" };
  const [reply] = await query<Answering>(
    `SELECT r.account, r.from_address AS to, r.subject, r.gmail_thread_id AS "threadId",
       r.rfc_message_id AS "rfcMessageId", c.rfc_message_id AS "copyMessageId", m.from_name AS "fromName",
       CASE WHEN c.address = r.from_address THEN c.merge_values ->> 'name' END AS "toName",
       r.provider_message_id IS NOT NULL AS text, r.received_at AS "receivedAt"
     FROM broadcast_replies r JOIN broadcast_messages c ON c.id = r.message_id JOIN mailings m ON m.id = c.mailing_id
     WHERE r.id = $1 AND NOT r.automatic`,
    [replyId],
  );
  if (!reply) return { sent: false, reason: "gone" };
  if (reply.text && !inWindow(reply.receivedAt)) return { sent: false, reason: "window" };
  const [answer] = await query<{ id: number }>(
    `INSERT INTO broadcast_answers (reply_id, draft_id, sent_by, body, status) VALUES ($1, $2, $3, $4, 'sending')
     ON CONFLICT (draft_id) DO NOTHING RETURNING id::int AS id`,
    [replyId, draftId, by.toLowerCase(), JSON.stringify(doc)],
  );
  if (!answer) return { sent: true };
  const words = staffCopy.problems.anywhere;
  let result: AnswerSend;
  try {
    result = await (reply.text ? textAnswer : emailAnswer)(reply, doc);
  } catch (error) {
    // Nothing went (send never throws after it has): gone, so it can be sent again.
    await query("DELETE FROM broadcast_answers WHERE id = $1", [answer.id]);
    problem(words.notSentYet(words.answerTo(replyId)), error);
    return { sent: false, reason: "failed" };
  }
  if (!result.sent) {
    await query("DELETE FROM broadcast_answers WHERE id = $1", [answer.id]);
    return { sent: false, reason: result.reason };
  }
  const { gmailId, rfcMessageId, providerId } = result;
  try {
    await transaction(async (db) => {
      await query(
        `UPDATE broadcast_answers SET status = 'sent', sent_at = now(), gmail_message_id = $2, rfc_message_id = $3,
           provider_message_id = $4
         WHERE id = $1`,
        [answer.id, gmailId, rfcMessageId, providerId],
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
  } catch (error) {
    // It went: left sending, as its page says, never sent twice.
    problem(words.sentUnrecorded(words.answerTo(replyId)), error);
  }
  return { sent: true };
}
