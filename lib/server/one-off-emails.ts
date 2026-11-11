import "server-only";
import { cache } from "react";
import { config } from "./config";
import { headerText } from "@/lib/email-parsing/mime";
import { gzipSync } from "node:zlib";
import { addressesIn, realSender } from "@/lib/email-parsing/addresses";
import {
  isPauseaiAddress,
  isRecognisedMail,
  isAtPauseai,
  isSomeoneElse,
  participants,
  politicianAddresses,
  politicianAnswered,
  politiciansIn,
  politiciansNamed,
  quotedAddresses,
  quotedNames,
  type PoliticianBook,
} from "@/lib/one-off";
import { staffCopy } from "@/lib/content/staff-interface";
import { now } from "@/lib/now";
import type { Permission } from "@/lib/staff-permissions";
import { query, type Queryable } from "./db";
import { messageContent } from "./letter-threads";
import { wholeTextOf } from "@/lib/email-parsing/mime";
import { decodeWords, fromAddress, messageIds, parseMime } from "@/lib/email-parsing/mime";
import { notifyStaff, staffLink } from "./notifications";
import { deleteLetterReply, saveLetterReply } from "./outside-services/blobs";
import {
  GmailError,
  gmailMessageHeaders,
  gmailRawMessage,
  gmailThreadMessageIds,
  unlessGone,
  type GmailMessageHeaders,
} from "./outside-services/gmail";
import { connectedAccounts, politicianBook } from "./politician-book";
import { problem } from "./problems";
import { keepReply, letterAnswered, noteAutoReply, postmarkMessageId } from "./letter-replies";
import { isMachineReply } from "@/lib/email-parsing/subjects";
import { forwardedMessages } from "@/lib/email-parsing/forwards";
import { replyParts } from "@/lib/email-parsing/reply-text";

// One-off emails: threads with a politician that aren't a letter of a campaign
// or mailing, read from a mailbox and kept whole, in Netlify Blobs with a row
// in one_off_messages. A message is kept once by its Message-ID, and threaded
// across mailboxes by the IDs it answers, as each has its own Gmail threads.
// docs/domain-concepts.md says what counts, and who sees what.

/** The headers that say who a message is from and to, and what it answers. */
export const ONE_OFF_HEADERS = [
  "From",
  "To",
  "Cc",
  "Reply-To",
  "X-Original-From",
  "Subject",
  "Message-ID",
  "In-Reply-To",
  "References",
  "List-Id",
  "Auto-Submitted",
  "X-Autoreply",
  "X-Autorespond",
  "Precedence",
];

/** The shared inbox one-off emails are copied to, as the page says: POLICY_INBOX, or else its usual address. */
export function oneOffInbox(): string {
  return config.policyInbox ?? "policy@pauseai.uk";
}

/** A message's Message-ID, if it has one. */
export function rfcIdOf(headers: Map<string, string>): string | null {
  return messageIds(headers.get("message-id"))[0] ?? null;
}

/** Everyone on a message by its headers, lowercased, its real sender first. */
export function addressesOn(headers: Map<string, string>): string[] {
  const sender = realSender(headerText(headers, "from"), headers.get("x-original-from"), headers.get("reply-to"));
  const lines = [sender, headers.get("from"), headers.get("reply-to"), headers.get("to"), headers.get("cc")];
  return [...new Set(addressesIn(decodeWords(lines.filter(Boolean).join(" "))))];
}

/** Who a message is from, the real sender where the group rewrote it. */
export function senderOf(headers: Map<string, string>): { address: string; name: string } {
  return fromAddress(realSender(headerText(headers, "from"), headers.get("x-original-from"), headers.get("reply-to")));
}

/** Whether a message is in the group's mail, which is shared. */
function isGroupMail(headers: Map<string, string>): boolean {
  return /policy(-archive)?\.pauseai\.uk/i.test(headers.get("list-id") ?? "");
}

/** The hash of a Message-ID that one_off_erased keeps, in SQL. */
const RFC_HASH = (rfc: string) => `encode(sha256(convert_to(${rfc}, 'UTF8')), 'hex')`;

/**
 * Keeps a message of a thread with a politician, once, in the thread it
 * answers, or that its Gmail thread is in, or a new one. Threads a message
 * joins together become one, and a thread has its earliest message's subject.
 * Gives what it kept, or nothing if it's kept, was and has been erased, or is
 * one we sent. A message in a letter's thread is the letter's, so it's kept
 * there instead, or noted there if a machine sent it, and gives nothing.
 */
export async function keepOneOff(
  account: string,
  message: GmailMessageHeaders,
  raw: Buffer,
  book: PoliticianBook,
  connected: readonly string[],
  extraPeople: number[] = [],
): Promise<number | undefined> {
  const rfc = rfcIdOf(message.headers);
  const [kept] = await query(
    `SELECT 1 FROM one_off_messages WHERE (account = $1 AND gmail_message_id = $2) OR rfc_message_id = $3::text
     UNION ALL SELECT 1 FROM one_off_erased WHERE (account = $1 AND gmail_message_id = $2) OR rfc_sha256 = ${RFC_HASH("$3::text")}
     UNION ALL SELECT 1 FROM letter_replies WHERE account = $1 AND gmail_message_id = $2
     UNION ALL SELECT 1 FROM email_sends WHERE (sender = $1 AND message_id = $2) OR (backend = 'postmark' AND message_id = $4)`,
    [account, message.id, rfc, postmarkMessageId(rfc)],
  );
  if (kept) return undefined;
  const letter = await letterAnswered(account, message);
  if (letter) {
    if (isMachineReply((name) => message.headers.get(name), headerText(message.headers, "subject"))) {
      await noteAutoReply(letter, message);
    } else {
      const from = senderOf(message.headers);
      // Read whole already, so no token is needed to fetch it.
      await keepReply(account, "", letter, message, { raw, from, fromUs: isPauseaiAddress(from.address, connected) });
    }
    return undefined;
  }
  const refs = [...messageIds(message.headers.get("in-reply-to")), ...messageIds(message.headers.get("references"))];
  const addresses = addressesOn(message.headers);
  const from = senderOf(message.headers);
  const at = new Date(Number(message.internalDate));
  const subject = headerText(message.headers, "subject");
  const key = `one-off/${account}/${message.id}.eml.gz`;
  const text = wholeTextOf(parseMime(raw.toString("latin1")));
  const quoted = { addresses: quotedAddresses(text), names: quotedNames(text) };
  await saveLetterReply(key, gzipSync(raw));
  const threads = await query<{ id: number }>(
    `SELECT DISTINCT thread_id::int AS id FROM one_off_messages
     WHERE (account = $1 AND gmail_thread_id = $2) OR rfc_message_id = ANY($3::text[]) OR ($4::text = ANY(in_reply_to))
     ORDER BY id`,
    [account, message.threadId, refs, rfc],
  );
  const [first, ...others] = threads.map((thread) => thread.id);
  const threadId = first ?? (await newThread(subject, at));
  for (const other of others) await mergeThreads(threadId, other);
  await query(
    `INSERT INTO one_off_messages (thread_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, in_reply_to,
       from_address, from_name, to_line, cc_line, addresses, subject, at, from_us, blob_key, size, quoted_addresses, quoted_names)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [
      threadId,
      account,
      message.id,
      message.threadId,
      rfc,
      refs,
      from.address,
      from.name,
      headerText(message.headers, "to"),
      headerText(message.headers, "cc"),
      addresses,
      subject,
      at,
      isPauseaiAddress(from.address, connected),
      key,
      raw.length,
      quoted.addresses,
      quoted.names,
    ],
  );
  const { people } = politiciansIn(book, [...addresses, ...quoted.addresses]);
  await query(
    `INSERT INTO one_off_thread_people (thread_id, notable_person_id) SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING`,
    [threadId, [...new Set([...people, ...politiciansNamed(book, quoted.names), ...extraPeople])]],
  );
  await query(
    `UPDATE one_off_threads SET latest_at = greatest(latest_at, $2), someone_else = someone_else OR $3,
       subject = (SELECT m.subject FROM one_off_messages m WHERE m.thread_id = $1 ORDER BY m.at, m.id LIMIT 1)
     WHERE id = $1`,
    [threadId, at, isSomeoneElse(book, from.address, connected)],
  );
  return threadId;
}

async function newThread(subject: string, at: Date): Promise<number> {
  const [{ id }] = await query<{ id: number }>(
    "INSERT INTO one_off_threads (subject, latest_at) VALUES ($1, $2) RETURNING id::int AS id",
    [subject, at],
  );
  return id;
}

/** Moves a thread's messages and people to another, and deletes it. */
async function mergeThreads(into: number, other: number): Promise<void> {
  await query("UPDATE one_off_messages SET thread_id = $1 WHERE thread_id = $2", [into, other]);
  await query(
    `INSERT INTO one_off_thread_people (thread_id, notable_person_id)
     SELECT $1, notable_person_id FROM one_off_thread_people WHERE thread_id = $2 ON CONFLICT DO NOTHING`,
    [into, other],
  );
  await query(
    `UPDATE one_off_threads t SET latest_at = greatest(t.latest_at, o.latest_at), someone_else = t.someone_else OR o.someone_else
     FROM one_off_threads o WHERE t.id = $1 AND o.id = $2`,
    [into, other],
  );
  await query("DELETE FROM one_off_threads WHERE id = $1", [other]);
}

/**
 * Keeps a message of a thread being kept, by its ID. One deleted since is
 * passed over, and one Gmail won't give, in a form it can't serve, reported, as
 * it would stop the mailbox's reading at the same place every time.
 */
async function keepThreadMate(
  account: string,
  token: string,
  id: string,
  book: PoliticianBook,
  connected: readonly string[],
): Promise<void> {
  try {
    const mate = await gmailMessageHeaders(token, id, ONE_OFF_HEADERS);
    await keepOneOff(account, mate, await gmailRawMessage(token, id), book, connected);
  } catch (error) {
    if (error instanceof GmailError && error.status === 400) problem(staffCopy.problems.job.unreadable, id);
    else unlessGone(error);
  }
}

/**
 * Keeps a message and the rest of its Gmail thread. What came before it was
 * passed over when it was read, as it didn't count alone. This runs for every
 * message kept, so it also picks up whatever a read that stopped partway left.
 */
async function keepWholeThread(
  account: string,
  token: string,
  message: GmailMessageHeaders,
  raw: Buffer,
  book: PoliticianBook,
  connected: readonly string[],
  people: number[],
): Promise<void> {
  const ids = [...new Set([...(await gmailThreadMessageIds(token, message.threadId)), message.id])];
  const kept = await query<{ id: string }>(
    "SELECT gmail_message_id AS id FROM one_off_messages WHERE account = $1 AND gmail_message_id = ANY($2::text[])",
    [account, ids],
  );
  const done = new Set(kept.map((row) => row.id));
  for (const id of ids.filter((id) => !done.has(id))) {
    if (id === message.id) await keepOneOff(account, message, raw, book, connected, people);
    else await keepThreadMate(account, token, id, book, connected);
  }
  await query(
    "DELETE FROM unmatched_mail WHERE account = $1 AND gmail_message_id = ANY($2::text[]) AND reported_at IS NULL",
    [account, ids],
  );
}

/**
 * What the site's regular read does with a message in a keeping account that
 * isn't a letter's: keeps it and the rest of its thread if its headers count,
 * or if it's shared mail (policy@, or the group's), the addresses it quotes
 * do; or it joins a thread already kept. Other shared mail is noted, to report
 * by its Gmail ID once. The rest of a mailbox like Joseph's is left unread.
 * `shared` is whether the whole account is shared.
 */
export async function keepIfPoliticianThread(
  account: string,
  token: string,
  message: GmailMessageHeaders,
  shared: boolean,
): Promise<"kept" | "unmatched" | "ignored"> {
  const { id } = message;
  const [book, connected] = await Promise.all([politicianBook(), connectedAccounts()]);
  const refs = [...messageIds(message.headers.get("in-reply-to")), ...messageIds(message.headers.get("references"))];
  const [inThread] = await query(
    `SELECT 1 FROM one_off_messages WHERE (account = $1 AND gmail_thread_id = $2) OR rfc_message_id = ANY($3::text[]) LIMIT 1`,
    [account, message.threadId, refs],
  );
  const addresses = addressesOn(message.headers);
  const keep = async (raw: Buffer, people: number[] = []) => {
    await keepWholeThread(account, token, message, raw, book, connected, people);
    return "kept" as const;
  };
  if (inThread || politiciansIn(book, addresses).counts) return keep(await gmailRawMessage(token, id));
  const sharedMail = shared || isGroupMail(message.headers);
  if (!sharedMail) return "ignored";
  const from = senderOf(message.headers).address;
  if (isRecognisedMail(from, message.labelIds) || connected.includes(from)) return "ignored";
  const raw = await gmailRawMessage(token, id);
  const quoted = politiciansIn(book, quotedAddresses(wholeTextOf(parseMime(raw.toString("latin1")))));
  if (quoted.counts) return keep(raw, quoted.people);
  await query("INSERT INTO unmatched_mail (account, gmail_message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
    account,
    id,
  ]);
  return "unmatched";
}

/** A day between reports. */
const REPORT_EVERY_MS = 24 * 60 * 60_000;

/** The most one report lists, as each is read again from Gmail. The rest wait for the next. */
const REPORT_AT_MOST = 100;

/**
 * Emails the notification inbox the new mail that matched nothing, oldest
 * first, by sender and subject, read again from Gmail as only its ID is kept:
 * at most once a day, whether the last try's email went or not, and saying how
 * many more wait. `token` gives the access token of an account. Says how many
 * it listed.
 */
export async function reportUnmatchedMail(token: (account: string) => Promise<string>): Promise<number> {
  const [last] = await query<{ at: Date | null }>(
    "SELECT greatest(max(reported_at), max(tried_at)) AS at FROM unmatched_mail",
  );
  if (last.at && now().getTime() - last.at.getTime() < REPORT_EVERY_MS) return 0;
  await query("UPDATE unmatched_mail SET tried_at = now() WHERE reported_at IS NULL");
  const batch = await query<{ account: string; id: string; waiting: number }>(
    `SELECT account, gmail_message_id AS id, count(*) OVER ()::int AS waiting FROM unmatched_mail
     WHERE reported_at IS NULL ORDER BY found_at, gmail_message_id LIMIT $1`,
    [REPORT_AT_MOST],
  );
  if (!batch.length) return 0;
  const lines: string[] = [];
  for (const { account, id } of batch) {
    const message = await gmailMessageHeaders(await token(account), id, ["From", "Subject"]).catch(unlessGone);
    if (message) lines.push(`- ${headerText(message.headers, "from")}: ${headerText(message.headers, "subject")}`);
  }
  const words = staffCopy.oneOff.unmatchedAlert;
  const more = batch[0].waiting - batch.length;
  // Marked reported only once the email has gone, so a batch the email failed for is reported next time.
  if (
    lines.length &&
    !(await notifyStaff(
      words.subject(lines.length),
      words.body(more ? [...lines, words.more(more)] : lines, staffLink("/staff/emails?type=one-off", undefined)),
      null,
      "staff-report",
    ))
  ) {
    return 0;
  }
  await query(
    `UPDATE unmatched_mail SET reported_at = now()
     WHERE (account, gmail_message_id) IN (SELECT * FROM unnest($1::text[], $2::text[]))`,
    [batch.map((row) => row.account), batch.map((row) => row.id)],
  );
  return lines.length;
}

/** A row of the one-off emails' list. `hidden` for staff who can't see a thread with someone else in it: no name or subject reaches them. */
export type OneOffThreadRow = {
  id: number;
  subject: string | null;
  someoneElse: boolean;
  latestAt: Date;
  messages: number;
  people: { id: number; name: string; isTest: boolean }[];
  /** Who wrote in it, each once, in the order they first wrote; null when hidden. */
  participants: string[] | null;
  /** The mailboxes it was read from; null when hidden. */
  mailboxes: string[] | null;
  /** Whether a politician wrote after its first message; null when hidden. */
  answered: boolean | null;
};

const PEOPLE = `coalesce((SELECT json_agg(json_build_object('id', n.id, 'name', n.name, 'isTest', coalesce(p.is_test, false)) ORDER BY n.name)
    FROM one_off_thread_people tp JOIN notable_people n ON n.id = tp.notable_person_id
    LEFT JOIN politicians p ON p.id = n.id WHERE tp.thread_id = t.id), '[]')`;

type Sender = { name: string; address: string };

/**
 * The threads staff without `supporters` don't see: any with someone on one of
 * its messages, its sender or on its To or Cc, who's neither PauseAI nor a
 * politician, or that reading it marked so. Worked out as it's asked for, so it
 * follows who the politicians and our accounts are, once a page however many
 * of its loaders ask (React's cache()).
 */
export const threadsWithSomeoneElse = cache(async function threadsWithSomeoneElse(): Promise<number[]> {
  const [rows, book, connected] = await Promise.all([
    query<{ id: number; marked: boolean; addresses: string[] }>(
      `SELECT t.id::int AS id, t.someone_else AS marked, coalesce(array_agg(address) FILTER (WHERE address IS NOT NULL), '{}') AS addresses
       FROM one_off_threads t LEFT JOIN one_off_messages m ON m.thread_id = t.id
         LEFT JOIN LATERAL unnest(m.addresses) address ON true
       GROUP BY t.id`,
    ),
    politicianBook(),
    connectedAccounts(),
  ]);
  return rows
    .filter(
      ({ marked, addresses }) =>
        marked || addresses.some((address) => !isAtPauseai(address) && isSomeoneElse(book, address, connected)),
    )
    .map(({ id }) => id);
});

/** One-off threads, newest first, matching `where`: with permission, everything; otherwise, a thread with someone else in it shows only that it's there. */
async function threadRows(where: string, params: unknown[], supporters: boolean, limit: number, offset: number) {
  const hidden = `$${params.length + 1}::bigint[]`;
  const visible = (column: string) =>
    supporters ? column : `CASE WHEN t.id = ANY(${hidden}) THEN NULL ELSE ${column} END`;
  const someoneElse = await threadsWithSomeoneElse();
  const [rows, book] = await Promise.all([
    query<Omit<OneOffThreadRow, "answered" | "participants"> & { senders: Sender[] | null }>(
      `SELECT t.id::int AS id, ${visible("t.subject")} AS subject, t.id = ANY(${hidden}) AS "someoneElse", t.latest_at AS "latestAt",
       (SELECT count(*)::int FROM one_off_messages m WHERE m.thread_id = t.id) AS messages, ${PEOPLE} AS people,
       ${visible("(SELECT array_agg(DISTINCT m.account ORDER BY m.account) FROM one_off_messages m WHERE m.thread_id = t.id)")} AS mailboxes,
       ${visible("(SELECT json_agg(json_build_object('name', m.from_name, 'address', m.from_address) ORDER BY m.at, m.id) FROM one_off_messages m WHERE m.thread_id = t.id)")} AS senders
     FROM one_off_threads t WHERE ${where} ORDER BY t.latest_at DESC, t.id DESC LIMIT ${limit} OFFSET ${offset}`,
      [...params, someoneElse],
    ),
    politicianBook(),
  ]);
  return rows.map(({ senders, ...row }) => ({
    ...row,
    participants: senders && participants(senders),
    answered:
      senders &&
      politicianAnswered(
        book,
        senders.map((sender) => sender.address),
      ),
  }));
}

/** A politician's one-off emails, newest first. */
export function politicianOneOffs(
  politicianId: number,
  permissions: readonly Permission[],
): Promise<OneOffThreadRow[]> {
  return threadRows(
    "EXISTS (SELECT 1 FROM one_off_thread_people p WHERE p.thread_id = t.id AND p.notable_person_id = $1)",
    [politicianId],
    permissions.includes("supporters"),
    200,
    0,
  );
}

/** A supporter's one-off emails, newest first: those with an address of theirs on them. */
export function supporterOneOffs(supporterId: number): Promise<OneOffThreadRow[]> {
  return threadRows(
    `EXISTS (SELECT 1 FROM one_off_messages m JOIN supporter_links k ON k.matched_value = ANY(m.addresses)
      WHERE m.thread_id = t.id AND k.supporter_id = $1)`,
    [supporterId],
    true,
    200,
    0,
  );
}

/** A message of a thread, as its page shows it. */
export type OneOffMessage = {
  id: number;
  at: Date;
  fromName: string;
  fromAddress: string;
  to: string;
  cc: string;
  subject: string;
  account: string;
  /** Which politician each address in its From, To and Cc is. */
  politicians: Record<string, number>;
  text: string | null;
  /** The mail it quotes and its footer, folded under its text; empty if none. */
  quoted: string;
  /** Sent by a machine, such as an out-of-office, by its kept mail's headers and subject. */
  auto: boolean;
  /** For a forward, the messages it carries, oldest first, but for any the thread holds whole; its text is then the note over them. */
  forwarded: RebuiltMessage[];
};

/** A message rebuilt from a forward's quote of it: its headers as quoted, and its text and what it quotes in turn. */
export type RebuiltMessage = {
  fromName: string;
  fromAddress: string;
  to: string;
  cc: string;
  /** When it was sent, as the quote says. */
  sent: string;
  subject: string;
  politicians: Record<string, number>;
  text: string;
  quoted: string;
};

/** A text's first words, its spacing and quoting evened out, to tell one message's text from another's. */
const opening = (text: string) =>
  text
    .replace(/[\s>]+/g, " ")
    .trim()
    .slice(0, 80)
    .toLowerCase();

/**
 * A message's text, what it quotes, and, if it's a forward, the messages it
 * carries, oldest first: each rebuilt from its quoted headers, unless
 * `held`, the thread's kept messages, has it whole, by its sender and opening.
 */
function withForwards(
  content: { text: string | null; quoted: string; whole: string | null },
  subject: string,
  book: PoliticianBook,
  held: { fromAddress: string; text: string | null }[],
): { text: string | null; quoted: string; forwarded: RebuiltMessage[] } {
  const split = content.whole === null ? undefined : forwardedMessages(content.whole, subject);
  if (!split) return { text: content.text, quoted: content.quoted, forwarded: [] };
  const own = split.own ? replyParts(split.own) : { text: "", quoted: "" };
  const forwarded = split.forwarded.map((message) => {
    const from = fromAddress(message.from);
    const parts = replyParts(message.body);
    const addresses = [from.address, ...addressesIn(`${message.to} ${message.cc}`)];
    return {
      fromName: from.name,
      fromAddress: from.address,
      to: message.to,
      cc: message.cc,
      sent: message.sent,
      subject: message.subject || subject,
      politicians: politicianAddresses(book, addresses),
      ...parts,
    };
  });
  const kept = (message: RebuiltMessage) =>
    held.some(
      (other) =>
        other.fromAddress === message.fromAddress &&
        other.text !== null &&
        opening(other.text).startsWith(opening(message.text)),
    );
  return { ...own, forwarded: forwarded.filter((message) => !kept(message)).reverse() };
}

/** A one-off thread, for its page: `messages` null for staff who can't see it. */
export type OneOffThread = OneOffThreadRow & { messages_: OneOffMessage[] | null };

/**
 * One thread for its page, or undefined: staff without `supporters` see none
 * of a thread with someone else in it but that it's there. Its messages' rows
 * are read beside the thread's, and left unread in the blob store if hidden.
 */
export async function getOneOffThread(
  id: number,
  permissions: readonly Permission[],
): Promise<OneOffThread | undefined> {
  const supporters = permissions.includes("supporters");
  const [[row], rows, book] = await Promise.all([
    threadRows("t.id = $1", [id], supporters, 1, 0),
    query<Omit<OneOffMessage, "text" | "quoted" | "auto" | "politicians" | "forwarded"> & { blobKey: string }>(
      `SELECT id::int AS id, at, from_name AS "fromName", from_address AS "fromAddress", to_line AS "to", cc_line AS cc,
         subject, account, blob_key AS "blobKey"
       FROM one_off_messages WHERE thread_id = $1 ORDER BY at, id`,
      [id],
    ),
    politicianBook(),
  ]);
  if (!row) return undefined;
  if (row.someoneElse && !supporters) return { ...row, messages_: null };
  const kept = await Promise.all(
    rows.map(async ({ blobKey, ...message }) => ({ message, content: await messageContent(blobKey) })),
  );
  const contents = kept.map(({ content }) => content);
  const held = kept.map(({ message, content }) => ({ fromAddress: message.fromAddress, text: content.text }));
  const messages = kept.map(({ message }, i) => {
    const addresses = [message.fromAddress, ...addressesIn(`${message.to} ${message.cc}`)];
    return {
      ...message,
      politicians: politicianAddresses(book, addresses),
      auto: contents[i].auto,
      ...withForwards(
        contents[i],
        message.subject,
        book,
        held.filter((_, j) => j !== i),
      ),
    };
  });
  return { ...row, messages_: messages };
}

/**
 * Deletes every one-off message with a supporter's address on it or in what
 * it quotes, for their erasure, and any thread left empty, noting each in one_off_erased so that
 * reading its thread again doesn't keep it again. Gives the blobs to delete after.
 */
export async function eraseOneOffs(supporterId: number, db: Queryable): Promise<string[]> {
  const gone = await query<{ blobKey: string; threadId: number }>(
    `WITH gone AS (
       DELETE FROM one_off_messages m USING supporter_links k
       WHERE k.supporter_id = $1 AND k.matched_value = ANY(m.addresses || coalesce(m.quoted_addresses, '{}'))
       RETURNING m.account, m.gmail_message_id, m.rfc_message_id, m.blob_key, m.thread_id
     ), noted AS (
       INSERT INTO one_off_erased (account, gmail_message_id, rfc_sha256)
       SELECT account, gmail_message_id, ${RFC_HASH("rfc_message_id")} FROM gone
     )
     SELECT blob_key AS "blobKey", thread_id::int AS "threadId" FROM gone`,
    [supporterId],
    db,
  );
  await query(
    `DELETE FROM one_off_threads t WHERE t.id = ANY($1::bigint[])
       AND NOT EXISTS (SELECT 1 FROM one_off_messages m WHERE m.thread_id = t.id)`,
    [gone.map((row) => row.threadId)],
    db,
  );
  return gone.map((row) => row.blobKey);
}

/**
 * The blobs of the replies on these form entries' letters that no proxy holds,
 * read from a staff mailbox or kept from Postmark, as the letter's deletion
 * takes only their rows. The Gmail IDs of those read from a mailbox are kept
 * in one_off_erased, so that reading their thread again
 * doesn't keep them as one-offs.
 */
export async function eraseRepliesToFormLetters(entries: number[], db: Queryable): Promise<string[]> {
  const gone = await query<{ blobKey: string }>(
    `WITH gone AS (
       SELECT r.account, r.gmail_message_id, r.rfc_message_id, r.blob_key FROM letter_replies r
         JOIN letters_from_supporters s ON s.id = r.letter_id
       WHERE s.entry_id = ANY($1::bigint[]) AND s.proxy_id IS NULL
     ), noted AS (
       INSERT INTO one_off_erased (account, gmail_message_id, rfc_sha256)
       SELECT account, gmail_message_id, ${RFC_HASH("rfc_message_id")} FROM gone
       WHERE gmail_message_id IS NOT NULL ON CONFLICT DO NOTHING
     )
     SELECT blob_key AS "blobKey" FROM gone`,
    [entries],
    db,
  );
  return gone.map((row) => row.blobKey);
}

/** Deletes kept messages' blobs. */
export async function deleteOneOffBlobs(keys: string[]): Promise<void> {
  for (const key of keys) await deleteLetterReply(key);
}
