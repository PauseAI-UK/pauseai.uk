import "server-only";
import { gzipSync } from "node:zlib";
import { decodeWords, fromAddress, messageIds } from "@/lib/email-parsing/mime";
import { query, transaction } from "./db";
import { sentBy } from "./email";
import { messageContent } from "./letter-threads";
import type { ReplyHandling } from "./letters";
import { deleteLetterReply, saveLetterReply } from "./outside-services/blobs";
import { gmailRawMessage, type GmailMessageHeaders } from "./outside-services/gmail";

// The messages in a letter's thread, kept whole (letter_replies, and the
// message in Netlify Blobs), whichever mailbox they're read from. A Gmail
// thread is kept in one place: once a message of it is on a letter, the rest
// of it is too, whoever wrote it, rather than kept as a one-off email
// (one-off-emails.ts).

/**
 * Postmark's own ID for an email it sent, from the email's Message-ID, which
 * is that ID at mtasv.net; null for any other.
 */
export function postmarkMessageId(rfc: string | null | undefined): string | null {
  return rfc?.toLowerCase().endsWith("@mtasv.net") ? rfc.slice(0, -"@mtasv.net".length) : null;
}

/**
 * The letter a message is in the thread of: one whose Message-ID it
 * answers, or that a kept message it answers belongs to; or, in the mailbox
 * the letter went from, one in the same Gmail thread.
 */
export async function letterAnswered(account: string, message: GmailMessageHeaders): Promise<number | undefined> {
  const refs = [...messageIds(message.headers.get("in-reply-to")), ...messageIds(message.headers.get("references"))];
  const [row] = await query<{ letterId: number }>(
    `SELECT letter_id::int AS "letterId" FROM (
       SELECT letter_id, 1 AS rank FROM email_sends WHERE (purpose = 'mailing' OR imported) AND rfc_message_id = ANY($1)
       UNION ALL SELECT letter_id, 2 FROM letter_replies WHERE rfc_message_id = ANY($1)
       UNION ALL SELECT letter_id, 3 FROM email_sends WHERE (purpose = 'mailing' OR imported) AND sender = $2 AND gmail_thread_id = $3
       UNION ALL SELECT letter_id, 4 FROM letter_replies WHERE account = $2 AND gmail_thread_id = $3
     ) found WHERE letter_id IS NOT NULL ORDER BY rank LIMIT 1`,
    [refs, account, message.threadId],
  );
  return row?.letterId;
}

/** What keepReply is told beyond the message, by a reader that knows more: see there. */
type KeepReplyOptions = { raw?: Buffer; from?: { address: string; name: string }; fromUs?: boolean };

/**
 * Keeps a message in a letter's thread whole, once, and marks the letter
 * replied to if the politician wrote it. `from` is who wrote it, if the From
 * says otherwise; `raw` the message, if it's been read already; `fromUs`
 * whether it's one of ours, by default if it's from the account. A supporter's
 * own message on their letter is kept as theirs, and doesn't mark it replied
 * to. A copy of a message the letter already has, by its Message-ID, as when
 * two mailboxes both got it, isn't kept again. Then the rest of its thread
 * comes to the letter (claimOneOffs).
 */
export async function keepReply(
  account: string,
  token: string,
  letterId: number,
  message: GmailMessageHeaders,
  {
    raw: read,
    from = fromAddress(message.headers.get("from")),
    fromUs = from.address === account,
  }: KeepReplyOptions = {},
): Promise<void> {
  const rfc = messageIds(message.headers.get("message-id"))[0] ?? null;
  if (await hasMessage(letterId, rfc)) return;
  const raw = read ?? (await gmailRawMessage(token, message.id));
  const at = new Date(Number(message.internalDate));
  const key = `${account}/${message.id}.eml.gz`;
  await saveLetterReply(key, gzipSync(raw));
  const supporter = await isSupporter(letterId, from.address);
  const [kept] = await query(
    `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address,
       from_name, subject, at, from_us, blob_key, size, from_supporter)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (account, gmail_message_id) DO NOTHING RETURNING id`,
    [
      letterId,
      account,
      message.id,
      message.threadId,
      rfc,
      from.address,
      from.name,
      message.headers.get("subject") ?? "",
      at,
      fromUs,
      key,
      raw.length,
      supporter,
    ],
  );
  if (kept && !fromUs) {
    await noteReplied(letterId, at, supporter, {
      from: from.address,
      name: from.name,
      ...addressed(message),
      gmailMessageId: message.id,
      // What received it, as every email's event says (sentBy in email.ts).
      ...sentBy({ name: "gmail", account }),
    });
  }
  await claimOneOffs(letterId);
}

/** Whether a letter already has a message, by its Message-ID. */
export async function hasMessage(letterId: number, rfc: string | null): Promise<boolean> {
  if (!rfc) return false;
  const [row] = await query("SELECT 1 FROM letter_replies WHERE letter_id = $1 AND rfc_message_id = $2", [
    letterId,
    rfc,
  ]);
  return !!row;
}

/** Whether an address is the supporter's who wrote a letter: their form entry's, or their proxy's. */
export async function isSupporter(letterId: number, address: string): Promise<boolean> {
  const [row] = await query(
    `SELECT 1 FROM letters_from_supporters s
       LEFT JOIN form_entries f ON f.id = s.entry_id LEFT JOIN proxies p ON p.id = s.proxy_id
     WHERE s.id = $1 AND $2 IN (lower(f.email), p.supporter_email)`,
    [letterId, address],
  );
  return !!row;
}

/**
 * Adds a message's 'replied' event to its letter, and marks the letter
 * replied to as of its first, unless the supporter wrote it: their own
 * message on their letter isn't an answer to it.
 */
async function noteReplied(letterId: number, at: Date, supporter: boolean, details: object): Promise<void> {
  if (!supporter) await query("UPDATE letters SET replied_at = coalesce(replied_at, $2) WHERE id = $1", [letterId, at]);
  await query("INSERT INTO letter_events (letter_id, at, status, details) VALUES ($1, $2, 'replied', $3)", [
    letterId,
    at,
    JSON.stringify(details),
  ]);
}

/**
 * Who a message read from Gmail was to, copied to and asked replies to go
 * to, a line each as it came, and that it went no further: it's already in
 * the mailbox, for whoever reads it.
 */
export function addressed(message: GmailMessageHeaders) {
  const handling: ReplyHandling[] = [{ outcome: "not_forwarded", reason: "gmail" }];
  const line = (name: string) => {
    const value = message.headers.get(name);
    return value === undefined ? undefined : decodeWords(value);
  };
  return { to: line("to"), cc: line("cc"), replyTo: line("reply-to"), handling };
}

/**
 * Notes an automatic reply on its letter, once, as of when it arrived. Says
 * whether it did. The message is locked while it's looked for, as both a read
 * of Gmail and the import of old letters may come to it at once.
 */
export function noteAutoReply(letterId: number, message: GmailMessageHeaders): Promise<boolean> {
  return transaction(async (db) => {
    await query("SELECT pg_advisory_xact_lock(hashtext($1))", [`auto-reply ${message.id}`], db);
    const [seen] = await query(
      "SELECT 1 FROM letter_events WHERE letter_id = $1 AND status = 'auto_reply' AND details->>'gmailMessageId' = $2",
      [letterId, message.id],
      db,
    );
    if (seen) return false;
    await query(
      "INSERT INTO letter_events (letter_id, at, status, details) VALUES ($1, $2, 'auto_reply', $3)",
      [
        letterId,
        new Date(Number(message.internalDate)),
        JSON.stringify({
          from: fromAddress(message.headers.get("from")).address,
          ...addressed(message),
          gmailMessageId: message.id,
        }),
      ],
      db,
    );
    return true;
  });
}

/** A one-off message that's in a letter's thread, to move onto the letter. */
type Claimed = {
  id: number;
  threadId: number;
  account: string;
  gmailMessageId: string;
  gmailThreadId: string;
  rfc: string | null;
  fromAddress: string;
  fromName: string;
  toLine: string;
  ccLine: string;
  subject: string;
  at: Date;
  fromUs: boolean;
  blobKey: string;
  size: number;
};

/**
 * The one-off threads in a letter's thread, in SQL, for `$1`'s letter: any
 * with a message in a Gmail thread of the letter's, in the mailbox that has
 * it, or answering a message the letter has or an email it went as, or a
 * copy of a message it has. Migration 0096 moved those kept before this by
 * the same rule.
 */
const CLAIMED_THREADS = `
  SELECT DISTINCT m.thread_id FROM one_off_messages m
  WHERE EXISTS (
      SELECT 1 FROM letter_replies r WHERE r.letter_id = $1
        AND ((r.account = m.account AND r.gmail_thread_id = m.gmail_thread_id)
          OR r.rfc_message_id = ANY(m.in_reply_to) OR r.rfc_message_id = m.rfc_message_id))
    OR EXISTS (
      SELECT 1 FROM email_sends e WHERE e.letter_id = $1
        AND ((e.sender = m.account AND e.gmail_thread_id = m.gmail_thread_id)
          OR e.rfc_message_id = ANY(m.in_reply_to)
          OR (e.backend = 'postmark' AND e.message_id || '@mtasv.net' = ANY(m.in_reply_to))))`;

/**
 * Moves the one-off threads in a letter's thread onto the letter, so a Gmail
 * thread is in one place. Moving adds nothing to the letter's history, which
 * says what arrived when it arrived, but for an automatic reply's note, which
 * marks it as one on the letter's page. A copy of a message the letter has
 * goes, with its blob. Each message moves in one transaction, which takes it
 * first, so two runs at once move it once, and one left by a run that stopped
 * moves next time. Says how many moved.
 */
export async function claimOneOffs(letterId: number): Promise<number> {
  const claimed = await query<Claimed>(
    `SELECT id::int AS id, thread_id::int AS "threadId", account, gmail_message_id AS "gmailMessageId",
       gmail_thread_id AS "gmailThreadId", rfc_message_id AS rfc, from_address AS "fromAddress", from_name AS "fromName",
       to_line AS "toLine", cc_line AS "ccLine", subject, at, from_us AS "fromUs", blob_key AS "blobKey", size
     FROM one_off_messages WHERE thread_id IN (${CLAIMED_THREADS}) ORDER BY at, id`,
    [letterId],
  );
  let moved = 0;
  for (const message of claimed) {
    const { auto } = await messageContent(message.blobKey);
    const supporter = await isSupporter(letterId, message.fromAddress);
    const outcome = await transaction(async (db): Promise<"moved" | "copy" | "gone"> => {
      const [taken] = await query("DELETE FROM one_off_messages WHERE id = $1 RETURNING id", [message.id], db);
      if (!taken) return "gone";
      if (message.rfc) {
        const [copy] = await query(
          "SELECT 1 FROM letter_replies WHERE letter_id = $1 AND rfc_message_id = $2",
          [letterId, message.rfc],
          db,
        );
        if (copy) return "copy";
      }
      const [kept] = await query(
        `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address,
           from_name, subject, at, from_us, blob_key, size, from_supporter)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (account, gmail_message_id) DO NOTHING RETURNING id`,
        [
          letterId,
          message.account,
          message.gmailMessageId,
          message.gmailThreadId,
          message.rfc,
          message.fromAddress,
          message.fromName,
          message.subject,
          message.at,
          message.fromUs,
          message.blobKey,
          message.size,
          supporter,
        ],
        db,
      );
      // The same Gmail message is on the letter already.
      if (!kept) return "copy";
      if (auto) {
        const details = {
          from: message.fromAddress,
          to: message.toLine || undefined,
          cc: message.ccLine || undefined,
          handling: [{ outcome: "not_forwarded", reason: "gmail" }] satisfies ReplyHandling[],
          gmailMessageId: message.gmailMessageId,
        };
        await query(
          "INSERT INTO letter_events (letter_id, at, status, details) VALUES ($1, $2, 'auto_reply', $3)",
          [letterId, message.at, JSON.stringify(details)],
          db,
        );
      }
      return "moved";
    });
    if (outcome === "moved") moved++;
    // A copy's blob goes, unless a message on a letter is kept under the same key.
    if (outcome === "copy") {
      const [used] = await query("SELECT 1 FROM letter_replies WHERE blob_key = $1", [message.blobKey]);
      if (!used) await deleteLetterReply(message.blobKey);
    }
  }
  const threads = [...new Set(claimed.map((message) => message.threadId))];
  await query(
    `DELETE FROM one_off_threads t WHERE t.id = ANY($1::bigint[])
       AND NOT EXISTS (SELECT 1 FROM one_off_messages m WHERE m.thread_id = t.id)`,
    [threads],
  );
  return moved;
}
