import "server-only";
import { gunzipSync } from "node:zlib";
import { firstOfType, decodeWords, parseMime, wholeTextOf } from "@/lib/email-parsing/mime.server";
import { replyParts } from "@/lib/email-parsing/reply-text";
import type { LetterDoc } from "./format";
import { isMachineReply } from "@/lib/email-parsing/subjects";
import { query } from "@/lib/server/db.server";
import { letterReply } from "@/lib/server/outside-services/blobs.server";

// The thread of one of PauseAI's letters, for staff, below what its page
// says of it (records.server.ts): each message after the letter, read from
// Gmail (letter_replies), the politician's replies and our answers, oldest
// first. A mailing's letter, as it went, is rebuilt from the mailing
// (lib/mailings/letter-thread.server.ts).

/** A later message in a letter's thread, with its text. */
export type ThreadMessage = {
  id: number;
  at: Date;
  fromName: string;
  fromAddress: string;
  /** Our answer, rather than their reply. */
  fromUs: boolean;
  /** For a supporter's letter, the supporter's own message through their MP's proxy, rather than the office's. */
  fromSupporter: boolean;
  /** An automatic reply, such as an office's acknowledgement or an out-of-office, as reading it noted. */
  auto: boolean;
  subject: string;
  /** Its plain text, or its HTML's text, without the mail it quotes or its footer; null if the kept message can't be read. */
  text: string | null;
  /** The mail it quotes and its footer, folded under its text; empty if none or the kept message can't be read. */
  quoted: string;
  /** Who it was copied to, as its Cc said; null if nobody, or the kept message can't be read. */
  cc: string | null;
};

/** One of PauseAI's letters and its thread: the letter as it went, rebuilt from its mailing (lib/mailings/letter-thread.server.ts), and each message after. */
export type LetterThread = {
  mailingTitle: string;
  subject: string;
  /** Whom it went to, and when. */
  to: { name: string; email: string | null };
  sentAt: Date | null;
  /** The letter as it went; null for one imported, whose text we don't have. */
  letter: LetterDoc | null;
  /** The letter's text is rebuilt from replies quoting others like it, not what they received. */
  approximate: boolean;
  /** The account it went from and the name it was from, and its Gmail thread if Gmail sent it. */
  sentFrom: string | null;
  fromName: string | null;
  gmailThreadId: string | null;
  messages: ThreadMessage[];
};

/**
 * A kept message's text and, apart, the mail it quotes and its footer: from
 * its plain text if it has one, else its HTML's; its text null if it has
 * neither. Whom it was copied to, as its Cc said, or null. And whether a
 * machine sent it, by its headers and subject. Its whole text, quotes and
 * all, null as its text is. Null, empty and false if it's gone.
 */
export async function messageContent(
  blobKey: string,
): Promise<{ text: string | null; quoted: string; cc: string | null; auto: boolean; whole: string | null }> {
  const gzipped = await letterReply(blobKey);
  if (!gzipped) return { text: null, quoted: "", cc: null, auto: false, whole: null };
  const message = parseMime(gunzipSync(gzipped).toString("latin1"));
  const cc = message.headers.get("cc");
  const whole = firstOfType(message, "text/plain") || firstOfType(message, "text/html") ? wholeTextOf(message) : null;
  const parts = whole === null ? { text: null, quoted: "" } : replyParts(whole);
  const auto = isMachineReply((name) => message.headers.get(name), decodeWords(message.headers.get("subject") ?? ""));
  return { ...parts, cc: cc ? decodeWords(cc) : null, auto, whole };
}

/** Each message kept in a letter's thread, oldest first, with its text. */
export async function threadMessages(letterId: number): Promise<ThreadMessage[]> {
  const replies = await query<Omit<ThreadMessage, "text" | "cc"> & { blobKey: string }>(
    `SELECT id::int AS id, at, from_name AS "fromName", from_address AS "fromAddress", from_us AS "fromUs",
       from_supporter AS "fromSupporter", subject, blob_key AS "blobKey",
       EXISTS (SELECT 1 FROM letter_events e WHERE e.letter_id = r.letter_id AND e.status = 'auto_reply'
         AND e.details->>'gmailMessageId' = r.gmail_message_id) AS auto
     FROM letter_replies r WHERE letter_id = $1 ORDER BY at, id`,
    [letterId],
  );
  return Promise.all(
    replies.map(async ({ blobKey, ...reply }) => {
      const { text, quoted, cc } = await messageContent(blobKey);
      return { ...reply, text, quoted, cc };
    }),
  );
}
