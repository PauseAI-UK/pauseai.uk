import "server-only";
import { AUTO_REPLY_PATTERN } from "@/lib/email-parsing/subjects";
import { NEVER_WENT, statusIn } from "@/lib/letter-status";
import { PARLIAMENT_DOMAINS } from "@/lib/one-off";
import { bookAddresses } from "./book";

// How many emails went to a politician, and how many came from them, in
// SQL, so the politicians list has them for everyone at once and sorts by
// them. A politician's row carries them (SELECT_POLITICIANS in
// politicians.ts), so the list and their page show the same numbers. They
// count what the page's threads show (politicianMessages in
// politician-correspondence.ts), which is worked out in TypeScript:
// politician-email-counts.test.ts holds the two together.

/** Whether a machine sent the letter reply `r`: the read that kept it logged it as an automatic reply. */
export const AUTO_REPLY = `EXISTS (SELECT 1 FROM letter_events e WHERE e.letter_id = r.letter_id AND e.status = 'auto_reply'
  AND e.details->>'gmailMessageId' = r.gmail_message_id)`;

/** What follows the last @ of the one-off message `m`'s sender, as domainOf (lib/one-off.ts) gives it. */
const DOMAIN = "split_part(m.from_address, '@', -1)";

/** Whether that's a parliament's domain or under one, as onParliamentDomain (lib/one-off.ts). */
const ON_PARLIAMENT = PARLIAMENT_DOMAINS.map(
  (domain) => `right('.' || ${DOMAIN}, ${domain.length + 1}) = '.${domain}'`,
).join(" OR ");

/**
 * Every one-off message `m` with each politician its thread is linked to
 * (`tp`), and beside it what says whose office it's from: `known`, whose
 * its sender's address is in the politician book, offices' addresses and
 * all, if it's anyone's; and `own`, whose its domain is, if a politician's.
 */
const ONE_OFFS = `one_off_thread_people tp JOIN one_off_messages m ON m.thread_id = tp.thread_id
    LEFT JOIN (SELECT address, array_agg(id) AS ids FROM (${bookAddresses("TRUE")}) book GROUP BY address) known
      ON known.address = m.from_address
    LEFT JOIN politician_domains own ON own.domain = ${DOMAIN}`;

/**
 * Whether a message of ONE_OFFS is from the politician's office, as the
 * page's threads have it: from any parliament's address, or else from an
 * address of theirs in the book, or, for an address that's no one's in the
 * book, from a domain of their own (politiciansOf in lib/one-off.ts; an
 * address it knows by its form is a parliament's).
 */
const FROM_OFFICE = `(${ON_PARLIAMENT} OR CASE WHEN known.address IS NOT NULL
    THEN coalesce(tp.notable_person_id::int = ANY(known.ids), false)
    ELSE coalesce(own.notable_person_id = tp.notable_person_id, false) END)`;

// `whose.office` is FROM_OFFICE, worked out once a message: OFFSET 0 keeps `whose` a subquery of its own, where
// Postgres would otherwise write the whole test into each FILTER and work it out again for each.
const TO_THEM = "NOT whose.office";
const FROM_THEM = `whose.office AND NOT m.from_us AND m.subject !~* '${AUTO_REPLY_PATTERN}'`;

/**
 * Each politician's one-off messages, counted each way, a row for each with
 * any: to them, those from anyone but their office, as people copy policy@
 * into theirs to them; from them, those from their office that aren't ours
 * or, by the subject, a machine's (isMachineReply in
 * lib/email-parsing/subjects.ts, given no headers); and when the first and
 * the last of those counted either way was sent. Every thread's messages
 * are read once a statement, not once a politician.
 */
const ONE_OFF_COUNTS = `SELECT tp.notable_person_id AS id,
    count(*) FILTER (WHERE ${TO_THEM}) AS to_them, count(*) FILTER (WHERE ${FROM_THEM}) AS from_them,
    min(m.at) FILTER (WHERE ${TO_THEM} OR ${FROM_THEM}) AS first_at,
    max(m.at) FILTER (WHERE ${TO_THEM} OR ${FROM_THEM}) AS last_at
  FROM ${ONE_OFFS} CROSS JOIN LATERAL (SELECT ${FROM_OFFICE} AS office OFFSET 0) whose
  GROUP BY tp.notable_person_id`;

/**
 * What a SELECT of politicians takes to count their emails, when it has a
 * row for each (GROUP BY) of `n`, their notable_people row: the join after
 * `n`, the two counts, and when the first and the last one-off message
 * they count was sent, for the politician's activity (POLITICIAN_ACTIVITY
 * in politicians.ts).
 */
export const EMAIL_COUNTS = {
  join: `LEFT JOIN (${ONE_OFF_COUNTS}) o ON o.id = n.id`,
  firstOneOff: "min(o.first_at)",
  lastOneOff: "max(o.last_at)",
  /** The emails that went to them: the letters to them that went, and the one-off messages to them. */
  toThem: `((SELECT count(*) FROM letters l
      WHERE l.notable_person_id = n.id AND NOT ${statusIn("l.status", NEVER_WENT)}) + coalesce(max(o.to_them), 0))::int`,
  /**
   * The emails that came from them: each reply kept on a letter to them
   * that isn't ours, the supporter's or automatic, and the one-off messages
   * from them. Rough, as whether a one-off message was automatic is mostly
   * in the message itself, which isn't read here.
   */
  fromThem: `((SELECT count(*) FROM letters l JOIN letter_replies r ON r.letter_id = l.id
      WHERE l.notable_person_id = n.id AND NOT r.from_us AND NOT r.from_supporter AND NOT ${AUTO_REPLY})
    + coalesce(max(o.from_them), 0))::int`,
};
