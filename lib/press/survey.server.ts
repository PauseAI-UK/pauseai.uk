import "server-only";
import { JOBS } from "@/lib/import-runs";
import type { PressSurveyResult } from "@/lib/import-run-types";
import { notifyStaff, staffLink } from "@/lib/email/notifications.server";
import { now } from "@/lib/now";
import { config } from "@/lib/server/config.server";
import { query } from "@/lib/server/db.server";
import { asRun } from "@/lib/server/import-runs.server";
import { keptError, problem } from "@/lib/server/problems.server";
import { askClaude } from "@/lib/server/outside-services/anthropic.server";
import { orFallback } from "@/lib/server/outside-services/fallback.server";
import { articleAddress, searchNews } from "@/lib/server/outside-services/google-news.server";
import { newsPage } from "@/lib/server/outside-services/news-pages.server";
import { OutsideFailure } from "@/lib/server/outside-services/outside-failure.server";
import { publicText } from "@/lib/problems";
import { pressCopy, pressProblems } from "./copy";
import { MOST_READS } from "./finds";
import { mediumOf } from "./medium";
import { excerpts, LEAST_ARTICLE, readPage } from "./page";
import {
  readJudgements,
  reviewPrompt,
  SYSTEM_PROMPT,
  VERDICT_SCHEMA,
  plain,
  type Candidate,
  type Judgement,
} from "./review";
import { namesUs, TIER_UNKNOWN, type Tier } from "./sources";
import { judgeSources, sourcesOf } from "./sources.server";
import { inWindow, QUERIES, readGoogleNews, windows } from "./search";
import { couldBeUs, MENTION, PEOPLE, readOrg, type Org } from "./signals";
import { hostOf, urlKey } from "./urls";

// The nightly press survey (import-press), a run of the import log:
//
// 1. Search Google News, a week at a time, from where the last search
//    reached (press_search) to today, and the week before that again, as
//    Google adds some pieces to its search late, keeping each piece found as
//    an unread find. Once a day: a later call the same day goes straight to
//    reading.
// 2. Read the unread finds, oldest first, while the call's budget lasts:
//    decode each Google link to the article's own address, set aside one
//    already in the coverage or found before, read the page, and note what
//    it says of PauseAI. Then ask Claude about the finds read, in one
//    request, and keep each as waiting for staff or not ours.
// 3. Once nothing is left unread, email the notification inbox about the
//    finds now waiting that it hasn't been told of.
//
// A call does as much as its budget allows (JOBS), and the background
// function (netlify/functions/import-press-background) calls again while
// finds are left unread and the last call read some.

const JOB = "import-press";

/** Time kept back from reading for Claude's requests, about the finds and their new sites, which take a few seconds. */
const CLAUDE_MS = 8_000;

/** The pause between one request to Google and the next, so as not to look like a flood, which Google turns away. */
export const GAP_MS = 4_000;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayOf = (date: Date) => date.toISOString().slice(0, 10);
const dayBefore = (day: string, days = 1) => dayOf(new Date(Date.parse(`${day}T00:00:00Z`) - days * DAY_MS));

/** How far back each night's search goes again, for the pieces Google adds to its search late, or now and then. */
const SEARCH_AGAIN_DAYS = 7;

/** Searches the days since the last search, `gapMs` between searches, keeping what it finds; how many windows it searched and found new. */
async function search(until: number, gapMs: number): Promise<{ searched: number; found: number }> {
  const [{ searchedTo }] = await query<{ searchedTo: string }>(
    "SELECT to_char(searched_to, 'YYYY-MM-DD') AS \"searchedTo\" FROM press_search",
  );
  const today = dayOf(now());
  // Today is searched again tomorrow, as pieces published later today come after this search.
  const yesterday = dayBefore(today);
  let searched = 0;
  let found = 0;
  // Searched already today, by an earlier call.
  if (searchedTo >= yesterday) return { searched, found };
  // The last week again, as well as the days since; a piece found before is skipped by its link.
  const again = dayBefore(today, SEARCH_AGAIN_DAYS);
  for (const window of windows(searchedTo < again ? searchedTo : again, today)) {
    if (Date.now() > until) break;
    let failed = false;
    for (const q of QUERIES) {
      if (searched > 0 || q !== QUERIES[0]) await new Promise((resolve) => setTimeout(resolve, gapMs));
      const xml = await orFallback(pressProblems.searchFailed({ after: publicText(window.after) }), null, () =>
        searchNews(inWindow(q, window)),
      );
      const answer = xml === null ? null : readGoogleNews(xml);
      if (answer?.error !== undefined)
        problem(pressProblems.searchFailed({ after: publicText(window.after) }), new Error(answer.error));
      if (answer === null || answer.error !== undefined) {
        failed = true;
        break;
      }
      for (const piece of answer.found) {
        const [added] = await query<{ id: number }>(
          `INSERT INTO press_finds (google_link, title, outlet_name, published, site) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (google_link) DO NOTHING RETURNING id::int`,
          [
            piece.googleLink,
            plain(piece.title, 300) ?? piece.googleLink,
            piece.outlet ?? null,
            piece.date ?? null,
            // Google's own, when it doesn't say whose the piece is.
            piece.domain === "news.google.com" ? null : piece.domain,
          ],
        );
        if (added) found++;
      }
    }
    // A window that failed is searched again next time, and so is everything after it.
    if (failed) break;
    searched++;
    const reached = dayBefore(window.before);
    await query("UPDATE press_search SET searched_to = $1", [reached < yesterday ? reached : yesterday]);
  }
  return { searched, found };
}

/**
 * Every article address the coverage and the finds read have, as urlKey
 * compares them. A find still unread may have its address, from a try
 * whose page couldn't be read, and isn't known for it.
 */
async function knownAddresses(): Promise<Set<string>> {
  const rows = await query<{ url: string }>(
    `SELECT url FROM press_coverage WHERE url IS NOT NULL
     UNION SELECT link->>'url' FROM press_coverage, jsonb_array_elements(links) AS link
     UNION SELECT url FROM press_finds WHERE url IS NOT NULL AND state <> 'unread'`,
  );
  return new Set(rows.flatMap(({ url }) => urlKey(url) ?? []));
}

type Unread = {
  id: number;
  googleLink: string;
  title: string;
  outlet: string | null;
  date: string | null;
  reads: number;
  /** As Google News gave it, until the find's article is read. */
  site: string | null;
};

/**
 * A find read, or as far as it could be, for Claude to judge: `thin` if all
 * that's known of it is its headline, as its site refused us, its page had
 * too little text to judge by, or its last try failed; `failed` if that try
 * did.
 */
type Judged = { candidate: Candidate; org: Org; site: string | null; thin: boolean; failed?: boolean };

/**
 * A find that couldn't be read this time, reported, and its failure kept on
 * it for staff: tried again next time, or, after its last try, judged by its
 * headline.
 */
async function notRead(find: Unread, error: OutsideFailure, url?: string): Promise<Judged | "failed"> {
  problem(pressProblems.findNotRead({ find: find.id }), error);
  await query(
    `UPDATE press_finds SET reads = reads + 1, read_failure = $2, url = COALESCE($3, url), site = COALESCE($4, site)
     WHERE id = $1`,
    [find.id, JSON.stringify(keptError(error)), url ?? null, url ? hostOf(url) : null],
  );
  if (find.reads + 1 < MOST_READS) return "failed";
  return { ...byHeadline(find, url ?? find.googleLink, url ? hostOf(url) : find.site), failed: true };
}

/** What Claude is given of a find known only by its headline. */
function byHeadline(find: Unread, url: string, site: string | null): Judged {
  const reading = readOrg(find.title, PEOPLE);
  const patterns = [reading.org, ...reading.also].join(", ");
  return {
    candidate: { id: String(find.id), title: find.title, url, outlet: find.outlet, date: find.date, patterns },
    org: reading.org,
    site,
    thin: true,
  };
}

/**
 * Whether a news site refused us, which another try won't change: an answer
 * in the 400s, such as a 403 or a 406, but for a 429, asking us to wait. A
 * site that's down (a 500 or 503), or didn't answer, is tried again.
 */
const refusedUs = (error: OutsideFailure): boolean =>
  error.service === "news-page" && error.status >= 400 && error.status < 500 && error.status !== 429;

/** A find whose site refused to show its page, kept with why, to be judged by its headline alone. */
async function headlineOnly(find: Unread, url: string, error: OutsideFailure): Promise<Judged> {
  await query(
    "UPDATE press_finds SET url = $2, read_failure = $3, medium = $4, site = $5, reads = reads + 1 WHERE id = $1",
    [find.id, url, JSON.stringify(keptError(error)), mediumOf(url), hostOf(url)],
  );
  return byHeadline(find, url, hostOf(url));
}

/**
 * One find read: its address, its page, and what the page says of PauseAI;
 * "known" if it's known; "failed" if it couldn't be read; "blocked" if
 * Google is turning us away, which says nothing of the find, so it isn't
 * counted as one of its tries.
 */
async function readOne(find: Unread, known: Set<string>): Promise<Judged | "known" | "failed" | "blocked"> {
  let url: string | undefined;
  let html: string;
  try {
    url = await articleAddress(find.googleLink);
    // A decoded address is always a web address, so it has a key.
    const key = urlKey(url) as string;
    if (known.has(key)) {
      await query("UPDATE press_finds SET state = 'known', url = $2, reads = reads + 1 WHERE id = $1", [find.id, url]);
      return "known";
    }
    known.add(key);
    ({ url, html } = await newsPage(url));
  } catch (error) {
    if (!(error instanceof OutsideFailure)) throw error;
    if (error.service === "google-news" && error.kind === "rate-limited") {
      problem(pressProblems.googleBlocked(), error);
      return "blocked";
    }
    // A news site that refuses a script refuses it every time, which is no fault of ours: the find is judged by its headline.
    if (refusedUs(error)) return headlineOnly(find, url as string, error);
    return notRead(find, error, url);
  }
  const page = readPage(html);
  const captions = page.captions.slice(0, 8).flatMap((caption) => plain(caption, 300) ?? []);
  const reading = readOrg([page.text, ...page.captions, page.title ?? ""].join(" "), PEOPLE);
  // An excerpt is around a mention, so it's never blank.
  const mentions = excerpts(page.text, MENTION).map((excerpt) => plain(excerpt, 600) as string);
  const passage =
    captions.find((caption) => /\bpause ?ai\b/i.test(caption)) ?? plain(excerpts(page.text, MENTION, 120, 1)[0], 300);
  await query(
    `UPDATE press_finds SET url = $2, passage = $3, medium = $4, site = $5, reads = reads + 1, read_failure = NULL
     WHERE id = $1`,
    [find.id, url, passage ?? null, mediumOf(url, page.type), hostOf(url)],
  );
  const patterns = [reading.org, ...reading.also].join(", ");
  const candidate: Candidate = {
    id: String(find.id),
    title: find.title,
    url,
    outlet: find.outlet,
    date: find.date,
    patterns,
    page: {
      title: plain(page.title, 300),
      siteName: plain(page.siteName, 80),
      published: page.published,
      captions,
      excerpts: mentions,
    },
  };
  // A video's page, or a paywall's, says too little to judge by: the find is known by its headline, and its captions.
  return { candidate, org: reading.org, site: hostOf(url), thin: page.text.length < LEAST_ARTICLE };
}

/** Reads unread finds, oldest first, `gapMs` apart, until `until`, then asks Claude about those read. */
async function read(
  until: number,
  gapMs: number,
): Promise<Pick<PressSurveyResult, "read" | "known" | "unreadable" | "waiting" | "notOurs">> {
  const counts = { read: 0, known: 0, unreadable: 0, waiting: 0, notOurs: 0 };
  const known = await knownAddresses();
  const judged: Judged[] = [];
  const done = new Set<number>();
  while (Date.now() < until - CLAUDE_MS) {
    const [find] = await query<Unread>(
      `SELECT id::int, google_link AS "googleLink", title, outlet_name AS outlet,
              to_char(published, 'YYYY-MM-DD') AS date, reads, site
         FROM press_finds WHERE state = 'unread' AND NOT (id = ANY($1::bigint[]))
         ORDER BY found_at, id LIMIT 1`,
      [[...done]],
    );
    if (!find) break;
    done.add(find.id);
    if (done.size > 1) await new Promise((resolve) => setTimeout(resolve, gapMs));
    const outcome = await readOne(find, known);
    // Google won't answer more now: the rest wait for the next call.
    if (outcome === "blocked") break;
    if (outcome === "known") counts.known++;
    else if (outcome === "failed") counts.unreadable++;
    else {
      if (outcome.failed) counts.unreadable++;
      else counts.read++;
      judged.push(outcome);
    }
  }
  if (judged.length === 0) return counts;
  const candidates = judged.map(({ candidate }) => candidate);
  const sites = judged.flatMap(({ site, candidate }) => (site ? [{ site, name: candidate.outlet ?? site }] : []));
  // The finds and their new sites are asked about side by side, within the time kept back for one request.
  const [judgements] = config.anthropicApiKey
    ? await Promise.all([
        orFallback(pressProblems.notJudged({ finds: candidates.length }), [], async () =>
          readJudgements(
            await askClaude({ system: SYSTEM_PROMPT, prompt: reviewPrompt(candidates), schema: VERDICT_SCHEMA }),
            new Set(candidates.map((candidate) => candidate.id)),
          ),
        ),
        judgeSources(sites),
      ])
    : [[]];
  const byId = new Map(judgements.map((judgement) => [judgement.id, judgement]));
  const sources = await sourcesOf(sites.map(({ site }) => site));
  for (const { candidate, org, site, thin } of judged) {
    const judgement = byId.get(candidate.id);
    const tier = (site && sources.get(site)?.tier) || TIER_UNKNOWN;
    const ours = decide({ judgement, org, thin, tier, title: candidate.title });
    await query(`UPDATE press_finds SET state = $2, verdict = $3, org = $4, reason = $5 WHERE id = $1`, [
      Number(candidate.id),
      ours ? "waiting" : "not ours",
      judgement?.verdict ?? null,
      judgement?.org ?? null,
      judgement?.reason ?? null,
    ]);
    if (ours) counts.waiting++;
    else counts.notOurs++;
  }
  return counts;
}

/**
 * Whether a find waits for staff. A tier 4 source's never does. One read
 * whole is decided by Claude's verdict, or without it by the patterns. One
 * known only by its headline (`thin`) waits unless Claude says it isn't ours,
 * the headline doesn't name us, and its source is tier 3: a headline alone
 * misses much of our coverage, so a find from a source worth more waits.
 */
function decide({
  judgement,
  org,
  thin,
  tier,
  title,
}: {
  judgement: Judgement | undefined;
  org: Org;
  thin: boolean;
  tier: Tier;
  title: string;
}): boolean {
  if (tier === 4) return false;
  if (!thin) return judgement ? judgement.verdict !== "not ours" : couldBeUs(org);
  return !(judgement?.verdict === "not ours" && !namesUs(title, [...PEOPLE.uk, ...PEOPLE.global]) && tier >= 3);
}

/** Emails the notification inbox about the finds waiting that it hasn't been told of; how many. */
async function tellStaff(request: Request | undefined): Promise<number> {
  const finds = await query<{ outlet: string; title: string; url: string }>(
    `UPDATE press_finds SET notified_at = now() WHERE state = 'waiting' AND notified_at IS NULL
     RETURNING COALESCE(outlet_name, '') AS outlet, title, COALESCE(url, google_link) AS url`,
  );
  if (finds.length === 0) return 0;
  const words = pressCopy.waitingEmail;
  await notifyStaff(
    words.subject(finds.length),
    words.body({
      finds: finds.map((find) => ({ ...find, outlet: find.outlet || hostOf(find.url) })),
      link: staffLink("/staff/press", request),
    }),
    null,
    "staff-report",
  );
  return finds.length;
}

/** The pause between requests to Google: none when its fake answers them, in a fixture build. */
const gap = (): number => (config.fixtures && !config.realServices.includes("google-news") ? 0 : GAP_MS);

/**
 * One call of the press survey, kept as a run: search, read for the call's
 * budget, then, once nothing is left unread, tell staff. `request` is the
 * job's call, for the email's link; a staff member's run has none. `gapMs`
 * is the pause between requests to Google, which tests shorten.
 */
export async function runPressSurvey(startedBy: string, request?: Request, gapMs = gap()): Promise<PressSurveyResult> {
  const { result } = await asRun(JOB, startedBy, async () => {
    const until = Date.now() + JOBS[JOB].budgetMs;
    const searched = await search(until, gapMs);
    const counts = await read(until, gapMs);
    const [{ left }] = await query<{ left: number }>(
      "SELECT count(*)::int AS left FROM press_finds WHERE state = 'unread'",
    );
    const told = left === 0 ? await tellStaff(request) : 0;
    const result: PressSurveyResult = { ...searched, ...counts, left, told };
    return { status: "ok", result } as const;
  });
  return result;
}
