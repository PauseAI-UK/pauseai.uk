import "server-only";
import { AUTO_REPLY_PATTERN } from "@/lib/email-parsing/subjects";
import { NEVER_WENT, statusIn } from "@/lib/letter-status";
import { PARLIAMENT_DOMAINS } from "@/lib/one-off";
import { bookAddresses } from "./politician-book";

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
 * Whether the one-off message `m` is from the office of the politician its
 * thread is linked to by `tp`, as the page's threads have it: from any
 * parliament's address, or else from an address of theirs in the book
 * (`book`, the WITH query), or, for an address that's no one's in the book,
 * from a domain of their own (politiciansOf in lib/one-off.ts; an address
 * it knows by its form is a parliament's).
 */
const FROM_OFFICE = `(${ON_PARLIAMENT} OR CASE WHEN m.from_address IN (SELECT address FROM book)
    THEN ((m.from_address, tp.notable_person_id::int) IN (SELECT address, id FROM book)) IS TRUE
    ELSE (${DOMAIN}, tp.notable_person_id) IN (SELECT domain, notable_person_id FROM politician_domains) END)`;

/**
 * Each politician's one-off messages, counted each way, a row for each with
 * any: to them, those from anyone but their office, as people copy policy@
 * into theirs to them; from them, those from their office that aren't ours
 * or, by the subject, a machine's (isMachineReply in
 * lib/email-parsing/subjects.ts, given no headers). Every thread's messages
 * are read once a statement, not once a politician.
 */
const ONE_OFF_COUNTS = `SELECT id, count(*) FILTER (WHERE NOT office) AS to_them,
    count(*) FILTER (WHERE office AND NOT from_us AND subject !~* '${AUTO_REPLY_PATTERN}') AS from_them
  FROM (SELECT tp.notable_person_id AS id, m.from_us, m.subject, ${FROM_OFFICE} AS office
    FROM one_off_thread_people tp JOIN one_off_messages m ON m.thread_id = tp.thread_id) each
  GROUP BY id`;

/**
 * What a SELECT of politicians takes to count their emails, when it has a
 * row for each (GROUP BY) of `n`, their notable_people row: its WITH query,
 * the join after `n`, and the two columns.
 */
export const EMAIL_COUNTS = {
  /** The politician book's addresses, offices' and all: read once a statement, and only when a one-off message is counted. */
  with: `book AS MATERIALIZED (${bookAddresses("TRUE")})`,
  join: `LEFT JOIN (${ONE_OFF_COUNTS}) o ON o.id = n.id`,
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
