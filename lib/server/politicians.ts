import "server-only";
import { cache } from "react";
import { windowStart } from "@/lib/staff-dashboard";
import { now } from "@/lib/now";
import { AGREED_STATUSES, type AskStatus } from "@/lib/asks";
import { MAILED, statusIn } from "@/lib/letter-status";
import type { Mp, MpStatuses } from "@/lib/email-your-mp";
import type { SortSpec } from "@/lib/staff-sort";
import type { PoliticianSort } from "@/lib/staff-lists";
import type { Country, EmailState, House, PersonStatus, PoliticianFlag } from "@/lib/politician-filters";
import { query, transaction, type Queryable } from "./db";
import { auditActions, type AuditEntry, logChange } from "./audit";
import { CLOSE_ENOUGH, closeness, contains, everyWord } from "./search";
import { sql, type Sql } from "./sql";

// Politicians, the notable people who are in a parliament or were, and
// their answer to each ask. A politician is a row of notable_people, with
// what all notable people have, and one of politicians, with what only
// politicians have. They're copied from Airtable nightly
// (politician-sync.ts), and staff set statuses in the staff interface.

export { COUNTRIES, HOUSES, isHouse, isPersonStatus, PERSON_STATUSES } from "@/lib/politician-filters";
export type { Country, EmailState, House, PersonStatus, PoliticianFlag } from "@/lib/politician-filters";

export type StatusRecord = {
  status: AskStatus;
  /** yyyy-mm-dd, if known. */
  date: string | null;
  note: string;
  updatedAt: Date;
  updatedBy: string;
};

export type Politician = {
  id: number;
  /** Airtable's record ID, for those copied from it. Null for the test MPs, and anyone added by hand. */
  airtableId: string | null;
  /** When their record was no longer in Airtable. */
  airtableRemovedAt: Date | null;
  house: House;
  name: string;
  salutation: string;
  constituency: string | null;
  party: string;
  country: Country | null;
  email: string | null;
  status: PersonStatus;
  notes: string;
  importantTarget: boolean;
  personalConnection: boolean;
  isTest: boolean;
  /** Their address bounced or complained, so nothing is sent to it (lib/server/email.ts). */
  emailBlocked: boolean;
  /** Letters written to them (bar those never sent), and how many of those got a reply. */
  letters: number;
  replies: number;
  /** Their first and last activity with us: a letter to them, a reply, an answer to an ask (POLITICIAN_ACTIVITY). */
  firstActivityAt: Date | null;
  lastActivityAt: Date | null;
  /** Their answer to each ask, by the ask's slug. */
  statuses: Record<string, StatusRecord>;
};

/** An MP the form can write to, with their row's ID. */
export type FoundMp = Mp & { id: number; isTest: boolean };

/** A politician's two rows, as n (notable_people) and p (politicians). */
const POLITICIANS = "notable_people n JOIN politicians p ON p.id = n.id";

const MP_COLUMNS = `n.id::int AS id, n.name, n.salutation, p.constituency, n.email, p.is_test AS "isTest",
  EXISTS (SELECT 1 FROM email_blocks b WHERE b.address = lower(n.email)) AS unreachable`;

/** The MP in office for a constituency. */
export async function findMpInOffice(constituency: string): Promise<FoundMp | undefined> {
  const [mp] = await query<FoundMp>(
    `SELECT ${MP_COLUMNS} FROM ${POLITICIANS}
     WHERE p.house = 'commons' AND n.status = 'in_office' AND NOT p.is_test AND p.constituency = $1 LIMIT 1`,
    [constituency],
  );
  return mp;
}

/** The test MP with this postcode, added by the sync. */
export async function findTestMp(postcode: string): Promise<FoundMp | undefined> {
  const [mp] = await query<FoundMp>(`SELECT ${MP_COLUMNS} FROM ${POLITICIANS} WHERE p.test_postcode = $1`, [postcode]);
  return mp;
}

/** What one politician has answered to the letters we've asked them to sign, by ask. */
export async function statusesOf(politicianId: number): Promise<MpStatuses> {
  const rows = await query<{ ask: string; status: AskStatus }>(
    "SELECT ask, status FROM ask_statuses WHERE notable_person_id = $1 AND ask_kind = 'letter'",
    [politicianId],
  );
  return Object.fromEntries(rows.map((row) => [row.ask, row.status]));
}

/** As SELECT_POLITICIANS gives it: the statuses built with json_build_object, so their times as text. */
type Row = Omit<Politician, "statuses"> & {
  statuses: Record<string, Omit<StatusRecord, "updatedAt"> & { updatedAt: string }> | null;
};

/**
 * The first or last time a politician did something with us, or we with
 * them: a letter written to them, their reply, or their answer to an ask,
 * on the day it was given if we know it, else when we recorded it.
 */
const POLITICIAN_ACTIVITY = (agg: "min" | "max") => `(SELECT ${agg}(x.at) FROM (
    SELECT l.created_at AS at FROM letters l WHERE l.notable_person_id = n.id
    UNION ALL SELECT l.replied_at FROM letters l WHERE l.notable_person_id = n.id
    UNION ALL SELECT coalesce(a.status_date::timestamptz, a.updated_at) FROM ask_statuses a WHERE a.notable_person_id = n.id
  ) x)`;

const SELECT_POLITICIANS = `
  SELECT n.id::int AS id, n.airtable_id AS "airtableId", n.airtable_removed_at AS "airtableRemovedAt", p.house,
    n.name, n.salutation, p.constituency, p.party, p.country, n.email, n.status,
    n.notes, n.important_target AS "importantTarget", n.personal_connection AS "personalConnection",
    p.is_test AS "isTest",
    EXISTS (SELECT 1 FROM email_blocks b WHERE b.address = lower(n.email)) AS "emailBlocked",
    (SELECT count(*)::int FROM letters l WHERE l.notable_person_id = n.id AND l.status <> 'not_sent') AS "letters",
    (SELECT count(*)::int FROM letters l WHERE l.notable_person_id = n.id AND l.replied_at IS NOT NULL) AS "replies",
    ${POLITICIAN_ACTIVITY("min")} AS "firstActivityAt", ${POLITICIAN_ACTIVITY("max")} AS "lastActivityAt",
    json_object_agg(s.ask, json_build_object(
      'status', s.status, 'date', to_char(s.status_date, 'YYYY-MM-DD'), 'note', s.note,
      'updatedAt', s.updated_at, 'updatedBy', s.updated_by
    )) FILTER (WHERE s.ask IS NOT NULL) AS statuses
  FROM ${POLITICIANS} LEFT JOIN ask_statuses s ON s.notable_person_id = n.id`;

const SELECT = sql.raw(SELECT_POLITICIANS);

function toPolitician({ statuses, ...row }: Row): Politician {
  const records = Object.entries(statuses ?? {}).map(([ask, record]) => [
    ask,
    { ...record, updatedAt: new Date(record.updatedAt) },
  ]);
  return { ...row, statuses: Object.fromEntries(records) };
}

/** The filters that repeat, which can leave out as well as find. */
type NegatablePoliticianFilter = "party" | "flags" | "country" | "email" | "mailed";

/** Who the politicians list shows. */
export type PoliticianWho = {
  /** Only these, by ID. */
  ids?: number[];
  /** Every word is in their name, constituency, party or email. */
  search?: string;
  house?: House;
  /** Those with this status, or, with "out", every status but in office. */
  status?: PersonStatus | "out";
  /** Those in any of these parties. */
  party?: string[];
  /** Those with any of these: Airtable's markers, a record no longer in Airtable, or a test politician. */
  flags?: PoliticianFlag[];
  /** Those in any of these nations. */
  country?: Country[];
  /** Those with any of these: an address, none, or one that's blocked. */
  email?: EmailState[];
  /** Those a mailing about any of these asks, by slug, went to or is going to. */
  mailed?: string[];
  /** Only those who answered this ask: in the way `answer` says, if given. */
  ask?: string;
  /** Only those who gave any of these answers, to `ask` or, without one, to any ask; "none" for those who gave none. */
  answer?: string[];
  /** Only those who agreed to an ask (AGREED_STATUSES), not by Airtable's record, in the last so many days. */
  agreedDays?: number;
  /** Those with none of these, each a filter above that repeats. */
  not?: Pick<PoliticianWho, NegatablePoliticianFilter>;
};

/** Who the politicians list shows, and how: its sort and page. */
export type PoliticianFilter = PoliticianWho & {
  sort?: SortSpec<PoliticianSort>;
  /** Which page of POLITICIANS_PAGE_SIZE, from 1. */
  page?: number;
};

const POLITICIANS_PAGE_SIZE = 100;

/**
 * Each sort's column in the query. The Asks column sorts by when their
 * newest answer was recorded; first and last activity by the times
 * POLITICIAN_ACTIVITY gives.
 */
const POLITICIAN_COLUMNS: Record<PoliticianSort, string> = {
  name: "n.name",
  house: "p.house",
  constituency: "p.constituency",
  party: "p.party",
  letters: '"letters"',
  replies: '"replies"',
  asks: "(SELECT max(a.updated_at) FROM ask_statuses a WHERE a.notable_person_id = n.id)",
  first: '"firstActivityAt"',
  active: '"lastActivityAt"',
};

/** When a politician has each marker, `n` their notable_people row and `p` their politicians row. */
export const FLAG_CONDITIONS: Record<PoliticianFlag, string> = {
  important: "n.important_target",
  connection: "n.personal_connection",
  removed: "n.airtable_removed_at IS NOT NULL",
  test: "p.is_test",
};

/** When we can write to a politician, or not. */
const BLOCKED = "EXISTS (SELECT 1 FROM email_blocks b WHERE b.address = lower(n.email))";
const EMAIL_CONDITIONS: Record<EmailState, string> = {
  yes: `(coalesce(n.email, '') <> '' AND NOT ${BLOCKED})`,
  none: "coalesce(n.email, '') = ''",
  blocked: BLOCKED,
};

/**
 * Whether a mailing about one of `asks` went to a politician, or is going
 * to: one of its letters to them that wasn't stopped or skipped.
 */
const mailedAbout = (asks: string[]) => sql`EXISTS (SELECT 1 FROM letters l JOIN letters_from_pauseai lp USING (id)
  JOIN mailings m ON m.id = lp.mailing_id
  WHERE l.notable_person_id = n.id AND m.ask = ANY(${asks})
    AND ${sql.raw(statusIn("l.status", MAILED))})`;

/** The conditions of the filters that repeat, those that are on: each finds those with any of its values. */
function anyOf(filter: Pick<PoliticianWho, NegatablePoliticianFilter>): Sql[] {
  const conditions: Sql[] = [];
  if (filter.party) conditions.push(sql`p.party = ANY(${filter.party})`);
  if (filter.flags) conditions.push(sql.or(filter.flags.map((flag) => sql.raw(FLAG_CONDITIONS[flag]))));
  if (filter.country) conditions.push(sql`p.country = ANY(${filter.country})`);
  if (filter.email) conditions.push(sql.or(filter.email.map((state) => sql.raw(EMAIL_CONDITIONS[state]))));
  if (filter.mailed) conditions.push(mailedAbout(filter.mailed));
  return conditions;
}

/** Whether a politician gave an answer to an ask: `filter`'s, or any; one of its answers, or any. */
function answered(filter: Pick<PoliticianWho, "ask" | "answer">): Sql {
  const ask = filter.ask ? sql` AND a.ask = ${filter.ask}` : sql``;
  const given = filter.answer?.filter((answer) => answer !== "none") ?? [];
  const conditions: Sql[] = [];
  if (filter.answer?.includes("none")) {
    conditions.push(sql`NOT EXISTS (SELECT 1 FROM ask_statuses a WHERE a.notable_person_id = n.id${ask})`);
  }
  if (given.length > 0 || !filter.answer) {
    const answer = given.length > 0 ? sql` AND a.status = ANY(${given})` : sql``;
    conditions.push(sql`EXISTS (SELECT 1 FROM ask_statuses a WHERE a.notable_person_id = n.id${ask}${answer})`);
  }
  return sql.or(conditions);
}

/** The conditions `filter` makes. With `closest`, the search is left out, for closestPoliticians to rank by. */
function politicianConditions(filter: PoliticianWho, closest = false): Sql[] {
  const where: Sql[] = [];
  if (filter.ids) where.push(sql`n.id = ANY(${filter.ids}::bigint[])`);
  if (filter.search && !closest) {
    where.push(
      everyWord(filter.search, (like) =>
        sql.or(["n.name", "p.constituency", "p.party", "n.email"].map((column) => contains(column, like))),
      ),
    );
  }
  if (filter.house) where.push(sql`p.house = ${filter.house}`);
  if (filter.status === "out") where.push(sql`n.status <> 'in_office'`);
  else if (filter.status) where.push(sql`n.status = ${filter.status}`);
  where.push(...anyOf(filter));
  if (filter.agreedDays) {
    where.push(
      sql`EXISTS (SELECT 1 FROM ask_statuses a WHERE a.notable_person_id = n.id AND a.status = ANY(${AGREED_STATUSES}) AND a.updated_by <> 'airtable'
         AND a.updated_at >= ${windowStart(filter.agreedDays)} AND a.updated_at <= ${now()})`,
    );
  }
  // What's left out: a filter's condition not true, so one with no value, such as no party, is kept.
  if (filter.not) where.push(...anyOf(filter.not).map((condition) => sql`(${condition}) IS NOT TRUE`));
  if (filter.ask || filter.answer) where.push(answered(filter));
  return where;
}

/** The WHERE clause for `filter`. */
function politicianWhere(filter: PoliticianWho): Sql {
  return sql.where(politicianConditions(filter));
}

/**
 * A page of politicians for the staff interface, by the column asked for, by
 * name to start. A `limit` of null is every one,
 * for a download.
 */
export async function listPoliticians(
  filter: PoliticianFilter = {},
  limit: number | null = POLITICIANS_PAGE_SIZE,
): Promise<Politician[]> {
  const offset = ((filter.page ?? 1) - 1) * (limit ?? 0);
  const order = sql.raw(
    `${POLITICIAN_COLUMNS[filter.sort?.key ?? "name"]} ${filter.sort?.dir === "desc" ? "DESC" : "ASC"} NULLS LAST, n.name, n.id`,
  );
  const rows = await query<Row>(
    sql`${SELECT} ${politicianWhere(filter)} GROUP BY n.id, p.id ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`,
  );
  return rows.map(toPolitician);
}

/**
 * What the politicians page shows for `filter`: its page of them, how many
 * there are and on how many pages; and for a search, how many it finds out
 * of office, while it's of those in office, and in other houses, when one
 * house has none, and, when it finds none at all, the nearest names and how
 * many test politicians it finds, while they're left out.
 */
export async function politiciansPage(filter: PoliticianFilter) {
  const [politicians, total] = await Promise.all([listPoliticians(filter), countPoliticians(filter)]);
  const { search } = filter;
  const none = Boolean(search) && politicians.length === 0;
  const [outOfOffice, otherHouses, closest, tests] = await Promise.all([
    search && filter.status === "in_office" ? countPoliticians({ ...filter, status: "out" }) : 0,
    none && filter.house ? countPoliticians({ ...filter, house: undefined }) : 0,
    search && none ? closestPoliticians({ ...filter, search }) : [],
    // As the Marked filter has them when only Test politician is chosen.
    none && filter.not?.flags?.includes("test")
      ? countPoliticians({ ...filter, flags: ["test"], not: { ...filter.not, flags: undefined } })
      : 0,
  ]);
  return {
    politicians,
    total,
    page: filter.page ?? 1,
    pages: Math.max(1, Math.ceil(total / POLITICIANS_PAGE_SIZE)),
    pageSize: POLITICIANS_PAGE_SIZE,
    outOfOffice,
    otherHouses,
    closest,
    tests,
  };
}

export type PoliticiansPage = Awaited<ReturnType<typeof politiciansPage>>;

/** How many politicians `filter` finds. */
export async function countPoliticians(filter: PoliticianFilter): Promise<number> {
  const [{ count }] = await query<{ count: number }>(
    sql`SELECT count(*)::int AS count FROM ${sql.raw(POLITICIANS)} ${politicianWhere(filter)}`,
  );
  return count;
}

/**
 * For a search that finds no one: the politicians `filter`'s other filters
 * find whose name or constituency is nearest what was typed, nearest first,
 * leaving out any not as near as `enough`; with `namesOnly`, by name alone.
 */
export async function closestPoliticians(
  filter: PoliticianFilter & { search: string },
  limit = 5,
  enough = CLOSE_ENOUGH,
  namesOnly = false,
): Promise<Politician[]> {
  const text = filter.search;
  const near = namesOnly
    ? closeness("n.name", text)
    : sql`greatest(${closeness("n.name", text)}, ${closeness("p.constituency", text)})`;
  const where = sql.where([...politicianConditions(filter, true), sql`${near} >= ${enough}`]);
  const rows = await query<Row>(
    sql`${SELECT} ${where} GROUP BY n.id, p.id ORDER BY ${near} DESC, n.name LIMIT ${limit}`,
  );
  return rows.map(toPolitician);
}

/** The names of the politicians with these IDs, by ID: none for one there's no such politician. */
export async function politicianNames(ids: number[]): Promise<Record<number, string>> {
  const rows = await query<{ id: number; name: string }>(
    `SELECT n.id::int AS id, n.name FROM ${POLITICIANS} WHERE n.id = ANY($1::bigint[])`,
    [ids],
  );
  return Object.fromEntries(rows.map((row) => [row.id, row.name]));
}

/** Who a pasted name is looked for among: those in office, not the test politicians. */
const PASTE_AMONG: PoliticianFilter = { status: "in_office", not: { flags: ["test"] } };

/**
 * Words in a line pasted that aren't the name: a bullet or number before
 * it, anything in brackets, titles, and the letters after a member's name.
 */
const NOT_NAME = [
  /^\s*(?:[-*•·–]|\d+[.)])\s*/,
  /\([^)]*\)/g,
  /\b(?:the|rt|right|hon|honourable|dr|sir|dame|mr|mrs|ms|miss|mx|mp|msp|mla|kc|qc|mbe|obe|cbe)\b\.?/gi,
  /[,;:]+/g,
];

/** A line pasted as the name, constituency or email it's meant to be, without the words around it. */
export function pastedName(line: string): string {
  if (line.includes("@")) return line.trim();
  return NOT_NAME.reduce((text, words) => text.replace(words, " "), line)
    .replace(/\s+/g, " ")
    .trim();
}

/** How many politicians a pasted line offers, when it doesn't find one. */
const PASTE_CHOICES = 5;

/** Who a line pasted found: those it ticks, those it might be, to choose from, and whether those are only near it. */
/** How a line pasted found someone: their name, constituency or email in it, or the words of it in their name or constituency. */
export type PastedBy = "name" | "constituency" | "email" | "words";

/**
 * Who a line pasted found: those it found, and how, by ID; those it might
 * be, to choose from; and whether those are only near it.
 */
export type Pasted = { matches: Politician[]; by: Record<number, PastedBy>; choices: Politician[]; near?: boolean };

/** Text as its words alone, lowercase, without accents, a space either side, as asWords is in SQL. */
function wordsOf(text: string): string {
  return ` ${text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")} `;
}

/** SQL for text as its words alone, lowercase, without accents, a space either side, to find a name in as whole words. */
const asWords = (text: Sql) => sql`' ' || regexp_replace(lower(unaccent(${text})), '[^a-z0-9]+', ' ', 'g') || ' '`;

/** How near a name must be to a line pasted to be offered for it: nearer than the list's search asks. */
const PASTE_NEAR_ENOUGH = 0.55;

/**
 * Whether a line pasted, without the words around a name, could be one:
 * two to four words, each starting with a capital, and no digits. Lines
 * of a page copied whole, such as a party, a heading or a menu, aren't.
 */
export function looksLikeName(text: string): boolean {
  const words = text.split(" ");
  return words.length >= 2 && words.length <= 4 && words.every((word) => /^\p{Lu}/u.test(word)) && !/\d/.test(text);
}

/** SQL for text as its words alone, without accents but keeping their case, a space either side. */
const asCasedWords = (text: Sql) => sql`' ' || regexp_replace(unaccent(${text}), '[^A-Za-z0-9]+', ' ', 'g') || ' '`;

/** Every email address in some text, lowercase. */
export function emailsIn(text: string): string[] {
  return (text.match(/[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}/gi) ?? []).map((one) => one.toLowerCase());
}

/**
 * Who a line pasted is, among those in office. First everyone it names,
 * however much else is in it (a row copied from a table, a list on one
 * line, a page): whose whole name is in it, whose constituency is, as
 * written, capitals and all, so "Bath" is but "a bath" isn't, or whose
 * email address is. Each is found, but for a name two people have, who
 * are to choose between. Then, only for a line that looks like a name,
 * those with every word of it in their name or constituency, found if
 * there's only one; then the nearest names, by name alone, if any are
 * near.
 */
export async function findPasted(line: string): Promise<Pasted> {
  const text = pastedName(line);
  if (!text) return { matches: [], by: {}, choices: [] };
  const named = (
    await query<Row>(
      sql`${SELECT} ${politicianWhere(PASTE_AMONG)}
       AND (${asWords(sql`${line}`)} LIKE '%' || ${asWords(sql`n.name`)} || '%'
         OR (p.constituency <> '' AND ${asCasedWords(sql`${line}`)} LIKE '%' || ${asCasedWords(sql`p.constituency`)} || '%')
         OR lower(n.email) = ANY(${emailsIn(line)}::text[]))
       GROUP BY n.id, p.id ORDER BY n.name, n.id`,
    )
  ).map(toPolitician);
  if (named.length) {
    const shared = (one: Politician) => named.filter((other) => other.name === one.name).length > 1;
    const emails = emailsIn(line);
    const by = (one: Politician): PastedBy =>
      emails.includes(one.email?.toLowerCase() ?? "")
        ? "email"
        : wordsOf(line).includes(wordsOf(one.name))
          ? "name"
          : "constituency";
    const matches = named.filter((one) => !shared(one));
    return {
      matches,
      by: Object.fromEntries(matches.map((one) => [one.id, by(one)])),
      choices: named.filter(shared),
    };
  }
  if (!looksLikeName(text)) return { matches: [], by: {}, choices: [] };
  const words = (
    await query<Row>(
      sql`${SELECT} ${politicianWhere(PASTE_AMONG)}
       AND ${everyWord(text, (like) => sql.or([contains("n.name", like), contains("p.constituency", like)]))}
       GROUP BY n.id, p.id ORDER BY n.name, n.id LIMIT ${PASTE_CHOICES}`,
    )
  ).map(toPolitician);
  if (words.length === 1) return { matches: words, by: { [words[0].id]: "words" }, choices: [] };
  if (words.length) return { matches: [], by: {}, choices: words };
  return {
    matches: [],
    by: {},
    // By name alone: a constituency's found as it's written, and one near in its letters is another place.
    choices: await closestPoliticians({ ...PASTE_AMONG, search: text }, PASTE_CHOICES, PASTE_NEAR_ENOUGH, true),
    near: true,
  };
}

/**
 * Who the lines pasted are, line by line, findPasted's way, keeping only
 * what's of use: someone found once, at the first line that finds them,
 * so a constituency under a name doesn't find them again; and no line
 * that found no one, which is only counted, as `skipped`.
 */
export async function findPastedLines(
  lines: string[],
): Promise<{ lines: (Pasted & { line: string })[]; skipped: number }> {
  const found = await Promise.all(lines.map(async (line) => ({ line, ...(await findPasted(line)) })));
  const seen = new Set<number>();
  const fresh = (people: Politician[]) => people.filter((one) => !seen.has(one.id));
  const kept: (Pasted & { line: string })[] = [];
  let skipped = 0;
  for (const one of found) {
    const matches = fresh(one.matches);
    const choices = fresh(one.choices);
    for (const person of [...matches, ...choices]) seen.add(person.id);
    if (matches.length + choices.length) kept.push({ ...one, matches, choices });
    // A line that found someone already found is a repeat, not one that found no one.
    else if (one.matches.length + one.choices.length === 0) skipped++;
  }
  return { lines: kept, skipped };
}

export type NewPolitician = {
  house: House;
  name: string;
  salutation?: string;
  email: string | null;
  constituency?: string | null;
  party?: string;
  airtableId?: string;
};

/** Adds a politician: their notable person, then their politician row. Returns their ID. */
export async function addPolitician(politician: NewPolitician, db: Queryable, testPostcode?: string): Promise<number> {
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO notable_people (kind, name, salutation, email, airtable_id)
     VALUES ('politician', $1, $2, $3, $4) RETURNING id::int AS id`,
    [politician.name, politician.salutation ?? "", politician.email, politician.airtableId ?? null],
    db,
  );
  await query(
    `INSERT INTO politicians (id, house, constituency, party, is_test, test_postcode) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      politician.house,
      politician.constituency ?? null,
      politician.party ?? "",
      testPostcode !== undefined,
      testPostcode ?? null,
    ],
    db,
  );
  return id;
}

/** Every party a politician is in, for the list's filter. */
export const listParties = cache(async function listParties(): Promise<string[]> {
  const rows = await query<{ party: string }>(
    "SELECT DISTINCT party FROM politicians WHERE party <> '' ORDER BY party",
  );
  return rows.map((row) => row.party);
});

export const getPolitician = cache(async function getPolitician(id: number): Promise<Politician | undefined> {
  const [row] = await query<Row>(`${SELECT_POLITICIANS} WHERE n.id = $1 GROUP BY n.id, p.id`, [id]);
  return row && toPolitician(row);
});

/**
 * Whether a politician can be deleted: their record has gone from Airtable
 * (so never a test MP, which has none), and no letter has been written to
 * them, which would lose its politician.
 */
const DELETABLE = `n.airtable_removed_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM letters l WHERE l.notable_person_id = n.id)`;

/** Whether this politician can be deleted (DELETABLE). */
export async function canDeletePolitician(id: number): Promise<boolean> {
  const rows = await query(`SELECT 1 FROM ${POLITICIANS} WHERE n.id = $1 AND ${DELETABLE}`, [id]);
  return rows.length > 0;
}

/**
 * Deletes a politician whose record has gone from Airtable, with their
 * answers, if they can be deleted, logging who they were. Says whether
 * they were.
 */
export async function deletePolitician(id: number, staff: string): Promise<boolean> {
  return transaction(async (db) => {
    const [gone] = await query<{ id: number; name: string; airtableId: string }>(
      `DELETE FROM notable_people WHERE id = (SELECT n.id FROM ${POLITICIANS} WHERE n.id = $1 AND ${DELETABLE} FOR UPDATE)
       RETURNING id::int AS id, name, airtable_id AS "airtableId"`,
      [id],
      db,
    );
    if (gone) await logChange(staff, "delete politician", gone, db);
    return Boolean(gone);
  });
}

export type StatusChange = { status: AskStatus | null; date: string | null; note: string };

/**
 * Sets, or with a null status clears, one politician's answer to one ask.
 * The ask's kind comes from the asks table, whose foreign keys refuse a
 * status the kind doesn't allow.
 */
export async function setStatus(politicianId: number, ask: string, change: StatusChange, staff: string): Promise<void> {
  await transaction(async (db) => {
    if (change.status) {
      await query(
        `INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, status_date, note, updated_by)
         SELECT $1, slug, kind, $3, $4, $5, $6 FROM asks WHERE slug = $2
         ON CONFLICT (notable_person_id, ask) DO UPDATE
         SET status = $3, status_date = $4, note = $5, updated_by = $6, updated_at = now()`,
        [politicianId, ask, change.status, change.date, change.note, staff],
        db,
      );
    } else {
      await query("DELETE FROM ask_statuses WHERE notable_person_id = $1 AND ask = $2", [politicianId, ask], db);
    }
    await logChange(staff, "set status", { politicianId, ask, ...change }, db);
  });
}

export type Signatory = { name: string; party: string; constituency: string; house: House };

/** Everyone who has signed a letter we asked them to, for the public list. Never the test MPs. */
export async function signatories(ask: string): Promise<Signatory[]> {
  return query<Signatory>(
    `SELECT n.name, p.party, coalesce(p.constituency, '') AS constituency, p.house
     FROM ${POLITICIANS} JOIN ask_statuses s ON s.notable_person_id = n.id
     WHERE s.ask = $1 AND s.status = 'signed' AND NOT p.is_test
     ORDER BY n.name`,
    [ask],
  );
}

/** A change to one politician from the audit log: who, when, what, and the details logged. */
export type PoliticianChange = AuditEntry;

/**
 * Everything the audit log holds about one politician, newest first: their
 * row added, their details edited, by staff or the sync, their record gone
 * from Airtable, their statuses set, by staff or an import, and their
 * address blocked or unblocked.
 */
export async function politicianHistory(id: number, email: string | null): Promise<PoliticianChange[]> {
  return query<PoliticianChange>(
    `SELECT id::int AS id, at, actor, action, details FROM audit_log
     WHERE (action IN (${auditActions("add politician", "edit politician", "remove politician")}) AND (details->>'id')::bigint = $1)
        OR (action = ${auditActions("set status")} AND (details->>'politicianId')::bigint = $1)
        OR (action IN (${auditActions("block address", "unblock address")}) AND $2::text IS NOT NULL AND details->>'address' = lower($2))
     ORDER BY at DESC, id DESC`,
    [id, email],
  );
}

/** A politician a mailing could go to: what its merge fields and conditions are made from. */
export type MailingPolitician = {
  id: number;
  name: string;
  salutation: string;
  constituency: string | null;
  party: string;
  house: House;
  email: string | null;
  blocked: boolean;
  /** Each answer they've given, as "<ask>:<status>". */
  answers: string[];
};

/** Every politician `who` finds, by name, for a mailing to them. */
export async function mailingPoliticians(who: PoliticianWho): Promise<MailingPolitician[]> {
  return query<MailingPolitician>(
    sql`SELECT n.id::int AS id, n.name, n.salutation, p.constituency, p.party, p.house, n.email, ${sql.raw(BLOCKED)} AS blocked,
       coalesce(array_agg(s.ask || ':' || s.status ORDER BY s.ask) FILTER (WHERE s.ask IS NOT NULL), '{}') AS answers
     FROM ${sql.raw(POLITICIANS)} LEFT JOIN ask_statuses s ON s.notable_person_id = n.id
     ${politicianWhere(who)}
     GROUP BY n.id, p.id ORDER BY n.name, n.id`,
  );
}
