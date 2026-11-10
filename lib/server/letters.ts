import "server-only";
import { ARRIVED, DID_NOT_ARRIVE, statusIn } from "@/lib/letter-status";
import { cache } from "react";
import { config } from "./config";
import type { AskStatus } from "@/lib/asks";
import type { Permission } from "@/lib/staff-permissions";
import type { LetterBackend, LetterFilter } from "@/lib/staff-search";
import {
  messageIdSearch,
  POLICY_GMAIL_SINCE,
  postmarkSearch,
  sentNearSearch,
  type GmailFind,
} from "@/lib/letter-links";
import type { LetterSort } from "@/lib/staff-lists";
import type { PoliticianFlag } from "@/lib/politician-filters";
import { checkDoc, toText } from "@/lib/letter-format";
import { query } from "./db";
import { threadMessages, type ThreadMessage } from "./letter-threads";
import { lettersInbox } from "./letters-inbox";
import type { SkipReason } from "./mailings";
import { FLAG_CONDITIONS } from "./politicians";

// Letters, for the staff interface.

export type LetterEvent = { at: Date; status: string; details: Record<string, unknown> };

/** A list built with json_build_object, as it comes back: its times as text. */
type AsJson<T extends { at: Date }> = Omit<T, "at"> & { at: string };

/** Each item's `at` as a Date, as a column's would be. */
function withDates<T extends { at: Date }>(list: AsJson<T>[]): T[] {
  return list.map((item) => ({ ...item, at: new Date(item.at) }) as T);
}

/**
 * Why a reply was forwarded to someone or not, or why its forward failed:
 * the shared inbox gets every reply; the sender gets one they weren't sent,
 * unless it's their own follow-up or they're already in its To or Cc; one
 * that came to the bounce address, or was read from Gmail, goes nowhere;
 * and a forward fails when Postmark refuses it or the address is blocked.
 */
export type HandlingReason =
  "policy_inbox" | "sender" | "copied" | "own_follow_up" | "bounce_address" | "gmail" | "refused" | "blocked";

/**
 * One thing done with a reply, in its event's `handling`: forwarded to `to`,
 * not forwarded (to `to`, or to anyone), or a forward that failed; why, and
 * when a forward went.
 */
export type ReplyHandling = {
  outcome: "forwarded" | "not_forwarded" | "failed";
  to?: string;
  reason?: HandlingReason;
  at?: string;
};

/** A forward of a reply to a letter, as its send was logged: for the history of replies recorded before their handling was. */
export type LetterForward = { at: Date; address: string; outcome: string };

export type LetterSummary = {
  id: number;
  campaign: string;
  /** The campaign's title, as the campaigns table has it. */
  campaignTitle: string;
  /** Where an old campaign's letter can be read, as the campaigns table has it. */
  status: string;
  senderName: string;
  senderEmail: string;
  mpName: string;
  politicianId: number;
  isTest: boolean;
  /** The politician's seat and party, and their answer to the campaign's ask, if any. */
  constituency: string | null;
  party: string | null;
  answer: AskStatus | null;
  /** The share of its words, from 0 to 1, that weren't in the campaign's draft; none for one with no draft, as from Airtable. */
  ownWords: number | null;
  /** What sent it; none for one of this site's never sent. */
  backend: LetterBackend | null;
  createdAt: Date;
  sentAt: Date | null;
  /** When a reply from anyone but the sender first reached us. */
  repliedAt: Date | null;
  /** When an automatic reply, such as an office's acknowledgement, first did. */
  autoRepliedAt: Date | null;
  /** The supporter the sender is, once linked. */
  supporterId: number | null;
  events: LetterEvent[];
};

/** When a letter `l` first got an automatic reply, if it has. */
const AUTO_REPLIED_AT = "(SELECT min(e.at) FROM letter_events e WHERE e.letter_id = l.id AND e.status = 'auto_reply')";

/**
 * Each sort's column in the query. The reply's is the date the list shows:
 * a written reply's, or failing one an automatic reply's.
 */
const LETTER_COLUMNS: Record<LetterSort, string> = {
  status: "l.status",
  from: "f.name",
  to: "n.name",
  campaign: "c.title",
  ownWords: "s.own_words",
  backend: '"backend"',
  created: "l.created_at",
  sent: "l.sent_at",
  replied: `coalesce(l.replied_at, ${AUTO_REPLIED_AT})`,
};

/** How many letters the letters page shows at once. */
export const LETTERS_PAGE_SIZE = 100;

export type LettersPage = { letters: LetterSummary[]; total: number; pages: number; pageSize: number };

/** One page of the letters page's list, in its sort, and how many the filter finds in all. */
export async function listLetters({ page = 1, ...filter }: LetterFilter & { page?: number }): Promise<LettersPage> {
  const rows = await letterRows({ ...filter, limit: LETTERS_PAGE_SIZE, offset: (page - 1) * LETTERS_PAGE_SIZE });
  // A page past the end has no rows to carry the count, so it counts again from the first.
  const total = rows[0]?.total ?? (page > 1 ? ((await letterRows({ ...filter, limit: 1 }))[0]?.total ?? 0) : 0);
  return {
    letters: rows.map(withoutTotal),
    total,
    pages: Math.max(1, Math.ceil(total / LETTERS_PAGE_SIZE)),
    pageSize: LETTERS_PAGE_SIZE,
  };
}

function withoutTotal(row: LetterSummary & { total: number }): LetterSummary {
  const letter: Partial<typeof row> = { ...row };
  delete letter.total;
  return letter as LetterSummary;
}

/**
 * Letters, newest written first unless the filter sorts them, filtered (LetterFilter), or only those to
 * one politician; the newest 200, or `limit`, or with null every one.
 */
export async function recentLetters(filter: LetterFilter & { politicianId?: number; limit?: number | null } = {}) {
  return (await letterRows(filter)).map(withoutTotal);
}

/**
 * What sent a supporter's letter `s`: Airtable, for one copied from it,
 * or the backend of its newest send that went.
 */
const BACKEND = `CASE WHEN s.airtable_id IS NOT NULL THEN 'airtable' ELSE (SELECT e.backend FROM email_sends e
  WHERE e.letter_id = s.id AND e.purpose = 'letter' AND e.outcome = 'sent' ORDER BY e.at DESC, e.id DESC LIMIT 1) END`;

/** Letters as recentLetters finds them, from `offset`, each with how many the filter finds in all. */
async function letterRows({
  status,
  search,
  answered,
  campaign,
  flags,
  backend,
  tab,
  supporterId,
  letterId,
  politicianId,
  limit = 200,
  offset = 0,
  not,
  sort = { key: "created", dir: "desc" },
}: LetterFilter & { politicianId?: number; limit?: number | null; offset?: number }): Promise<
  (LetterSummary & { total: number })[]
> {
  // Each marker's condition is SQL of our own (FLAG_CONDITIONS), so it goes in the query as it is.
  const marked = (flags: PoliticianFlag[]) => `(${flags.map((flag) => FLAG_CONDITIONS[flag]).join(" OR ")})`;
  const flagConditions = [flags && marked(flags), not?.flags && `${marked(not.flags)} IS NOT TRUE`]
    .filter(Boolean)
    .map((condition) => `AND ${condition}`)
    .join(" ");
  const rows = await query<Omit<LetterSummary, "events"> & { events: AsJson<LetterEvent>[]; total: number }>(
    `SELECT l.id::int AS id, s.campaign, c.title AS "campaignTitle", l.status, f.name AS "senderName", f.email AS "senderEmail",
       n.name AS "mpName", n.id::int AS "politicianId", p.is_test AS "isTest", p.constituency, p.party,
       (SELECT st.status FROM ask_statuses st WHERE st.notable_person_id = n.id AND st.ask = c.ask) AS answer, s.own_words AS "ownWords", ${BACKEND} AS backend, l.created_at AS "createdAt", l.sent_at AS "sentAt", l.replied_at AS "repliedAt",
       ${AUTO_REPLIED_AT} AS "autoRepliedAt",
       (SELECT k.supporter_id::int FROM supporter_links k WHERE k.form_entry_id = s.entry_id) AS "supporterId",
       coalesce((SELECT json_agg(json_build_object('at', e.at, 'status', e.status, 'details', e.details) ORDER BY e.at DESC, e.id DESC)
                 FROM letter_events e WHERE e.letter_id = l.id), '[]') AS events,
       count(*) OVER ()::int AS total
     FROM letters_from_supporters s JOIN letters l ON l.id = s.id JOIN form_entries f ON f.id = s.entry_id
       JOIN campaigns c ON c.slug = s.campaign JOIN notable_people n ON n.id = l.notable_person_id JOIN politicians p ON p.id = n.id
     WHERE ($1::text IS NULL OR l.status = $1)
       AND ($3::bigint IS NULL OR l.notable_person_id = $3)
       AND ($4::text IS NULL OR f.name ILIKE $4 OR f.email ILIKE $4 OR n.name ILIKE $4)
       AND ($5::text IS NULL OR CASE WHEN l.replied_at IS NOT NULL THEN 'yes'
         WHEN ${AUTO_REPLIED_AT} IS NOT NULL THEN 'auto' ELSE 'no' END = $5)
       AND ($6::bigint IS NULL OR EXISTS (SELECT 1 FROM supporter_links k WHERE k.form_entry_id = s.entry_id AND k.supporter_id = $6))
       AND ($7::bigint IS NULL OR l.id = $7)
       AND ($8::text[] IS NULL OR s.campaign = ANY($8))
       AND ($10::text[] IS NULL OR s.campaign <> ALL($10))
       AND ($11::text[] IS NULL OR ${BACKEND} = ANY($11))
       AND ($12::text[] IS NULL OR (${BACKEND} = ANY($12)) IS NOT TRUE)
       AND ($13::text IS NULL OR CASE $13 WHEN 'changed' THEN s.own_words > 0 WHEN 'replied' THEN l.replied_at IS NOT NULL
         WHEN 'sent' THEN ${statusIn("l.status", ARRIVED)}
         WHEN 'answered' THEN EXISTS (SELECT 1 FROM ask_statuses st WHERE st.notable_person_id = n.id AND st.ask = c.ask)
         ELSE ${statusIn("l.status", DID_NOT_ARRIVE)} END) ${flagConditions}
     ORDER BY ${LETTER_COLUMNS[sort.key]} ${sort.dir === "asc" ? "ASC" : "DESC"} NULLS LAST, l.created_at DESC, l.id DESC
     LIMIT $2 OFFSET $9`,
    [
      status ?? null,
      limit,
      politicianId ?? null,
      search ? `%${search}%` : null,
      answered ?? null,
      supporterId ?? null,
      letterId ?? null,
      campaign ?? null,
      offset,
      not?.campaign ?? null,
      backend ?? null,
      not?.backend ?? null,
      tab ?? null,
    ],
  );
  return rows.map((row) => ({ ...row, events: withDates(row.events) }));
}

/** A letter of a mailing from PauseAI to a politician: when, which mailing, and whether it was personalised. */
export type PauseaiLetter = {
  id: number;
  mailingId: number;
  mailing: string;
  status: string;
  /** When it was sent, or else made. */
  at: Date;
  personalised: boolean;
};

/** PauseAI's letters to a politician, newest first. */
export async function pauseaiLetters(politicianId: number): Promise<PauseaiLetter[]> {
  return query<PauseaiLetter>(
    `SELECT l.id::int AS id, m.id::int AS "mailingId", m.title AS mailing, l.status, coalesce(l.sent_at, l.created_at) AS at, p.personalised
     FROM letters_from_pauseai p JOIN letters l USING (id) JOIN mailings m ON m.id = p.mailing_id
     WHERE l.notable_person_id = $1 ORDER BY l.created_at DESC, l.id DESC`,
    [politicianId],
  );
}

/**
 * A supporter's letter, for its own page: what the list has, its subject,
 * its MP's address, its campaign's ask, if any, by its slug, and where to
 * find its copy in Gmail.
 */
export type SupporterLetterDetails = LetterSummary & {
  kind: "supporter";
  subject: string;
  mpEmail: string | null;
  campaignAsk: string | null;
  gmail: GmailFind | null;
  /** Every forward of a reply to it, oldest first. */
  forwards: LetterForward[];
  /** For one with its text kept: its text as sent, and the draft it was written from, if kept. Null for others. */
  sent: { text: string; draft: string | null } | null;
  /** Every message kept of its thread, oldest first, whether or not its own text is. */
  messages: ThreadMessage[];
};

/** One of PauseAI's letters, for its own page: to whom, at which address now, in which mailing, and what happened. */
export type PauseaiLetterDetails = {
  kind: "pauseai";
  id: number;
  status: string;
  /** Why it wasn't sent, for one skipped. */
  skipReason: SkipReason | null;
  createdAt: Date;
  sentAt: Date | null;
  /** When a reply from anyone but us first reached us. */
  repliedAt: Date | null;
  mpName: string;
  politicianId: number;
  mpEmail: string | null;
  mailingId: number;
  mailing: string;
  /** The ask the mailing makes, if any, by its slug. */
  mailingAsk: string | null;
  personalised: boolean;
  /** What sent it: Airtable, for one copied from it, else a staff member's Gmail; none for one never sent. */
  backend: LetterBackend | null;
  /** Where to find it in Gmail, if it went. */
  gmail: GmailFind | null;
  events: LetterEvent[];
};

export type LetterDetails = SupporterLetterDetails | PauseaiLetterDetails;

/**
 * What a PauseAI letter's way into Gmail is made of: the mailbox it went
 * from, the Message-ID it went with, if kept, and its first reply's, with
 * the mailbox that read it.
 */
type PauseaiInGmail = {
  sentFrom: string | null;
  sentId: string | null;
  reply: { id: string; account: string } | null;
};

/**
 * Where to find PauseAI's letter in Gmail: by the Message-ID it went with,
 * in the mailbox it went from; or, for one copied from Airtable, which kept
 * none, by a reply's, in the mailbox that read it; or else by its MP's
 * address and when it went. Nothing for one that never went.
 */
function pauseaiGmail(
  { sentAt, mpEmail }: Pick<PauseaiLetterDetails, "sentAt" | "mpEmail">,
  { sentFrom, sentId, reply }: PauseaiInGmail,
): GmailFind | null {
  if (sentId) return { mailbox: sentFrom, search: messageIdSearch(sentId) };
  if (reply) return { mailbox: reply.account, search: messageIdSearch(reply.id) };
  if (!sentAt || !mpEmail) return null;
  return { mailbox: sentFrom, search: sentNearSearch(mpEmail, sentAt) };
}

/**
 * PauseAI's letter `id`, for its page under mailing `mailingId`, or
 * undefined if that mailing has no such letter.
 */
export const getPauseaiLetter = cache(async function getPauseaiLetter(
  mailingId: number,
  id: number,
): Promise<PauseaiLetterDetails | undefined> {
  const [row] = await query<
    Omit<PauseaiLetterDetails, "gmail" | "events"> & { inGmail: PauseaiInGmail; events: AsJson<LetterEvent>[] }
  >(
    `SELECT 'pauseai' AS kind, l.id::int AS id, l.status, p.skip_reason AS "skipReason", l.created_at AS "createdAt",
       l.sent_at AS "sentAt", l.replied_at AS "repliedAt",
       n.name AS "mpName", n.id::int AS "politicianId", n.email AS "mpEmail", m.id::int AS "mailingId",
       m.title AS mailing, m.ask AS "mailingAsk", p.personalised,
       CASE WHEN p.airtable_id IS NOT NULL THEN 'airtable' WHEN l.sent_at IS NOT NULL THEN 'gmail' END AS backend,
       json_build_object(
         'sentFrom', m.sent_from,
         'sentId', (SELECT s.rfc_message_id FROM email_sends s
                    WHERE s.letter_id = l.id AND s.outcome = 'sent' ORDER BY s.id DESC LIMIT 1),
         'reply', (SELECT json_build_object('id', r.rfc_message_id, 'account', r.account)
                   FROM letter_replies r WHERE r.letter_id = l.id AND r.rfc_message_id IS NOT NULL
                   ORDER BY r.at, r.id LIMIT 1)
       ) AS "inGmail",
       coalesce((SELECT json_agg(json_build_object('at', e.at, 'status', e.status, 'details', e.details) ORDER BY e.at DESC, e.id DESC)
                 FROM letter_events e WHERE e.letter_id = l.id), '[]') AS events
     FROM letters_from_pauseai p JOIN letters l USING (id) JOIN mailings m ON m.id = p.mailing_id
       JOIN notable_people n ON n.id = l.notable_person_id
     WHERE l.id = $1 AND p.mailing_id = $2`,
    [id, mailingId],
  );
  if (!row) return undefined;
  const { inGmail, events, ...letter } = row;
  return { ...letter, events: withDates(events), gmail: pauseaiGmail(letter, inGmail) };
});

/**
 * Where to find a letter's copy Bcc'd to the policy inbox: by the Message-ID of
 * the newest send Postmark made of it, or, for one copied from Airtable, by its
 * MP's address and when it went; in its members' mail for one sent while the
 * policy inbox was a Google Group (POLICY_GMAIL_SINCE).
 */
function policyCopy(postmarkId: string | null, mpEmail: string | null, sentAt: Date | null): GmailFind | null {
  const search = postmarkId ? postmarkSearch(postmarkId) : sentAt && mpEmail && sentNearSearch(mpEmail, sentAt);
  if (!search) return null;
  const group = sentAt !== null && sentAt < POLICY_GMAIL_SINCE;
  return { mailbox: config.policyInbox ?? null, search, ...(group ? { inPolicyGroup: true as const } : {}) };
}

/**
 * A supporter's letter `id`, for its page, or undefined if there's none:
 * PauseAI's letters have theirs under their mailing. One with its text kept
 * shows it, and is found by the Message-ID it went with where it has one, or
 * else by its copy in the policy inbox (policyCopy).
 */
export const getSupporterLetter = cache(async function getSupporterLetter(
  id: number,
): Promise<SupporterLetterDetails | undefined> {
  const [letter] = await recentLetters({ letterId: id });
  if (!letter) return undefined;
  const [{ subject, postmarkId, rfcId, sentBy, mpEmail, campaignAsk, forwards: json, doc, draft }] = await query<{
    subject: string;
    postmarkId: string | null;
    rfcId: string | null;
    sentBy: string | null;
    mpEmail: string | null;
    campaignAsk: string | null;
    forwards: AsJson<LetterForward>[];
    doc: unknown;
    draft: string | null;
  }>(
    `SELECT s.subject, c.ask AS "campaignAsk", (SELECT e.message_id FROM email_sends e WHERE e.letter_id = s.id AND e.purpose = 'letter'
       AND e.outcome = 'sent' ORDER BY e.at DESC, e.id DESC LIMIT 1) AS "postmarkId",
       (SELECT e.rfc_message_id FROM email_sends e WHERE e.letter_id = s.id AND e.purpose = 'letter'
        AND e.outcome = 'sent' ORDER BY e.at DESC, e.id DESC LIMIT 1) AS "rfcId",
       (SELECT e.sender FROM email_sends e WHERE e.letter_id = s.id AND e.purpose = 'letter' AND e.imported
        ORDER BY e.at DESC, e.id DESC LIMIT 1) AS "sentBy",
       s.letter AS doc, s.draft, n.email AS "mpEmail",
       coalesce((SELECT json_agg(json_build_object('at', e.at, 'address', e.address, 'outcome', e.outcome) ORDER BY e.at, e.id)
                 FROM email_sends e WHERE e.letter_id = s.id AND e.purpose = 'forwarded-reply'), '[]') AS forwards
     FROM letters_from_supporters s JOIN letters l USING (id) JOIN notable_people n ON n.id = l.notable_person_id
       JOIN campaigns c ON c.slug = s.campaign
     WHERE s.id = $1`,
    [id],
  );
  const forwards = withDates(json);
  const sentDoc = checkDoc(doc);
  const messages = await threadMessages(id);
  if (sentDoc) {
    // Kept here, and found in the mailbox it went from by the Message-ID it went with: the letters inbox, or for one the
    // import read, Joseph's.
    const sent = { text: toText(sentDoc), draft };
    const gmail = rfcId
      ? { mailbox: sentBy ?? lettersInbox() ?? null, search: messageIdSearch(rfcId) }
      : postmarkId
        ? policyCopy(postmarkId, mpEmail, letter.sentAt)
        : null;
    return { ...letter, kind: "supporter", subject, mpEmail, campaignAsk, gmail, forwards, sent, messages };
  }
  const gmail = policyCopy(postmarkId, mpEmail, letter.sentAt);
  return { ...letter, kind: "supporter", subject, mpEmail, campaignAsk, gmail, forwards, sent: null, messages };
});

/** A letter on an MP's page for staff without `supporters`: what happened to it, and nothing of who wrote it. */
export type UnsignedLetter = Pick<
  LetterSummary,
  "id" | "campaign" | "campaignTitle" | "status" | "createdAt" | "repliedAt"
>;

/** An MP's letters: with their senders, or without. */
export type PoliticianLetters =
  { senders: true; letters: LetterSummary[] } | { senders: false; letters: UnsignedLetter[] };

/** The letters to a politician, newest first, selecting nothing of their senders, so none reach the page. */
async function unsignedLetters(politicianId: number, limit = 200): Promise<UnsignedLetter[]> {
  return query<UnsignedLetter>(
    `SELECT l.id::int AS id, s.campaign, c.title AS "campaignTitle", l.status, l.created_at AS "createdAt", l.replied_at AS "repliedAt"
     FROM letters_from_supporters s JOIN letters l ON l.id = s.id JOIN campaigns c ON c.slug = s.campaign
     WHERE l.notable_person_id = $1 ORDER BY l.created_at DESC, l.id DESC LIMIT $2`,
    [politicianId, limit],
  );
}

/** The letters to a politician, for a staff member: who sent them only with `supporters`. */
export async function politicianLetters(
  politicianId: number,
  permissions: readonly Permission[],
): Promise<PoliticianLetters> {
  return permissions.includes("supporters")
    ? { senders: true, letters: await recentLetters({ politicianId }) }
    : { senders: false, letters: await unsignedLetters(politicianId) };
}
