import "server-only";
import { now } from "@/lib/now";
import { mailboxes } from "@/lib/email-parsing/addresses";
import { isAtPauseai, PARLIAMENT_DOMAINS, politicianAddresses, type PoliticianBook } from "@/lib/one-off";
import { windowStart } from "@/lib/staff-dashboard";
import { ALL_LETTERS_PAGE_SIZE, type AllLettersFilter } from "@/lib/staff-search";
import { query } from "./db";
import { sql, type Sql } from "./sql";
import { threadsWithSomeoneElse } from "./one-off-emails";
import type { AllEmailsSort } from "@/lib/staff-lists";
import type { PoliticianFlag } from "@/lib/politician-filters";
import { politicianBook } from "./politician-book";
import { FLAG_CONDITIONS } from "./politicians";
import { REPLIES } from "./reply-count";

// The correspondence page: every email with a politician, a row for each
// letter, a supporter's or from one of PauseAI's mailings, and for each one-off
// thread. Those with test MPs are left out, as the dashboard's tiles leave them
// out too, unless the filter asks for test politicians.

type AnyLetterBase = {
  id: number;
  status: string;
  sentAt: Date | null;
  repliedAt: Date | null;
  /** A letter's replies from the politician's office, as reply-count.ts counts them; 0 for a one-off thread. */
  replies: number;
};

/** One who a letter or thread is with. */
export type EmailPerson = { id: number; name: string };

/** One a thread's first message was to. */
export type EmailRecipient = { name: string; politicianId: number | null; pauseai: boolean };

/** A row of the correspondence page: a supporter's letter, with its campaign; PauseAI's, with its mailing; or a one-off thread. */
export type AnyLetter = AnyLetterBase &
  (
    | {
        kind: "supporter";
        people: EmailPerson[];
        senderName: string;
        senderEmail: string;
        supporterId: number | null;
        campaign: string;
        campaignTitle: string;
      }
    | { kind: "pauseai"; people: EmailPerson[]; mailingId: number; mailingTitle: string }
    | {
        kind: "one-off";
        people: EmailPerson[];
        senderName: string;
        senderEmail: string;
        /** Whether its first message is from one of PauseAI's addresses. */
        fromUs: boolean;
        /** Who its first message was to: PauseAI once, and each other by name, a politician with their ID. */
        recipients: EmailRecipient[];
        subject: string;
      }
  );

export type AllLettersFound = { letters: AnyLetter[]; total: number; pages: number };

/** Parliaments' domains and any subdomain of them, as a regular expression over an address. */
const PARLIAMENT_ADDRESS = `@(.+\\.)?(${PARLIAMENT_DOMAINS.join("|").replace(/\./g, "\\.")})$`;

/** Those on a To line: PauseAI once, however many of us, first; a politician of the thread's `known` by their name; each other by the line's name, or address with none. */
function recipientsOf(line: string, book: PoliticianBook, known: EmailPerson[]): EmailRecipient[] {
  const people = mailboxes(line);
  const politicians = politicianAddresses(
    book,
    people.map((person) => person.address),
  );
  const others = people.filter((person) => !isAtPauseai(person.address));
  return [
    ...(others.length < people.length ? [{ name: "", politicianId: null, pauseai: true }] : []),
    ...others.map(({ name, address }) => ({
      name: known.find((person) => person.id === politicians[address])?.name ?? (name || address),
      politicianId: politicians[address] ?? null,
      pauseai: false,
    })),
  ];
}

/** The politician book's addresses and domains, and parliaments', as values to put in a query once. */
type BookValues = { addresses: Sql; domains: Sql; parliament: Sql };

/** Whether an address is a politician's, by `book`: as lib/one-off.ts tells, in SQL. */
const fromPolitician = (address: string, book: BookValues) => {
  const column = sql.raw(address);
  return sql`(${column} = ANY(${book.addresses}) OR split_part(${column}, '@', 2) = ANY(${book.domains}) OR ${column} ~ ${book.parliament})`;
};

/** Each sort's column in the query: a row's politicians by the first's name. */
const SORT_COLUMNS: Record<AllEmailsSort, string> = {
  status: "e.status",
  from: "lower(e.sender_name)",
  to: "lower(e.people->0->>'name')",
  topic: "lower(e.about)",
  sent: "e.sent_at",
  replied: "e.replied_at",
};

/** Whether one of a row's politicians has any of `flags` (FLAG_CONDITIONS, SQL of our own). */
const anyMarked = (flags: PoliticianFlag[]) =>
  sql`EXISTS (SELECT 1 FROM json_array_elements(e.people) person JOIN politicians p ON p.id = (person->>'id')::bigint
    JOIN notable_people n ON n.id = p.id WHERE ${sql.or(flags.map((flag) => sql.raw(FLAG_CONDITIONS[flag])))})`;

/** A row's type, as EMAIL_TYPES. */
const TYPE_OF = sql`CASE e.kind WHEN 'supporter' THEN 'campaign' WHEN 'pauseai' THEN 'mailing' ELSE 'one-off' END`;

/** A politician the To filter offers. */
export type EmailChoice = { id: number; name: string; constituency: string | null };

/**
 * Every politician with an email on the page, for the To filter, by name, but
 * test MPs; without `supporters`, only among the emails those staff can see.
 */
export async function emailPeople(supporters: boolean): Promise<EmailChoice[]> {
  const hidden = supporters ? [] : await threadsWithSomeoneElse();
  return query<EmailChoice>(
    `SELECT n.id::int AS id, n.name, p.constituency FROM notable_people n JOIN politicians p ON p.id = n.id
     WHERE NOT p.is_test AND (
       EXISTS (SELECT 1 FROM letters l WHERE l.notable_person_id = n.id AND ($1 OR l.kind <> 'supporter'))
       OR EXISTS (SELECT 1 FROM one_off_thread_people tp JOIN one_off_threads t ON t.id = tp.thread_id
         WHERE tp.notable_person_id = n.id AND NOT t.id = ANY($2::bigint[])))
     ORDER BY n.name COLLATE "en-GB-x-icu", n.id`,
    [supporters, hidden],
  );
}

/**
 * One page of what `filter` finds, in its sort, by default newest sent
 * first, those with nothing to sort by last, and how many it finds in all. Without `supporters`, what would show a
 * supporter is left out unseen: their letters and one-off threads with someone
 * else on them (threadsWithSomeoneElse). A thread counts as sent, by whoever sent it, at its first message,
 * and replied to at the first message after that from a politician (lib/one-off.ts).
 */
export async function listAllLetters(filter: AllLettersFilter, supporters: boolean): Promise<AllLettersFound> {
  const book = await politicianBook();
  const hidden = supporters ? [] : await threadsWithSomeoneElse();
  const values: BookValues = {
    addresses: sql`${[...book.addresses.keys()]}`,
    domains: sql`${[...book.domains.keys()]}`,
    parliament: sql`${PARLIAMENT_ADDRESS}`,
  };
  const where: Sql[] = supporters ? [] : [sql`e.kind <> 'supporter' AND NOT e.someone_else`];
  if (filter.search) {
    const like = sql`${`%${filter.search}%`}`;
    where.push(sql`e.sender_name ILIKE ${like} OR e.sender_email ILIKE ${like} OR e.about ILIKE ${like}
      OR EXISTS (SELECT 1 FROM json_array_elements(e.people) person WHERE person->>'name' ILIKE ${like})`);
  }
  if (filter.from) where.push(sql`e.sender = ANY(${filter.from})`);
  if (filter.notFrom) where.push(sql`e.sender <> ALL(${filter.notFrom})`);
  if (filter.type) where.push(sql`${TYPE_OF} = ANY(${filter.type})`);
  if (filter.notType) where.push(sql`${TYPE_OF} <> ALL(${filter.notType})`);
  const isWith = (ids: number[]) =>
    sql`EXISTS (SELECT 1 FROM json_array_elements(e.people) person WHERE (person->>'id')::bigint = ANY(${ids}))`;
  if (filter.to) where.push(isWith(filter.to));
  if (filter.notTo) where.push(sql`NOT ${isWith(filter.notTo)}`);
  if (filter.sentDays) where.push(sql`e.sent_at >= ${windowStart(filter.sentDays)} AND e.sent_at <= ${now()}`);
  if (!filter.flags?.includes("test")) where.push(sql`NOT e.test`);
  if (filter.flags) where.push(anyMarked(filter.flags));
  if (filter.notFlags) where.push(sql`NOT ${anyMarked(filter.notFlags)}`);
  if (filter.replied === "yes") where.push(sql`e.replied_at IS NOT NULL`);
  else if (filter.replied === "no") where.push(sql`e.replied_at IS NULL`);
  else if (filter.replied) {
    where.push(sql`e.replied_at >= ${windowStart(filter.replied)} AND e.replied_at <= ${now()}`);
  }
  const emails = sql`(
    SELECT l.id, l.kind, l.status, l.sent_at, l.replied_at, false AS someone_else,
      json_build_array(json_build_object('id', n.id::int, 'name', n.name)) AS people,
      f.name AS sender_name, f.email AS sender_email, coalesce(c.title, m.title) AS about,
      s.campaign, (SELECT k.supporter_id::int FROM supporter_links k WHERE k.form_entry_id = s.entry_id) AS supporter_id,
      m.id AS mailing_id, false AS from_us, l.kind AS sender, NULL AS to_line, ${sql.raw(REPLIES)} AS replies, p.is_test AS test
    FROM letters l JOIN politicians p ON p.id = l.notable_person_id JOIN notable_people n ON n.id = p.id
      LEFT JOIN letters_from_supporters s ON s.id = l.id LEFT JOIN form_entries f ON f.id = s.entry_id
      LEFT JOIN campaigns c ON c.slug = s.campaign
      LEFT JOIN letters_from_pauseai lp ON lp.id = l.id LEFT JOIN mailings m ON m.id = lp.mailing_id
    UNION ALL
    SELECT t.id, 'one-off', 'one-off', first.at,
      (SELECT min(m.at) FROM one_off_messages m WHERE m.thread_id = t.id AND m.at > first.at
         AND ${fromPolitician("m.from_address", values)}),
      t.id = ANY(${hidden}::bigint[]),
      coalesce((SELECT json_agg(json_build_object('id', n.id::int, 'name', n.name) ORDER BY n.name COLLATE "en-GB-x-icu")
        FROM one_off_thread_people tp JOIN notable_people n ON n.id = tp.notable_person_id
        WHERE tp.thread_id = t.id), '[]'),
      first.from_name, first.from_address, t.subject, NULL, NULL, NULL, first.from_us,
      CASE WHEN first.from_us THEN 'pauseai' WHEN ${fromPolitician("first.from_address", values)} THEN 'politician'
        WHEN EXISTS (SELECT 1 FROM supporter_identity i WHERE i.email = first.from_address) THEN 'supporter'
        ELSE 'other' END,
      first.to_line, 0, EXISTS (SELECT 1 FROM one_off_thread_people tp JOIN politicians p ON p.id = tp.notable_person_id
        WHERE tp.thread_id = t.id AND p.is_test)
    FROM one_off_threads t
      CROSS JOIN LATERAL (SELECT m.at, m.from_name, m.from_address, m.from_us, m.to_line FROM one_off_messages m
        WHERE m.thread_id = t.id ORDER BY m.at, m.id LIMIT 1) first
  ) e`;
  const found = sql`FROM ${emails} ${sql.where(where)}`;
  const [{ total }] = await query<{ total: number }>(sql`SELECT count(*)::int AS total ${found}`);
  const rows = await query<AnyLetter & { toLine: string | null }>(
    sql`SELECT e.id::int AS id, e.kind, e.status, e.sent_at AS "sentAt", e.replied_at AS "repliedAt", e.people,
       e.sender_name AS "senderName", e.sender_email AS "senderEmail", e.campaign, e.about AS "campaignTitle",
       e.about AS "mailingTitle", e.about AS subject, e.supporter_id AS "supporterId", e.mailing_id::int AS "mailingId", e.from_us AS "fromUs", e.to_line AS "toLine", e.replies
     ${found}
     ORDER BY ${sql.raw(`${SORT_COLUMNS[filter.sort.key]} ${filter.sort.dir === "asc" ? "ASC" : "DESC"}`)} NULLS LAST,
       e.sent_at DESC NULLS LAST, e.id DESC
     LIMIT ${ALL_LETTERS_PAGE_SIZE} OFFSET ${(filter.page - 1) * ALL_LETTERS_PAGE_SIZE}`,
  );
  const letters = rows.map(({ toLine, ...row }) =>
    row.kind === "one-off" ? { ...row, recipients: recipientsOf(toLine!, book, row.people) } : row,
  ) as AnyLetter[];
  return { letters, total, pages: Math.max(1, Math.ceil(total / ALL_LETTERS_PAGE_SIZE)) };
}
