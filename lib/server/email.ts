import "server-only";
import { bareAddress } from "@/lib/email-parsing/addresses";
import { logChange } from "./audit";
import { query, transaction } from "./db";
import { newMessageId } from "./mime";
import { GmailError, gmailMessageId, sendGmail, sendRawGmail } from "./outside-services/gmail";
import { PostmarkError, sendEmail, unsuppress, type Email, type PostmarkStream } from "./outside-services/postmark";
import { recordOptOut } from "@/lib/supporters/opt-outs";
import { now } from "@/lib/now";
import { plainAsHtml } from "@/lib/plain-email-html";
import { problem } from "./problems";
import { staffCopy } from "@/lib/content/staff-interface";

// Every email the site sends goes through sendWith(), whatever it's for:
// most by send() (email-sending.ts), staff's notifications by notifyStaff()
// (notifications.ts). A bounce or complaint is about an address, not about
// the email that found it out: once an address hard-bounces or complains,
// nothing is sent to it again until staff unblock it. It goes by Postmark
// (lib/server/outside-services/postmark.ts), whose webhooks become a
// DeliveryProblem, or by a staff member's connected Gmail (gmail.ts there),
// whose bounces are read from the mailbox (gmail-reading.ts). This module is
// the bottom of the email code, so it imports none of the modules that send
// through it.

/** What an email is for. Each has its own way of handling a bounce (delivery-problems.ts). */
export type Purpose =
  | "letter"
  | "letter-copy"
  | "relay"
  | "supporter-notice"
  | "office-notice"
  | "forwarded-reply"
  | "staff-login"
  | "staff-alert"
  | "staff-report"
  | "mailing"
  | "mailing-test"
  | "broadcast"
  | "preferences-link"
  | "bulk-notice"
  | "broadcast-answer";

/** What sends an email: Postmark, or a staff member's connected Gmail, as that account. */
export type Backend = { name: "postmark" } | { name: "gmail"; account: string };

export type SendOptions = {
  backend?: Backend;
  /** The connected Gmail account a mailing goes from, whichever backend sends it, to count against its daily limit. */
  sender?: string;
  /** The Message-ID to send it with, so replies can be matched to it; Gmail's sends always have one. */
  messageId?: string;
  /**
   * By Gmail, the whole message to send in place of one made from the
   * email's fields, given the Message-ID and date it goes with: a relay
   * (lib/server/relays.ts). The email's To still says whom it's to.
   */
  raw?: (messageId: string, date: Date) => Buffer;
  /** By Gmail, the thread in the sending mailbox it joins, as an answer to a message there does. */
  threadId?: string;
  /** By Postmark, the stream it goes on: the broadcast one for a broadcast's copy. */
  stream?: PostmarkStream;
  /** The copy of a broadcast it is, kept with the try. */
  copyId?: number;
};

/**
 * A send, or why not. `retry` marks a failure Gmail or Postmark answered
 * that's the account's or the provider's own, not this email's: it was busy
 * or down, refused our credentials or a quota (ACCOUNT_REFUSALS), or Gmail
 * no longer lets us use the account. Nothing went, so a later try can't
 * send it twice, and the account's next email would fail the same way.
 * `fixNeeded` marks one of those that lasts till someone fixes the account:
 * its credentials refused, or Gmail's access revoked. The rest pass by
 * themselves, as a sending limit does.
 * `mayHaveGone` marks one whose send broke off with no answer, which the
 * provider may have taken first: it must never be sent again.
 */
export type SendResult =
  | { sent: true; id: string; messageId: string | null; threadId: string | null; backend: Backend }
  | {
      sent: false;
      reason: "blocked" | "failed";
      retry?: true;
      fixNeeded?: true;
      mayHaveGone?: true;
      detail?: string;
    };

/**
 * The statuses Gmail and Postmark refuse an account's sending with for now,
 * whatever the email: a quota of the API or a request rate (403), and its
 * sending limits (429), which Gmail keeps to for up to a day.
 * https://developers.google.com/workspace/gmail/api/guides/handle-errors
 * https://postmarkapp.com/developer/api/overview
 */
const REFUSED_FOR_NOW = [403, 429];

/**
 * Whether a provider's refusal is the account's or its own, not this
 * email's, so a later try may go (SendResult): "fix" for one that lasts
 * till someone fixes the account, its credentials refused (401) or Gmail's
 * access revoked; "later" for one that passes by itself, a limit or the
 * provider busy or down.
 */
function accountsFault(error: unknown): "fix" | "later" | undefined {
  const status = error instanceof GmailError || error instanceof PostmarkError ? error.status : undefined;
  if (status === undefined) return undefined;
  if ((error instanceof GmailError && error.revoked) || status === 401) return "fix";
  return REFUSED_FOR_NOW.includes(status) || status >= 500 ? "later" : undefined;
}

/**
 * What sent an email, as the event about it in a letter's history records
 * it: the backend, and for Gmail the account. Kept with the event, so each
 * says what sent its own email, however emails are sent later.
 */
export function sentBy(backend: Backend): { backend: Backend["name"]; account?: string } {
  return backend.name === "gmail" ? { backend: "gmail", account: backend.account } : { backend: backend.name };
}

/** A bounce or spam complaint, as any provider reports it. */
/** What can block an address: a provider's bounce or complaint, or a hold in CiviCRM (lib/server/civicrm-import.ts). */
export type ProblemKind = DeliveryProblem["kind"] | "hold";

export type DeliveryProblem = {
  address: string;
  /** The email it was about, if the provider said. */
  messageId: string | null;
  /** A hard bounce or complaint blocks the address. */
  kind: "hard" | "soft" | "complaint";
  /** The provider's own words. */
  reason: string;
  /** Whether the provider will send to the address again if asked. */
  canReset: boolean;
  details?: object;
  /** The bounce's own message, when it was read from a Gmail mailbox rather than reported by Postmark. */
  gmailMessageId?: string;
  /** The Gmail mailbox it was read from, with `gmailMessageId`. */
  gmailAccount?: string;
};

/** Who the audit log says blocked an address. */
const PROVIDER = "postmark";

/** The addresses Postmark's refusal names as inactive ("Found inactive addresses: a@x.org, b@y.org."), bare. */
function inactiveAddresses(message: string): string[] {
  const list = /Found inactive addresses: (.*?)\.(?:\s|$)/.exec(message)?.[1] ?? "";
  return list
    .split(",")
    .map((each) => bareAddress(each))
    .filter(Boolean);
}

/**
 * The emails that go even to an address with "Do not email": what the
 * person just asked for, or that is about something they did, such as a
 * login link, their letter's copy, or their MP's reply to it, which to them
 * is mail from their MP that we pass on; and email to staff. Any other is
 * refused for such an address.
 */
const TRANSACTIONAL: ReadonlySet<Purpose> = new Set([
  "letter",
  "letter-copy",
  "relay",
  "supporter-notice",
  "office-notice",
  "forwarded-reply",
  "staff-login",
  "staff-alert",
  "staff-report",
  "mailing-test",
  "preferences-link",
  "bulk-notice",
  // An answer to what the person wrote to us.
  "broadcast-answer",
]);

/** Whether the address has "Do not email", in CiviCRM or as an opt-out of ours of all email. */
async function doesNotEmail(address: string): Promise<boolean> {
  const [row] = await query(
    `SELECT 1 FROM contact_permission('newsletter', 'email', $1) d WHERE d.reason = 'do-not-email'`,
    [address],
  );
  return Boolean(row);
}

export async function isBlocked(address: string): Promise<boolean> {
  const [row] = await query("SELECT 1 FROM email_blocks WHERE address = $1", [bareAddress(address)]);
  return !!row;
}

/**
 * An email written only as text, with its words as HTML too
 * (lib/plain-email-html.ts), so a mail app shows it in its own font, wrapped
 * to its window, as it shows a letter or a mailing. Its links stay as
 * written, a login link among them: Postmark is told not to send them
 * through its own address, whatever the server is set to. One with HTML of
 * its own, or with no words, as a relay has, is left as it is.
 */
function withHtml(email: Email): Email {
  if (email.HtmlBody || !email.TextBody) return email;
  return { ...email, HtmlBody: plainAsHtml(email.TextBody), TrackLinks: "None" };
}

/**
 * What sendWith() calls on in the modules above this one, which send
 * through it: how to get a connected Gmail account's access token
 * (gmailAccess in gmail-accounts.ts), needed only to send by Gmail; and what
 * to do about an address the provider's refusal just blocked (in
 * notifications.ts, which tells staff if it's a politician's).
 */
export type SendHooks = {
  gmailAccess?: (account: string) => Promise<string>;
  blocked: (address: string, reason: string) => Promise<void>;
};

/**
 * Sends an email, unless its address is blocked. The provider refusing an
 * address it suppressed blocks it here too, and `hooks.blocked` is told.
 * Every try is logged in
 * email_sends; a failure is logged to the console as well. Never throws for
 * the provider, nor once the email has gone, as a failure to log it then is
 * reported and the send still returned: so whatever it throws, nothing went,
 * and a caller can put the email back to try again. Callers decide what to
 * tell people.
 */
export async function sendWith(
  hooks: SendHooks,
  written: Email,
  purpose: Purpose,
  letterId: number | null = null,
  { backend = { name: "postmark" }, sender, messageId, raw, threadId: joins, stream, copyId }: SendOptions = {},
): Promise<SendResult> {
  const email = withHtml(written);
  const address = bareAddress(email.To);
  const from = backend.name === "gmail" ? backend.account : (sender ?? null);
  let rfcId = backend.name === "gmail" ? (messageId ?? newMessageId()) : (messageId ?? null);
  const log = (outcome: "sent" | "refused" | "failed", id: string | null = null, threadId: string | null = null) =>
    query(
      `INSERT INTO email_sends (purpose, letter_id, address, outcome, message_id, backend, sender, rfc_message_id, gmail_thread_id, subject, from_address,
         broadcast_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        purpose,
        letterId,
        address,
        outcome,
        id,
        backend.name,
        from,
        outcome === "sent" ? rfcId : null,
        threadId,
        email.Subject,
        bareAddress(email.From),
        copyId ?? null,
      ],
    );
  if ((await isBlocked(address)) || (!TRANSACTIONAL.has(purpose) && (await doesNotEmail(address)))) {
    await log("refused");
    return { sent: false, reason: "blocked" };
  }
  let id: string;
  let threadId: string | null = null;
  // Whether the email has been handed to the provider: until then, whatever goes wrong, nothing went.
  let handed = false;
  try {
    if (backend.name === "gmail") {
      if (!hooks.gmailAccess) throw new Error(`No way to reach ${backend.account}'s Gmail`);
      const token = await hooks.gmailAccess(backend.account);
      const message = raw ? raw(rfcId!, now()) : undefined;
      handed = true;
      const sent = message
        ? await sendRawGmail(token, message)
        : await sendGmail(token, { ...email, MessageId: rfcId!, Date: now() }, joins);
      id = sent.id;
      threadId = sent.threadId;
      // The Message-ID it went with, which replies and bounces name, if Gmail gave it one of its own.
      rfcId = (await gmailMessageId(token, sent.id)) ?? rfcId;
    } else {
      // Its Message-ID goes with whatever other headers it has.
      const headers = [...(email.Headers ?? []), ...(rfcId ? [{ Name: "Message-ID", Value: `<${rfcId}>` }] : [])];
      handed = true;
      id = await sendEmail(headers.length ? { ...email, Headers: headers } : email, stream);
    }
  } catch (error) {
    if (error instanceof PostmarkError && error.inactive) {
      // Postmark names the suppressed addresses, which may be a Cc rather
      // than the To; failing that, it's the To.
      const named = inactiveAddresses(error.message);
      const inactive = named.length ? named : [address];
      for (const each of inactive) {
        const problem = {
          address: each,
          messageId: null,
          kind: "hard",
          reason: error.message,
          canReset: true,
        } as const;
        if (await recordProblem(problem)) await hooks.blocked(each, error.message);
      }
      if (inactive.includes(address)) {
        await log("refused");
        return { sent: false, reason: "blocked" };
      }
      await log("failed");
      return { sent: false, reason: "failed", detail: error.message };
    }
    problem(
      staffCopy.problems.anywhere.sendFailed(error instanceof GmailError ? `${purpose}, by Gmail as ${from}` : purpose),
      error,
    );
    await log("failed");
    // What the provider said, for whoever looks at the copy that failed.
    const detail = (error as Error).message;
    // The account's or provider's fault, or something before the email was handed over, as getting a token: try later.
    const providers = error instanceof GmailError || error instanceof PostmarkError;
    const fault = accountsFault(error);
    if (fault === "fix") return { sent: false, reason: "failed", retry: true, fixNeeded: true, detail };
    if (fault || (!handed && !providers)) return { sent: false, reason: "failed", retry: true, detail };
    // No answer from the provider at all: it may have taken the email before the connection broke.
    const answered = providers;
    return answered
      ? { sent: false, reason: "failed", detail }
      : { sent: false, reason: "failed", mayHaveGone: true, detail };
  }
  // It went: a failure to log it is reported, never thrown, so no caller takes it for one that didn't.
  await log("sent", id, threadId).catch((error) =>
    problem(staffCopy.problems.anywhere.sentUnrecorded(`An email of type '${purpose}' to ${address}`), error),
  );
  return { sent: true, id, messageId: rfcId, threadId, backend };
}

/**
 * Records a bounce or complaint. A hard bounce or complaint blocks the
 * address, or a complaint takes over a bounce's block, as it can't be reset;
 * the audit log says so. A complaint opts the address out of every bulk
 * email as well (opt-outs.ts). Returns whether it blocked the address.
 */
export async function recordProblem(problem: DeliveryProblem): Promise<boolean> {
  const address = bareAddress(problem.address);
  const canReset = problem.kind !== "complaint" && problem.canReset;
  return transaction(async (db) => {
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO email_problems (address, message_id, kind, reason, can_reset, details, gmail_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::int AS id`,
      [
        address,
        problem.messageId,
        problem.kind,
        problem.reason,
        canReset,
        JSON.stringify(problem.details ?? {}),
        problem.gmailMessageId ?? null,
      ],
      db,
    );
    if (problem.kind === "soft") return false;
    // A complaint is an opt-out of every bulk email too, whoever made it, which CiviCRM is told of.
    if (problem.kind === "complaint") {
      const [copy] = await query<{ id: number }>(
        "SELECT id::int AS id FROM broadcast_messages WHERE provider_message_id = $1",
        [problem.messageId],
        db,
      );
      await recordOptOut(
        {
          address,
          list: "bulk",
          source: "postmark-complaint",
          sourceRef: String(id),
          unsubscribedAt: now(),
          messageId: copy?.id,
        },
        db,
      );
    }
    const blocked = await query(
      `INSERT INTO email_blocks (address, problem_id) VALUES ($1, $2)
       ON CONFLICT (address) DO UPDATE SET problem_id = EXCLUDED.problem_id
       WHERE $3 AND (SELECT kind FROM email_problems WHERE id = email_blocks.problem_id) <> 'complaint'
       RETURNING address`,
      [address, id, problem.kind === "complaint"],
      db,
    );
    if (blocked.length) await logChange(PROVIDER, "block address", { address, kind: problem.kind }, db);
    return blocked.length > 0;
  });
}

/**
 * Lifts an address's block: asks the provider to send to it again, but for
 * a hold in CiviCRM, then deletes its block, and logs who did it and why.
 * Refused without a note of why (the audit log refuses one too), and for a
 * complaint, which only the person can undo. Returns whether it was lifted.
 * Staff unblock an address with unblock() (delivery-problems.ts), which then
 * sends what waited for it.
 */
export async function liftBlock(address: string, staff: string, note: string): Promise<boolean> {
  if (!note.trim()) return false;
  const [block] = await query<{ canReset: boolean; kind: string }>(
    `SELECT p.can_reset AS "canReset", p.kind FROM email_blocks b JOIN email_problems p ON p.id = b.problem_id
     WHERE b.address = $1`,
    [address],
  );
  if (!block?.canReset) return false;
  // A hold is CiviCRM's, which the provider never suppressed.
  if (block.kind !== "hold") await unsuppress(address);
  return transaction(async (db) => {
    const deleted = await query("DELETE FROM email_blocks WHERE address = $1 RETURNING address", [address], db);
    if (deleted.length) await logChange(staff, "unblock address", { address, note }, db);
    return deleted.length > 0;
  });
}

/** A blocked address, for the staff interface. */
export type EmailBlock = {
  address: string;
  kind: "hard" | "complaint" | "hold";
  reason: string;
  /** When the problem that blocked it came. */
  since: Date;
  canReset: boolean;
  /** The bounce was read from a staff member's Gmail, not reported by Postmark. */
  foundInGmail: boolean;
  /** The politicians with this address. */
  politicians: { id: number; name: string; isTest: boolean }[];
  /** The supporters with this address, by the name the supporters list gives them; none on politicians' lists. */
  supporters: { id: number; name: string | null }[];
  /** The letter whose email found it out, if one did, and the politician it was to. */
  letter: SentLetter | null;
  /** What the email that found it out was, if the site has a record of sending it. */
  purpose: Purpose | null;
  /** Emails not sent to it since. */
  refused: number;
};

/**
 * The supporters with an address, found by the address their records were
 * linked on, and named as the supporters list names them: the newest name
 * any of their records gives. Not from the identity view, a union of every
 * source, which Postgres prices too high for a lookup per blocked address
 * (docs/code-structure.md). Only on the lists of addresses that aren't
 * politicians', which only staff who may see supporters open.
 */
const BLOCK_SUPPORTERS = `
    (SELECT coalesce(json_agg(json_build_object('id', x.id, 'name', x.name) ORDER BY x.name COLLATE english NULLS LAST, x.id), '[]')
     FROM (SELECT DISTINCT k.supporter_id::int AS id, l.name
           FROM supporter_links k LEFT JOIN supporters_list l ON l.id = k.supporter_id
           WHERE k.matched_by = 'email' AND k.matched_value = b.address) x)`;

/** The blocked addresses' query, with whose they are: politicians' always, supporters' only `withSupporters`. */
const selectBlocks = (withSupporters: boolean) => `
  SELECT b.address, p.kind, p.reason, p.at AS since, p.can_reset AS "canReset",
    ${withSupporters ? BLOCK_SUPPORTERS : "'[]'::json"} AS supporters,
    p.gmail_message_id IS NOT NULL AS "foundInGmail",
    coalesce((SELECT json_agg(json_build_object('id', pol.id, 'name', pol.name, 'isTest', coalesce(seat.is_test, false)) ORDER BY pol.name COLLATE english)
              FROM notable_people pol LEFT JOIN politicians seat ON seat.id = pol.id WHERE lower(pol.email) = b.address), '[]') AS politicians,
    (SELECT json_build_object('id', l.id, 'to', pol.name)
     FROM email_sends s JOIN letters l ON l.id = s.letter_id JOIN notable_people pol ON pol.id = l.notable_person_id
     WHERE s.message_id = p.message_id) AS letter,
    (SELECT s.purpose FROM email_sends s WHERE s.message_id = p.message_id) AS purpose,
    (SELECT count(*)::int FROM email_sends s WHERE s.address = b.address AND s.outcome = 'refused' AND s.at >= p.at) AS refused
  FROM email_blocks b JOIN email_problems p ON p.id = b.problem_id`;

/**
 * Which addresses a list is of: politicians', or every other, staff's and
 * unknown ones included, which may be supporters'. Each has its own page,
 * so an address that's no longer a politician's moves to the other.
 */
export type EmailScope = "politicians" | "others";

/** Whether `column` is a politician's address, or isn't, for `scope`. */
function inScope(column: string, scope: EmailScope): string {
  return `${scope === "politicians" ? "" : "NOT "}EXISTS (SELECT 1 FROM notable_people pol WHERE lower(pol.email) = ${column})`;
}

/** Whether an address is a politician's. */
export async function isPoliticianAddress(address: string): Promise<boolean> {
  const [row] = await query(`SELECT 1 WHERE ${inScope("$1", "politicians")}`, [bareAddress(address)]);
  return !!row;
}

/** Which blocked addresses to list: those blocked by a hard bounce, a complaint or a hold, and those with `search` in them. */
export type BlocksFilter = { kind?: "hard" | "complaint" | "hold"; search?: string };

/** Every blocked address in `scope` that `filter` lets through, newest first. */
export async function listBlocks(scope: EmailScope, filter: BlocksFilter = {}): Promise<EmailBlock[]> {
  return query<EmailBlock>(
    `${selectBlocks(scope === "others")} WHERE ($1::text IS NULL OR p.kind = $1) AND ($2::text IS NULL OR b.address ILIKE $2)
       AND ${inScope("b.address", scope)} ORDER BY p.at DESC, b.address`,
    [filter.kind ?? null, filter.search ? `%${filter.search}%` : null],
  );
}

/** The block on an address, if it has one, such as a politician's, who may have none. */
export async function blockOn(address: string | null): Promise<EmailBlock | undefined> {
  if (!address) return undefined;
  const [block] = await query<EmailBlock>(`${selectBlocks(false)} WHERE b.address = $1`, [bareAddress(address)]);
  return block;
}

/** A letter an email was, for the staff interface: its ID and the name of the politician it was to. */
export type SentLetter = { id: number; to: string };

/** A bounce or complaint, for the staff interface. */
export type ProblemSummary = {
  id: number;
  at: Date;
  address: string;
  kind: DeliveryProblem["kind"];
  reason: string;
  /** Read from a staff member's Gmail, not reported by Postmark. */
  foundInGmail: boolean;
  /** What the email was, if we sent it. */
  purpose: Purpose | null;
  /** The letter it was, if it was one, and the politician it was to. */
  letter: SentLetter | null;
};

/** The latest bounces and complaints to addresses in `scope`, soft bounces too, newest first. */
export async function recentProblems(scope: EmailScope, limit = 100): Promise<ProblemSummary[]> {
  return query<ProblemSummary>(
    `SELECT p.id::int AS id, p.at, p.address, p.kind, p.reason, s.purpose, p.gmail_message_id IS NOT NULL AS "foundInGmail",
       CASE WHEN pol.id IS NOT NULL THEN json_build_object('id', l.id, 'to', pol.name) END AS letter
     FROM email_problems p LEFT JOIN email_sends s ON s.message_id = p.message_id
       LEFT JOIN letters l ON l.id = s.letter_id LEFT JOIN notable_people pol ON pol.id = l.notable_person_id
     WHERE ${inScope("p.address", scope)}
     ORDER BY p.at DESC, p.id DESC LIMIT $1`,
    [limit],
  );
}
