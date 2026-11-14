import "server-only";
import { gzipSync } from "node:zlib";
import { hasWay, TOPICS, type Topic, type Way } from "@/lib/supporters/contact-permissions";
import { inWindow } from "./answers.server";
import { fromAddress, messageIds } from "@/lib/email-parsing/mime.server";
import { isMachineReply } from "@/lib/email-parsing/subjects";
import { logChange } from "@/lib/server/audit.server";
import { query, transaction } from "@/lib/server/db.server";
import { messageContent } from "@/lib/letters/threads.server";
import { offCalendarAfter } from "@/lib/supporters/email-settings.server";
import { recordStaffOptOut, type CalendarOptOut, type OptOutList } from "@/lib/supporters/opt-outs.server";
import { saveLetterReply } from "@/lib/server/outside-services/blobs.server";
import { gmailRawMessage, type GmailMessageHeaders } from "@/lib/server/outside-services/gmail.server";

// Replies to copies of broadcasts, read from the Gmail inbox each went from,
// such as hello@pauseai.uk's: matched to the copy by the Message-ID it went
// with, before anything else in the mailbox sees them, and kept whole, the
// message in Netlify Blobs as letters' replies are (broadcast_replies). A
// person's reply waits for staff, who record it as an opt-out, of what the
// copy went under or of every bulk email, or as nothing to do, or answer it
// (broadcast-answers.server.ts); an automatic one never waits.

/**
 * The copy of a broadcast a message answers, by the Message-IDs it names:
 * the copy's, or that of our answer to a reply to it, so a reply to our
 * answer joins the same thread; undefined for none.
 */
export async function copyAnswered(message: GmailMessageHeaders): Promise<number | undefined> {
  const ids = [...messageIds(message.headers.get("in-reply-to")), ...messageIds(message.headers.get("references"))];
  if (ids.length === 0) return undefined;
  const [copy] = await query<{ id: number }>(
    `SELECT id::int AS id FROM broadcast_messages WHERE rfc_message_id = ANY($1::text[])
     UNION ALL
     SELECT r.message_id::int FROM broadcast_answers a JOIN broadcast_replies r ON r.id = a.reply_id
     WHERE a.rfc_message_id = ANY($1::text[])
     ORDER BY id LIMIT 1`,
    [ids],
  );
  return copy?.id;
}

/**
 * Keeps a reply to a copy, once, whole, with whether a machine sent it: a
 * person's is in the copy's history too. Says which it was, or that it was
 * kept already.
 */
export async function keepBroadcastReply(
  account: string,
  token: string,
  copyId: number,
  message: GmailMessageHeaders,
): Promise<"reply" | "automatic" | "already"> {
  const [kept] = await query("SELECT 1 FROM broadcast_replies WHERE gmail_message_id = $1", [message.id]);
  if (kept) return "already";
  const raw = await gmailRawMessage(token, message.id);
  const key = `${account}/${message.id}.eml.gz`;
  await saveLetterReply(key, gzipSync(raw));
  const automatic = isMachineReply((name) => message.headers.get(name), message.headers.get("subject") ?? "");
  const at = new Date(Number(message.internalDate));
  await transaction(async (db) => {
    await query(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, account, gmail_message_id,
         gmail_thread_id, rfc_message_id, blob_key, automatic)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (gmail_message_id) DO NOTHING`,
      [
        copyId,
        at,
        fromAddress(message.headers.get("from")).address,
        message.headers.get("subject") ?? "",
        account,
        message.id,
        message.threadId,
        messageIds(message.headers.get("message-id"))[0] ?? null,
        key,
        automatic,
      ],
      db,
    );
    if (!automatic) {
      await query(
        "INSERT INTO broadcast_message_events (message_id, kind, at) VALUES ($1, 'replied', $2)",
        [copyId, at],
        db,
      );
    }
  });
  return automatic ? "automatic" : "reply";
}

/** A reply to a copy, as its Thread page shows it. */
export type BroadcastReply = {
  id: number;
  receivedAt: Date;
  from: string;
  subject: string;
  /** Its words, without the mail it quotes; null if it has none we can read. */
  text: string | null;
  automatic: boolean;
  /** What staff made of it, by whom and when; null while it waits, and for an automatic reply, which never does. */
  outcome: "opted-out" | "nothing" | "answered" | null;
  dealtBy: string | null;
  dealtAt: Date | null;
  /** Whether its sender has "Do not email", which an answer to them still goes despite, as it answers what they wrote. */
  doNotEmail: boolean;
  /** Whether it can be answered now: an email's always can; a text's only within a day, as WhatsApp allows. */
  answerable: boolean;
};

/** The replies to a copy, oldest first: an email's words from the message kept whole, a text's as kept. */
export async function repliesTo(copyId: number): Promise<BroadcastReply[]> {
  const rows = await query<
    Omit<BroadcastReply, "text" | "answerable"> & { blobKey: string | null; body: string | null }
  >(
    `SELECT id::int AS id, received_at AS "receivedAt", from_address AS from, subject, automatic, outcome,
       dealt_by AS "dealtBy", dealt_at AS "dealtAt", blob_key AS "blobKey", body,
       EXISTS (SELECT 1 FROM contact_permission('newsletter', 'email', from_address) d WHERE d.reason = 'do-not-email')
         AS "doNotEmail"
     FROM broadcast_replies WHERE message_id = $1 ORDER BY received_at, id`,
    [copyId],
  );
  return Promise.all(
    rows.map(async ({ blobKey, body, ...reply }) =>
      blobKey
        ? { ...reply, text: (await messageContent(blobKey)).text, answerable: true }
        : { ...reply, text: body, answerable: inWindow(reply.receivedAt) },
    ),
  );
}

/** What staff can record a reply as: an opt-out of what its copy went under, or of every bulk email; or nothing to do. */
export type ReplyDecision = "topics" | "bulk" | "nothing";

/**
 * Records what staff made of a reply waiting for them: an opt-out, as the
 * person asking to stop is one, recorded for them, of what the copy went
 * under or of every bulk email, at the copy's address, which takes them off
 * our Luma calendar too when it's of events or every bulk email; or nothing
 * to do. One answered can still be recorded as an opt-out. Says whether it
 * was waiting, or answered for an opt-out.
 */
export async function dealWithReply(replyId: number, decision: ReplyDecision, by: string): Promise<boolean> {
  const recorded: CalendarOptOut[] = [];
  const waiting = await transaction(async (db) => {
    const [reply] = await query<{ copyId: number; address: string | null; topics: Topic[]; text: boolean }>(
      `SELECT r.message_id::int AS "copyId", c.address, c.topics, m.channel = 'text' AS text FROM broadcast_replies r
       JOIN broadcast_messages c ON c.id = r.message_id JOIN mailings m ON m.id = c.mailing_id
       WHERE r.id = $1 AND (r.outcome IS NULL OR (r.outcome = 'answered' AND $2)) AND NOT r.automatic
       FOR UPDATE OF r`,
      [replyId, decision !== "nothing"],
      db,
    );
    if (!reply) return false;
    const outcome = decision === "nothing" ? "nothing" : "opted-out";
    if (decision !== "nothing" && reply.address) {
      // By text, "bulk" is every text: each topic a text goes under.
      const every: OptOutList[] = reply.text ? TOPICS.filter((topic) => hasWay(topic, "text")) : ["bulk"];
      const lists = decision === "bulk" ? every : reply.topics;
      const way: Way = reply.text ? "text" : "email";
      for (const list of lists) {
        await recordStaffOptOut({ address: reply.address, way, list }, by, { replyId, messageId: reply.copyId }, db);
      }
      recorded.push(...lists.map((list) => ({ address: reply.address!, list, way, source: "reply" as const })));
    }
    await query(
      "UPDATE broadcast_replies SET outcome = $2, dealt_by = $3, dealt_at = now() WHERE id = $1",
      [replyId, outcome, by.toLowerCase()],
      db,
    );
    await logChange(by, "deal with reply", { replyId, outcome }, db);
    return true;
  });
  await offCalendarAfter(recorded);
  return waiting;
}

/** How many replies wait for staff, for the staff home. */
export async function repliesWaiting(): Promise<number> {
  const [{ n }] = await query<{ n: number }>(
    "SELECT count(*)::int AS n FROM broadcast_replies WHERE outcome IS NULL AND NOT automatic",
  );
  return n;
}
