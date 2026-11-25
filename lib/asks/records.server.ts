import "server-only";
import { cache } from "react";
import {
  ASK_STATUSES,
  askSlug,
  INVITED,
  NAMED_ASKS,
  type Asker,
  type AskKind,
  type AskStatus,
  type RecordedStatus,
} from "./asks";
import { answerSql, askingLetters } from "./invited";
import { logChange } from "@/lib/server/audit.server";
import { query, transaction, type Queryable } from "@/lib/server/db.server";

// The asks and campaigns in the database (lib/asks/asks.ts), for the staff
// interface. Staff add, change and delete asks; a migration adds each
// campaign, and the asks the code names.

export type Ask = {
  slug: string;
  title: string;
  kind: AskKind;
  /** yyyy-mm-dd, the event's or the letter's, if known. */
  date: string | null;
  /** Where to read the letter or see the event: a path of ours, or another site's page. */
  url: string | null;
  /** Who asks it. */
  askedBy: Asker[];
};

/** A campaign or mailing that put an ask: its link, name and letters. */
export type AskWay = {
  kind: "campaign" | "mailing";
  href: string;
  title: string;
  letters: number;
};

/** An ask, with how many people have given each answer, how many were written to, how many were asked and haven't answered, how many campaigns and mailings put it, and which. */
export type AskWithCounts = Ask & {
  counts: Partial<Record<AskStatus, number>>;
  /** The days of its first and last letters, yyyy-mm-dd, if it has any. */
  firstLetter: string | null;
  lastLetter: string | null;
  writtenTo: number;
  /** How many of those written to replied to a letter. */
  replied: number;
  /** How many were asked, by a letter or as staff marked them, and haven't answered. */
  invited: number;
  campaigns: number;
  mailings: number;
  ways: AskWay[];
};

/** A campaign's row: its title, and the ask it makes, if any. */
export type CampaignRow = { slug: string; title: string; ask: string | null };

const ASK_COLUMNS = `a.slug, a.title, a.kind, to_char(a.date, 'YYYY-MM-DD') AS date, a.url, a.asked_by AS "askedBy"`;

/** Every ask, newest first, those without a date last. */
export const listAsks = cache(async function listAsks(): Promise<Ask[]> {
  return query<Ask>(`SELECT ${ASK_COLUMNS} FROM asks a ORDER BY a.date DESC NULLS LAST, a.title`);
});

/**
 * Every ask, as listAsks() orders them, with how many gave each answer.
 *
 * The asks come through their slugs as an array, which the planner takes
 * for a few rows, as there are: on a never-analysed database it takes the
 * table itself for hundreds, and prices a dozen subqueries for each over
 * JIT's threshold (docs/code-structure.md, "How fast a query has to be").
 */
export async function asksWithCounts(): Promise<AskWithCounts[]> {
  return query<AskWithCounts>(
    `SELECT ${ASK_COLUMNS}, ${ANSWER_COUNTS}, ${HOW_ASKED}
     FROM unnest(ARRAY(SELECT slug FROM asks)) k (slug) JOIN asks a ON a.slug = k.slug
     ORDER BY a.date DESC NULLS LAST, a.title`,
  );
}

/**
 * Whether the notable person `id` isn't a test politician, in SQL. An ask's
 * counts and columns leave them out, as the politicians list they lead to
 * does unless it's asked for them.
 */
const notTest = (id: string) => `NOT EXISTS (SELECT 1 FROM politicians tp WHERE tp.id = ${id} AND tp.is_test)`;

/** One row's answers, and how many gave each. Those marked invited aren't among them. */
const ANSWER_COUNTS = `coalesce((SELECT json_object_agg(c.status, c.count) FROM (
    SELECT s.status, count(*)::int AS count FROM ask_statuses s
    WHERE s.ask = a.slug AND ${answerSql("s.status")} AND ${notTest("s.notable_person_id")} GROUP BY s.status
  ) c), '{}') AS counts`;

/**
 * One row's first and last letters' days, in London, how many people a letter put it to
 * (askingLetters), those written to who replied, those asked who haven't
 * answered, and the campaigns and mailings that put it: campaigns first,
 * then mailings, the latest of each first. Its counts of people leave out
 * test politicians.
 */
const HOW_ASKED = `
  (SELECT count(DISTINCT w.id)::int FROM (${askingLetters("true")}) w
   WHERE w.ask = a.slug AND ${notTest("w.id")}) AS "writtenTo",
  (SELECT to_char(min(coalesce(l.sent_at, l.created_at)) AT TIME ZONE 'Europe/London', 'YYYY-MM-DD') FROM letters l
     LEFT JOIN letters_from_supporters s ON s.id = l.id LEFT JOIN campaigns c ON c.slug = s.campaign
     LEFT JOIN letters_from_pauseai p ON p.id = l.id LEFT JOIN mailings m ON m.id = p.mailing_id
   WHERE c.ask = a.slug OR m.ask = a.slug) AS "firstLetter",
  (SELECT to_char(max(coalesce(l.sent_at, l.created_at)) AT TIME ZONE 'Europe/London', 'YYYY-MM-DD') FROM letters l
     LEFT JOIN letters_from_supporters s ON s.id = l.id LEFT JOIN campaigns c ON c.slug = s.campaign
     LEFT JOIN letters_from_pauseai p ON p.id = l.id LEFT JOIN mailings m ON m.id = p.mailing_id
   WHERE c.ask = a.slug OR m.ask = a.slug) AS "lastLetter",
  (SELECT count(DISTINCT l.notable_person_id)::int FROM letters l
     LEFT JOIN letters_from_supporters s ON s.id = l.id LEFT JOIN campaigns c ON c.slug = s.campaign
     LEFT JOIN letters_from_pauseai p ON p.id = l.id LEFT JOIN mailings m ON m.id = p.mailing_id
   WHERE (c.ask = a.slug OR m.ask = a.slug) AND l.replied_at IS NOT NULL
     AND ${notTest("l.notable_person_id")}) AS replied,
  (SELECT count(*)::int FROM (
     SELECT st.notable_person_id AS id FROM ask_statuses st WHERE st.ask = a.slug AND st.status = '${INVITED}'
     UNION
     SELECT w.id FROM (${askingLetters("true")}) w WHERE w.ask = a.slug AND NOT EXISTS (
       SELECT 1 FROM ask_statuses st WHERE st.notable_person_id = w.id AND st.ask = a.slug
     )
   ) i WHERE ${notTest("i.id")}) AS invited,
  (SELECT count(*)::int FROM campaigns c WHERE c.ask = a.slug) AS campaigns,
  (SELECT count(*)::int FROM mailings m WHERE m.ask = a.slug AND m.state <> 'draft') AS mailings,
  (SELECT coalesce(
     json_agg(json_build_object('kind', w.kind, 'href', w.href, 'title', w.title, 'letters', w.letters)
       ORDER BY w.kind, w.last DESC NULLS LAST, w.title),
     '[]')
   FROM (
     SELECT 'campaign' AS kind, '/staff/campaigns/' || c.slug AS href, c.title, max(l.created_at) AS last, count(l.id)::int AS letters
     FROM campaigns c LEFT JOIN letters_from_supporters s ON s.campaign = c.slug LEFT JOIN letters l ON l.id = s.id
     WHERE c.ask = a.slug GROUP BY c.slug
     UNION ALL
     SELECT 'mailing', '/staff/mailings/' || m.id, m.title, max(coalesce(l.sent_at, l.created_at)), count(l.id)::int
     FROM mailings m LEFT JOIN letters_from_pauseai p ON p.mailing_id = m.id LEFT JOIN letters l ON l.id = p.id
     WHERE m.ask = a.slug AND m.state <> 'draft' GROUP BY m.id
   ) w) AS ways`;

/** Where a politician stands on an ask: their answer, or asked and yet to give one. */
export type AskAnswer = {
  politicianId: number;
  name: string;
  /** Whether they're in office, or how they left (notable_people.status, as the shared words name it). */
  personStatus: string;
  constituency: string | null;
  party: string | null;
  /** INVITED for someone asked who hasn't answered. */
  status: RecordedStatus;
  /** What an answer of "other" was, and any other note on it; "" for none. */
  note: string;
};

/**
 * One column of an ask's answers (an answer its kind allows, or INVITED):
 * how many are in it, how many of those are out of office, and the first
 * few of them.
 */
export type AskAnswerGroup = { key: string; total: number; outOfOffice: number; people: AskAnswer[] };

/** An ask's own page: how it was put, and its answers' columns. */
export type AskPageData = AskWithCounts & {
  /** Those invited if there are any, then each answer its kind allows, each with its first few people. */
  groups: AskAnswerGroup[];
};

/** People in a column of an ask's answers. */
const ANSWER_COLUMN_SIZE = 5;

/**
 * The first few who gave `answer` to an ask, by name; or for INVITED, those
 * staff marked so and those a letter asked with nothing recorded (askingLetters),
 * whoever was asked longest ago first, by their last letter or when staff
 * marked them. Each row has how many of all who gave it are out of office.
 */
function answersGiven(slug: string, answer: string) {
  return query<AskAnswer & { outOfOffice: number }>(
    `WITH written AS (
       SELECT w.id, max(w.at) AS at FROM (${askingLetters("true")}) w WHERE w.ask = $1 GROUP BY 1
     )
     SELECT n.id::int AS "politicianId", n.name, n.status AS "personStatus", p.constituency, p.party,
       coalesce(s.status, '${INVITED}') AS status, coalesce(s.note, '') AS note,
       count(*) FILTER (WHERE n.status <> 'in_office') OVER ()::int AS "outOfOffice"
     FROM notable_people n
       LEFT JOIN politicians p ON p.id = n.id
       LEFT JOIN ask_statuses s ON s.notable_person_id = n.id AND s.ask = $1
       LEFT JOIN written w ON w.id = n.id
     WHERE CASE WHEN $2::text = '${INVITED}' THEN coalesce(s.status = '${INVITED}', w.id IS NOT NULL)
       ELSE s.status = $2 END AND ${notTest("n.id")}
     ORDER BY CASE WHEN $2::text = '${INVITED}' THEN coalesce(w.at, s.updated_at) END, n.name COLLATE english
     LIMIT ${ANSWER_COLUMN_SIZE}`,
    [slug, answer],
  );
}

/** The title of the ask with `slug`, for its page's metadata, which needs no more of it; or undefined for none. */
export async function askTitle(slug: string): Promise<string | undefined> {
  const [ask] = await query<{ title: string }>("SELECT title FROM asks WHERE slug = $1", [slug]);
  return ask?.title;
}

/** The ask with `slug`, for its page, with the first few people of each column; or undefined for none. */
export async function askPageData(slug: string): Promise<AskPageData | undefined> {
  const [ask] = await query<AskWithCounts>(
    `SELECT ${ASK_COLUMNS}, ${ANSWER_COUNTS}, ${HOW_ASKED}
     FROM asks a WHERE a.slug = $1`,
    [slug],
  );
  if (!ask) return undefined;
  // Those invited first, if there are any, as being asked comes before an answer.
  const columns = [
    ...(ask.invited ? [{ key: INVITED, total: ask.invited }] : []),
    ...ASK_STATUSES[ask.kind].map((key) => ({ key, total: ask.counts[key] ?? 0 })),
  ];
  const groups = await Promise.all(
    columns.map(async ({ key, total }) => {
      const people = await answersGiven(slug, key);
      return { key, total, outOfOffice: people[0]?.outOfOffice ?? 0, people };
    }),
  );
  return { ...ask, groups };
}

/** Every campaign, by title. */
export async function listCampaigns(): Promise<CampaignRow[]> {
  return query<CampaignRow>("SELECT slug, title, ask FROM campaigns ORDER BY title");
}

/** What staff give for an ask: everything but its slug, which is made from its title and date. */
export type AskInput = Omit<Ask, "slug">;

/** Why an ask wasn't saved or deleted: its kind while it has answers, one the code names or one in use, deleted. */
export type AskChange =
  { saved: true; slug: string } | { saved: false; reason: "named" | "kind-in-use" | "in-use" | "gone" };

/** What refers to an ask: answers to it, and the rest, which are campaigns, mailings and those staff marked invited. */
async function uses(slug: string, db?: Queryable): Promise<{ answers: number; others: number }> {
  const [row] = await query<{ answers: number; others: number }>(
    `SELECT (SELECT count(*)::int FROM ask_statuses WHERE ask = $1 AND ${answerSql("status")}) AS answers,
       (SELECT count(*)::int FROM campaigns WHERE ask = $1) + (SELECT count(*)::int FROM mailings WHERE ask = $1)
         + (SELECT count(*)::int FROM ask_statuses WHERE ask = $1 AND NOT ${answerSql("status")}) AS others`,
    [slug],
    db,
  );
  return row;
}

/**
 * Adds an ask, as `by`, its slug made from its title and date, with a
 * number after it if that's taken. Logs it.
 */
export async function addAsk(input: AskInput, by: string): Promise<AskChange> {
  return transaction(async (db) => {
    const base = askSlug(input.title, input.date);
    const taken = await query<{ slug: string }>(
      "SELECT slug FROM asks WHERE slug = $1 OR slug LIKE $1 || '-%'",
      [base],
      db,
    );
    let slug = base;
    for (let n = 2; taken.some((row) => row.slug === slug); n++) slug = `${base}-${n}`;
    await query(
      "INSERT INTO asks (slug, title, kind, date, url, asked_by) VALUES ($1, $2, $3, $4, $5, $6)",
      [slug, input.title, input.kind, input.date, input.url, input.askedBy],
      db,
    );
    await logChange(by, "add ask", { slug, ...input }, db);
    return { saved: true, slug };
  });
}

/**
 * Changes an ask, as `by`, but for its slug; not its kind while anyone has
 * an answer to it. Those staff marked invited follow its kind, by the
 * table's foreign key. Logs it.
 */
export async function editAsk(slug: string, input: AskInput, by: string): Promise<AskChange> {
  return transaction(async (db) => {
    const [ask] = await query<{ kind: string }>("SELECT kind FROM asks WHERE slug = $1 FOR UPDATE", [slug], db);
    if (!ask) return { saved: false, reason: "gone" };
    if (ask.kind !== input.kind && (await uses(slug, db)).answers > 0) return { saved: false, reason: "kind-in-use" };
    await query(
      "UPDATE asks SET title = $2, kind = $3, date = $4, url = $5, asked_by = $6 WHERE slug = $1",
      [slug, input.title, input.kind, input.date, input.url, input.askedBy],
      db,
    );
    await logChange(by, "edit ask", { slug, ...input }, db);
    return { saved: true, slug };
  });
}

/** Deletes an ask, as `by`, while nothing refers to it; never one the code names. Logs it. */
export async function deleteAsk(slug: string, by: string): Promise<AskChange> {
  if (NAMED_ASKS.includes(slug)) return { saved: false, reason: "named" };
  return transaction(async (db) => {
    const [ask] = await query<Ask>(`SELECT ${ASK_COLUMNS} FROM asks a WHERE a.slug = $1 FOR UPDATE`, [slug], db);
    if (!ask) return { saved: false, reason: "gone" };
    const used = await uses(slug, db);
    if (used.answers + used.others > 0) return { saved: false, reason: "in-use" };
    await query("DELETE FROM asks WHERE slug = $1", [slug], db);
    await logChange(by, "delete ask", ask, db);
    return { saved: true, slug };
  });
}

/** One ask, if there is one, with whether the code names it, and whether staff can change its kind or delete it. */
export const askToEdit = cache(async function askToEdit(
  slug: string,
): Promise<(Ask & { named: boolean; kindFixed: boolean; deletable: boolean }) | undefined> {
  const [ask] = await query<Ask>(`SELECT ${ASK_COLUMNS} FROM asks a WHERE a.slug = $1`, [slug]);
  if (!ask) return undefined;
  const used = await uses(slug);
  const named = NAMED_ASKS.includes(slug);
  return { ...ask, named, kindFixed: used.answers > 0, deletable: !named && used.answers + used.others === 0 };
});
