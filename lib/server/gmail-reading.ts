import "server-only";
import { config } from "./config";
import { staffCopy } from "@/lib/content/staff-interface";
import { importPath, type GmailRead, type GmailReadResult } from "@/lib/import-runs";
import { gmailMessageLink } from "@/lib/letter-links";
import { query } from "./db";
import { handleDeliveryProblem } from "./delivery-problems";
import { lettersInbox } from "./letters-inbox";
import { readLettersInbox } from "./letters-inbox-reading";
import { notifyStaff, staffLink } from "./notifications";
import { gmailAccess, gmailReadingState, saveGmailName, saveHistoryId } from "@/lib/accounts/gmail-accounts";
import { asRun, type Ran } from "./import-runs";
import { keepsPoliticianThreads } from "@/lib/one-off";
import { keepIfPoliticianThread, reportUnmatchedMail } from "./one-off-emails";
import { searchAddedAddresses } from "@/lib/politicians/aliases";
import { readBounce } from "@/lib/email-parsing/bounces";
import { fromAddress, messageIds } from "@/lib/email-parsing/mime";
import {
  gmailHistory,
  gmailMessageHeaders,
  gmailProfile,
  gmailRawMessage,
  unlessGone,
  gmailSendName,
  GmailError,
  searchGmail,
  type GmailMessageHeaders,
} from "./outside-services/gmail";
import { keepReply, letterAnswered, noteAutoReply, postmarkMessageId } from "./letter-replies";
import { copyAnswered, keepBroadcastReply } from "./broadcast-replies";
import { isMachineReply } from "@/lib/email-parsing/subjects";
import { describeError, problem } from "./problems";

// Reading the connected Gmail accounts, every 5 minutes: the replies to PauseAI's
// letters and to copies of broadcasts (broadcast-replies.ts), and the bounces of them. For each message that arrived since the
// last read, the site fetches only the few headers that say what it
// answers; it fetches whole only the messages in our letters' threads, and
// bounces. A politician's reply, or our answer to it, is kept whole
// (letter_replies, and the message in Netlify Blobs); an automatic reply is
// only noted on the letter; a bounce is recorded as Postmark's are. Anything
// else, in a mailbox whose threads are kept, may be a one-off email
// (one-off-emails.ts). Each run is in the import log as "read-gmail".

const JOB = "read-gmail";

/** The headers that say what a message is and what it answers. */
const HEADERS = [
  "From",
  "To",
  "Cc",
  "Reply-To",
  "Subject",
  "Message-ID",
  "In-Reply-To",
  "References",
  "Auto-Submitted",
  "X-Autoreply",
  "X-Autorespond",
  "Precedence",
  "X-Original-From",
  "List-Id",
];

/**
 * Bounces from another server than Gmail's may not be in the letter's
 * thread, or name it, so they're also searched for, as far back as a
 * bounce can come late.
 */
const BOUNCE_SEARCH = "from:mailer-daemon OR from:postmaster newer_than:3d";

/** When the mailbox's history has gone, what's searched instead, to miss nothing since the last read. */
const RESTART_SEARCH = "newer_than:3d";

/** The same for the letters inbox, its Spam and Sent included, which the history has too. */
const LETTERS_RESTART_SEARCH = "in:anywhere newer_than:3d";

/** Whether a sender is a mail server reporting a bounce. */
const isBounceSender = (address: string) => /^(mailer-daemon|postmaster)@/.test(address);

/**
 * Whether a message is one we sent: a letter, which the mailbox has in
 * Sent, by its Message-ID, or in the mailbox it went from, by Gmail's own ID
 * for it, as Gmail can send an email with a Message-ID of its own; or an
 * email Postmark sent, such as our forward of a reply to a letter, whose
 * reply is kept already from Postmark's own copy.
 */
async function isOurs(account: string, message: GmailMessageHeaders): Promise<boolean> {
  const [id] = messageIds(message.headers.get("message-id"));
  const [row] = await query(
    `SELECT 1 FROM email_sends
     WHERE rfc_message_id = $1 OR (backend = 'gmail' AND sender = $2 AND message_id = $3)
       OR (backend = 'postmark' AND message_id = $4)`,
    [id ?? null, account, message.id, postmarkMessageId(id)],
  );
  return !!row;
}

/**
 * Records each address a bounce says failed, as Postmark's bounces are,
 * once: only an address we sent the email it's a bounce of, as anyone can
 * write to a mailbox as mailer-daemon, and a recorded bounce blocks its
 * address. Any other address it names is left alone. Returns how many it
 * recorded.
 */
async function recordBounce(
  account: string,
  token: string,
  message: GmailMessageHeaders,
  request: Request | undefined,
): Promise<number> {
  const [seen] = await query("SELECT 1 FROM email_problems WHERE gmail_message_id = $1", [message.id]);
  if (seen) return 0;
  const bounce = readBounce((await gmailRawMessage(token, message.id)).toString("latin1"));
  let recorded = 0;
  for (const failed of bounce.addresses) {
    // Our email to the address: the one the bounce names, or else one in the same Gmail thread, where Gmail puts its own bounces.
    const [sent] = await query<{ messageId: string }>(
      `SELECT message_id AS "messageId" FROM email_sends
       WHERE outcome = 'sent' AND address = $4
         AND (rfc_message_id = $1 OR (backend = 'gmail' AND sender = $2 AND gmail_thread_id = $3))
       ORDER BY rfc_message_id = $1 DESC NULLS LAST, at DESC LIMIT 1`,
      [bounce.messageId ?? null, account, message.threadId, failed.address],
    );
    if (!sent) continue;
    await handleDeliveryProblem(
      {
        address: failed.address,
        messageId: sent.messageId,
        kind: failed.delayed ? "soft" : "hard",
        reason: failed.reason || failed.status || message.headers.get("subject") || "",
        canReset: true,
        details: { status: failed.status, account },
        gmailMessageId: message.id,
        gmailAccount: account,
      },
      request,
    );
    recorded++;
  }
  return recorded;
}

/** Reads one message: a bounce, a reply to a letter, or something else, left alone; one gone since, skipped. */
async function readMessage(account: string, token: string, id: string, read: GmailRead, request: Request | undefined) {
  const message = await gmailMessageHeaders(token, id, HEADERS).catch(unlessGone);
  if (!message) return;
  const from = fromAddress(message.headers.get("from")).address;
  if (isBounceSender(from)) {
    read.bounces += await recordBounce(account, token, message, request);
    return;
  }
  const [kept] = await query("SELECT 1 FROM letter_replies WHERE account = $1 AND gmail_message_id = $2", [
    account,
    id,
  ]);
  if (kept || (await isOurs(account, message))) return;
  // A reply to a copy of a broadcast, before anything else sees it; one from the mailbox itself is an answer of ours,
  // sent from its Gmail rather than the site, which isOurs doesn't know.
  const copyId = await copyAnswered(message);
  if (copyId) {
    if (from === account.toLowerCase()) return;
    const what = await keepBroadcastReply(account, token, copyId, message);
    if (what === "reply") read.replies++;
    if (what === "automatic") read.autoReplies++;
    return;
  }
  const letterId = await letterAnswered(account, message);
  if (!letterId) {
    if (keepsPoliticianThreads(account))
      read.oneOffs =
        (read.oneOffs ?? 0) +
        ((await keepIfPoliticianThread(account, token, message, account === config.policyInbox)) === "kept" ? 1 : 0);
    return;
  }
  if (isMachineReply((name) => message.headers.get(name), message.headers.get("subject") ?? "")) {
    if (await noteAutoReply(letterId, message)) read.autoReplies++;
    return;
  }
  await keepReply(account, token, letterId, message);
  read.replies++;
}

/**
 * Reads one account, from where it last got to, and saves where it got to.
 * The letters inbox is read as its own (letters-inbox-reading.ts): all its
 * mail is ours, and its bounces come to it rather than in a thread.
 */
async function readAccount(account: string, historyId: string, request: Request | undefined): Promise<GmailRead> {
  let read: GmailRead = { account, replies: 0, autoReplies: 0, bounces: 0 };
  const token = await gmailAccess(account);
  const letters = account === lettersInbox();
  let history = await gmailHistory(token, historyId);
  if (!history) {
    const { historyId: now } = await gmailProfile(token);
    history = {
      messageIds: await searchGmail(token, letters ? LETTERS_RESTART_SEARCH : RESTART_SEARCH, 500),
      historyId: now,
    };
    read.restarted = true;
  }
  if (letters) {
    read = await readLettersInbox(account, token, history.messageIds, read, request);
  } else {
    const ids = new Set([...history.messageIds, ...(await searchGmail(token, BOUNCE_SEARCH))]);
    for (const id of ids) await readMessage(account, token, id, read, request);
  }
  await saveHistoryId(account, history.historyId);
  // Its name, as Gmail has it now: renamed since it was connected, or connected before the site kept it. The
  // mailbox has been read by now, so a name Gmail won't give is a problem, not a read that failed.
  try {
    await saveGmailName(account, await gmailSendName(token));
  } catch (error) {
    problem(staffCopy.problems.job.nameUnknown(account), error);
  }
  return read;
}

/**
 * Emails the notification inbox once, after a run that found mail in the letters
 * inbox it couldn't account for: each message, with a link to it in Gmail,
 * and a link to the runs. Says whether it went.
 */
async function alertNotUnderstood(accounts: GmailRead[], request: Request | undefined): Promise<boolean> {
  const words = staffCopy.lettersInbox;
  const lines = accounts
    .filter((a) => a.notUnderstood)
    .flatMap((a) =>
      a.notUnderstood!.map(
        (m) =>
          `- ${m.from}, "${m.subject}": ${words.reasons[m.reason]}. ${gmailMessageLink(a.account, m.gmailMessageId)}`,
      ),
    );
  return notifyStaff(
    words.alert.subject(lines.length, lettersInbox()!),
    words.alert.body(lettersInbox()!, lines, staffLink(importPath(JOB), request)),
  );
}

/**
 * How long the search for addresses staff added may start on another, at
 * the start of a run, so that reading the mailboxes, which can take most of
 * a minute, follows soon after.
 */
const SEARCH_FOR_MS = 5_000;

/**
 * Searches the mailboxes for addresses staff added, if any wait
 * (searchAddedAddresses), then reads every connected account, keeping the
 * run. One that fails is a problem of the run, and the next is read all the
 * same; it's read again from where it got to next time, unless Google
 * refused its access, which disconnects it (gmailAccess). `request` is the job's call, for links in
 * alerts; a staff member's run has none. Two runs would each handle the same
 * messages, so only one goes at a time (lib/server/jobs.ts).
 */
export async function readGmail(startedBy: string, request?: Request): Promise<GmailReadResult> {
  const { result } = await asRun(JOB, startedBy, () => readAll(request));
  return result;
}

/** A run of readGmail. */
async function readAll(request: Request | undefined): Promise<Ran<GmailReadResult>> {
  // First, as reading the mailboxes takes most of a run, and the search is rare and brief.
  const search = await searchAddedAddresses(Date.now() + SEARCH_FOR_MS);
  const accounts: GmailRead[] = [];
  for (const { email, historyId } of await gmailReadingState()) {
    try {
      accounts.push(await readAccount(email, historyId, request));
    } catch (error) {
      const disconnected = error instanceof GmailError && error.revoked;
      // One Google disconnected has an email of its own (gmail-accounts.ts).
      problem(staffCopy.problems.job.couldntRead(email), error, { told: disconnected });
      accounts.push({
        account: email,
        replies: 0,
        autoReplies: 0,
        bounces: 0,
        error: describeError(error),
        ...(disconnected && { disconnected }),
      });
    }
  }
  const found = accounts.some(
    (a) =>
      a.replies + a.autoReplies + a.bounces > 0 ||
      a.oneOffs ||
      a.relayed ||
      a.spam ||
      a.notUnderstood?.length ||
      a.restarted ||
      a.error,
  );
  const notUnderstood = accounts.reduce((n, a) => n + (a.notUnderstood?.length ?? 0), 0);
  if (notUnderstood) {
    problem(staffCopy.problems.job.notUnderstood, notUnderstood, {
      told: await alertNotUnderstood(accounts, request),
    });
  }
  await reportUnmatchedMail(gmailAccess);
  const searched = search.searched || search.waiting ? { searched: search } : {};
  return { status: found || search.kept ? "ok" : "unchanged", result: { accounts, ...searched } };
}
