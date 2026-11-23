import "server-only";
import { named } from "@/lib/email-parsing/addresses";
import { answerSubject } from "@/lib/email-parsing/subjects";
import { checkDoc, docFromText, isBlank, toHtml, toText, type LetterDoc } from "@/lib/letters/format";
import { messageText } from "@/lib/letters/threads.server";
import { gmailRawMessage, type GmailMessageHeaders } from "@/lib/server/outside-services/gmail.server";
import { messageIds } from "@/lib/email-parsing/mime.server";
import { randomUUID } from "node:crypto";
import { logChange } from "@/lib/server/audit.server";
import { problem } from "@/lib/server/problems.server";
import { broadcastsCopy } from "./copy";
import { now } from "@/lib/now";
import { textBackend } from "./channels.server";
import { query, transaction, type Queryable } from "@/lib/server/db.server";
import { send } from "@/lib/email/sending.server";
import { sendReaction, sendText } from "@/lib/server/outside-services/whatsapp.server";
import { REACTION_DAYS, REACTIONS } from "./broadcasts";
import { emailCopy } from "@/lib/email/copy";
import type { AnswerResult } from "@/lib/mailings/answers";

// Staff's answers to replies to broadcasts, written on the copy's Thread
// page (broadcast_answers). An answer to an email goes by Gmail from the
// mailbox the reply came to, as the broadcast's name, in the reply's thread
// there, naming the reply and our email (In-Reply-To, References), so it's
// in that mailbox's Sent and the person's conversation. Reading the mailbox
// skips it (gmail-reading.server.ts, isOurs), and a reply to it joins the copy's
// thread (broadcast-replies.server.ts, copyAnswered). An answer to a text goes by
// WhatsApp, as words of our own, which it takes only within a day of the
// person's message; a reply to it joins the copy's thread too
// (whatsapp-webhooks.server.ts). Sending one settles the reply, unless it was
// recorded as an opt-out; WhatsApp saying later it couldn't deliver one puts
// the reply back for staff (whatsapp-webhooks.server.ts). A staff member can
// answer in the mailbox's Gmail instead: reading the mailbox keeps that as an
// answer too (keepGmailAnswer).

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
  /** What sent it calls it, once it went: WhatsApp's message ID, or Gmail's. */
  providerId: string | null;
  /** Written in the mailbox's Gmail rather than on the site, so sent by the mailbox, as far as we know. */
  fromGmail: boolean;
  /** What WhatsApp said became of one to a text (delivered, read, failed), newest first; none for an email. */
  events: AnswerEvent[];
};

/** Something WhatsApp said became of our answer, with its why for a failure. */
export type AnswerEvent = { at: Date; kind: string; details: Record<string, unknown> };

/** An emoji staff put on a reply to a text, as its Thread page shows it, with what WhatsApp said became of it. */
export type BroadcastReaction = {
  id: number;
  replyId: number;
  emoji: string;
  sentBy: string;
  sentAt: Date;
  /** When we took it away, or put another in its place; null while it stands. */
  removedAt: Date | null;
  /** What WhatsApp said became of it: only ever failed, as it tells nothing else of a reaction. */
  events: AnswerEvent[];
};

/** Each of `rows` with what WhatsApp said became of it, newest first. */
async function withEvents<T extends { id: number }>(rows: T[]): Promise<(T & { events: AnswerEvent[] })[]> {
  const events = await query<AnswerEvent & { answerId: number }>(
    `SELECT answer_id::int AS "answerId", at, kind, details FROM broadcast_message_events
     WHERE answer_id = ANY($1::bigint[]) ORDER BY at DESC, id DESC`,
    [rows.map((row) => row.id)],
  );
  return rows.map((row) => ({
    ...row,
    events: events
      .filter((event) => event.answerId === row.id)
      .map((event) => ({ at: event.at, kind: event.kind, details: event.details })),
  }));
}

/** The answers in words to a copy's replies, oldest first. */
export async function answersTo(copyId: number): Promise<BroadcastAnswer[]> {
  const rows = await query<Omit<BroadcastAnswer, "body" | "events"> & { body: unknown }>(
    `SELECT a.id::int AS id, a.reply_id::int AS "replyId", a.sent_by AS "sentBy", a.sent_at AS "sentAt", a.body,
       coalesce(a.provider_message_id, a.gmail_message_id) AS "providerId", a.from_gmail AS "fromGmail"
     FROM broadcast_answers a JOIN broadcast_replies r ON r.id = a.reply_id
     WHERE r.message_id = $1 AND a.emoji IS NULL ORDER BY a.created_at, a.id`,
    [copyId],
  );
  return withEvents(rows.map((row) => ({ ...row, body: checkDoc(row.body)! })));
}

/** The emoji staff put on a copy's replies, oldest first. */
export async function reactionsTo(copyId: number): Promise<BroadcastReaction[]> {
  return withEvents(
    await query<Omit<BroadcastReaction, "events">>(
      `SELECT a.id::int AS id, a.reply_id::int AS "replyId", a.emoji, a.sent_by AS "sentBy", a.sent_at AS "sentAt",
         a.removed_at AS "removedAt"
       FROM broadcast_answers a JOIN broadcast_replies r ON r.id = a.reply_id
       WHERE r.message_id = $1 AND a.emoji IS NOT NULL ORDER BY a.created_at, a.id`,
      [copyId],
    ),
  );
}

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

/**
 * Settles, as `outcome`, the replies to the same copy before reply `replyId`
 * (in the thread's order, by when they came, then ID) still waiting for
 * staff, but the automatic ones: staff deal with a thread at its end, their
 * latest reply, which deals with what they said before it.
 */
export async function settleEarlier(
  replyId: number,
  outcome: "answered" | "nothing" | "opted-out",
  by: string,
  db: Queryable,
): Promise<void> {
  await query(
    `UPDATE broadcast_replies e SET outcome = $2, dealt_by = $3, dealt_at = now()
     FROM broadcast_replies r
     WHERE r.id = $1 AND e.message_id = r.message_id AND (e.received_at, e.id) < (r.received_at, r.id)
       AND e.outcome IS NULL AND NOT e.automatic`,
    [replyId, outcome, by.toLowerCase()],
    db,
  );
}

/**
 * Keeps, once, an answer a staff member wrote in mailbox `account`'s Gmail,
 * `message`, in the thread of copy `copyId`: its words without the mail it
 * quotes, sent by the mailbox, as an answer to the person's latest reply
 * before it. It settles that reply and those before it as answered, as an
 * answer from the site does, but one recorded already; a reply after it
 * waits. Says whether it kept it: not if it was kept already, or if nothing
 * of theirs came before it.
 */
export async function keepGmailAnswer(
  account: string,
  token: string,
  copyId: number,
  message: GmailMessageHeaders,
): Promise<boolean> {
  const at = new Date(Number(message.internalDate));
  const by = account.toLowerCase();
  const [reply] = await query<{ id: number }>(
    `SELECT id::int AS id FROM broadcast_replies WHERE message_id = $1 AND NOT automatic AND received_at <= $2
     ORDER BY received_at DESC, id DESC LIMIT 1`,
    [copyId, at],
  );
  if (!reply) return false;
  const [kept] = await query("SELECT 1 FROM broadcast_answers WHERE gmail_message_id = $1", [message.id]);
  if (kept) return false;
  const doc = docFromText(messageText(await gmailRawMessage(token, message.id)) ?? "");
  return transaction(async (db) => {
    const [answer] = await query<{ id: number }>(
      `INSERT INTO broadcast_answers (reply_id, draft_id, sent_by, body, status, created_at, sent_at, gmail_message_id,
         rfc_message_id, from_gmail)
       VALUES ($1, $2, $3, $4, 'sent', $5, $5, $6, $7, true) RETURNING id::int AS id`,
      [
        reply.id,
        randomUUID(),
        by,
        JSON.stringify(doc),
        at,
        message.id,
        messageIds(message.headers.get("message-id"))[0] ?? null,
      ],
      db,
    );
    await query(
      `UPDATE broadcast_replies SET outcome = 'answered', dealt_by = $2, dealt_at = now()
       WHERE id = $1 AND outcome IS NULL`,
      [reply.id, by],
      db,
    );
    await settleEarlier(reply.id, "answered", by, db);
    await logChange(by, "answer reply", { replyId: reply.id, answerId: answer.id }, db);
    return true;
  });
}

/** How long after someone's last message WhatsApp takes words of our own to them. */
export const REPLY_WINDOW_HOURS = 24;

/** Whether WhatsApp still takes an answer to a reply to a text that came at `receivedAt`: within a day of it. */
export function inWindow(receivedAt: Date): boolean {
  return now().getTime() - receivedAt.getTime() < REPLY_WINDOW_HOURS * 60 * 60 * 1000;
}

/** Whether WhatsApp still delivers an emoji on a message that came at `receivedAt`: within REACTION_DAYS of it. */
export function inReactionWindow(receivedAt: Date): boolean {
  return now().getTime() - receivedAt.getTime() < REACTION_DAYS * 24 * 60 * 60 * 1000;
}

/** What became of an emoji put on a reply: sent; or not, as the reply's gone or can't take one, or WhatsApp failed. */
export type ReactionResult = { sent: true } | { sent: false; reason: "gone" | "failed" };

/**
 * Puts staff member `by`'s `emoji`, one of REACTIONS, on reply `replyId`, a
 * person's message to us on WhatsApp, in place of any we put there before;
 * an empty one takes ours away. Only on words or more of theirs, not a
 * reaction, within REACTION_DAYS. Sent, an emoji settles the reply and those
 * before it as answered, as an answer does, unless it was an opt-out; taking
 * it away leaves the reply as it is.
 */
export async function reactToReply(replyId: number, emoji: string, by: string): Promise<ReactionResult> {
  if (emoji !== "" && !(REACTIONS as readonly string[]).includes(emoji)) return { sent: false, reason: "gone" };
  const [reply] = await query<{ to: string; providerId: string; receivedAt: Date }>(
    `SELECT from_address AS to, provider_message_id AS "providerId", received_at AS "receivedAt" FROM broadcast_replies
     WHERE id = $1 AND provider_message_id IS NOT NULL AND kind IS DISTINCT FROM 'reaction' AND NOT automatic`,
    [replyId],
  );
  if (!reply || !inReactionWindow(reply.receivedAt)) return { sent: false, reason: "gone" };
  const backend = await textBackend();
  if (!backend) return { sent: false, reason: "failed" };
  const result = await sendReaction(backend.keys, backend.number.id, reply.to, reply.providerId, emoji);
  if (!result.sent) return { sent: false, reason: "failed" };
  await transaction(async (db) => {
    await query(
      "UPDATE broadcast_answers SET removed_at = now() WHERE reply_id = $1 AND emoji IS NOT NULL AND removed_at IS NULL",
      [replyId],
      db,
    );
    if (emoji) {
      await query(
        `INSERT INTO broadcast_answers (reply_id, draft_id, sent_by, emoji, status, sent_at, provider_message_id)
         VALUES ($1, $2, $3, $4, 'sent', now(), $5)`,
        [replyId, randomUUID(), by.toLowerCase(), emoji, result.id],
        db,
      );
      await query(
        `UPDATE broadcast_replies SET outcome = 'answered', dealt_by = $2, dealt_at = now()
         WHERE id = $1 AND outcome IS DISTINCT FROM 'opted-out'`,
        [replyId, by.toLowerCase()],
        db,
      );
      await settleEarlier(replyId, "answered", by, db);
    }
    await logChange(by, "react to reply", { replyId, emoji }, db);
  });
  return { sent: true };
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
  const words = emailCopy.problems;
  let result: AnswerSend;
  try {
    result = await (reply.text ? textAnswer : emailAnswer)(reply, doc);
  } catch (error) {
    // Nothing went (send never throws after it has): gone, so it can be sent again.
    await query("DELETE FROM broadcast_answers WHERE id = $1", [answer.id]);
    problem(words.notSentYet(broadcastsCopy.problems.answerTo(replyId)), error);
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
      await settleEarlier(replyId, "answered", by, db);
      await logChange(by, "answer reply", { replyId, answerId: answer.id }, db);
    });
  } catch (error) {
    // It went: left sending, as its page says, never sent twice.
    problem(words.sentUnrecorded(broadcastsCopy.problems.answerTo(replyId)), error);
  }
  return { sent: true };
}
