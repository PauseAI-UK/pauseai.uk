// One run of the weekly press survey (scripts/press-survey.mjs runs it):
// search GDELT and Google News for the last week, set aside what's already
// in the coverage file, read the pages of the most likely stories, and
// sort the rest into what to add to the file, leads for a person to check,
// and what to set aside. With a model to ask, it decides each candidate by
// the file's rules; without, only a page that names PauseAI UK is added,
// marked TODO. Everything outside comes through `deps`, so the tests run
// on stored answers.

import { GDELT_MOST, GDELT_QUERIES, GOOGLE_NEWS_QUERIES, MOST_PAGES, PEOPLE, SHARED_SITES } from "./config.ts";
import type { Addition } from "./coverage-file.ts";
import { excerpts, readPage, type Page } from "./page.ts";
import type { Listed } from "./report.ts";
import { plain, readVerdicts, reviewPrompt, rulesOf, type Candidate, type Verdict } from "./review.ts";
import { couldBeUs, MENTION, ORG_NAMES, rank, readOrg, type Reading } from "./signals.ts";
import { gdeltUrl, googleNewsUrl, readGdelt, readGoogleNews, type Lead, type SourceAnswer } from "./sources.ts";
import { isUk, stories, type Story } from "./stories.ts";
import { hostOf, linksIn } from "./urls.ts";

export type Fetched = { status: number; text: string; contentType: string };

export type SurveyDeps = {
  /** GETs `url`, following redirects. Throws if it can't. */
  fetch: (url: string) => Promise<Fetched>;
  wait: (ms: number) => Promise<void>;
  /** Runs one `claude -p` over `prompt` and gives what it printed; absent when there's no model to ask. */
  review?: (prompt: string) => Promise<string>;
};

/** An outlet as the coverage file has it, as far as the survey needs. */
export type KnownOutlet = { name: string; articles: { url?: string; links?: { url: string }[] }[] };

export type SurveyInput = {
  /** The coverage file's text. */
  file: string;
  outlets: KnownOutlet[];
  /** More text whose links count as found already: main's copy of the file, the open pull request's description. */
  alsoKnown: string;
};

export type SurveyResult = { added: Addition[]; leads: Listed[]; setAside: Listed[]; notes: string[] };

/** GDELT asks for five seconds between requests, and answers 429 to a busy address sooner; these wait longer. */
export const GDELT_GAP = 10_000;
export const GDELT_RETRIES = [30_000, 60_000, 120_000];
/** Pages read at once. */
const AT_ONCE = 5;
/** How many set-aside stories the description lists. */
export const MOST_SET_ASIDE = 50;

async function search(
  deps: SurveyDeps,
  label: string,
  url: string,
  read: (text: string) => SourceAnswer,
  notes: string[],
  retries: number[] = [],
): Promise<Lead[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      const answer = await deps.fetch(url);
      if (answer.status === 429 && attempt < retries.length) {
        await deps.wait(retries[attempt]);
        continue;
      }
      if (answer.status !== 200) {
        const message = plain(answer.text.split(/(?<=\.)\s/)[0], 150);
        notes.push(`${label} answered ${answer.status}: ${message ?? "no message"}`);
        return [];
      }
      const { leads, error } = read(answer.text);
      if (error) notes.push(`${label} answered: ${error}`);
      return leads;
    } catch (error) {
      notes.push(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}

async function allLeads(deps: SurveyDeps, notes: string[]): Promise<Lead[]> {
  const leads: Lead[] = [];
  let asked = false;
  const gdelt = async (query: string) => {
    if (asked) await deps.wait(GDELT_GAP);
    asked = true;
    return search(deps, `GDELT ${query}`, gdeltUrl(query), readGdelt, notes, GDELT_RETRIES);
  };
  for (const query of GDELT_QUERIES) {
    const world = await gdelt(query);
    leads.push(...world);
    if (world.length >= GDELT_MOST) leads.push(...(await gdelt(`${query} sourcecountry:UK`)));
  }
  for (const query of GOOGLE_NEWS_QUERIES) {
    const url = googleNewsUrl(`${query} when:7d`);
    leads.push(...(await search(deps, `Google News ${query}`, url, readGoogleNews, notes)));
  }
  return leads;
}

async function readOne(deps: SurveyDeps, url: string): Promise<Page | undefined> {
  try {
    const answer = await deps.fetch(url);
    return answer.status === 200 && /html/i.test(answer.contentType) ? readPage(answer.text) : undefined;
  } catch {
    // A page that can't be read is judged on its headline, and listed as such.
    return undefined;
  }
}

type Judged = { story: Story; page?: Page; text: string; reading: Reading; score: number };

function judge(story: Story, page?: Page): Judged {
  const text = page
    ? [page.text, ...page.captions, page.title].join(" ")
    : [story.lead.title, ...story.others.map((other) => other.title)].join(" ");
  const reading = readOrg(text, PEOPLE);
  return {
    story,
    page,
    text,
    reading,
    score: rank(reading, { uk: isUk(story.lead), copies: story.others.length, read: !!page }),
  };
}

/** Each outlet the file has by the one site its articles are all on, leaving out sites many outlets share. */
export function outletsBySite(outlets: KnownOutlet[]): Map<string, string> {
  const named = new Map<string, Set<string>>();
  for (const outlet of outlets) {
    for (const article of outlet.articles) {
      for (const url of [article.url, ...(article.links ?? []).map((link) => link.url)]) {
        if (!url) continue;
        const site = hostOf(url);
        named.set(site, (named.get(site) ?? new Set()).add(outlet.name));
      }
    }
  }
  return new Map(
    [...named]
      .filter(([site, names]) => names.size === 1 && !SHARED_SITES.includes(site))
      .map(([site, names]) => [site, [...names][0]]),
  );
}

function listed({ story, reading, page }: Judged, why: string): Listed {
  const { lead, others } = story;
  const read = page ? "" : " Only the headline was read.";
  const also = reading.also.length > 0 ? ` Also names ${reading.also.map((org) => ORG_NAMES[org]).join(", ")}.` : "";
  return {
    title: lead.title,
    url: lead.url,
    outlet: lead.outlet ?? lead.domain,
    date: lead.date,
    why: `${why}${also}${read}`,
    others: others.map((other) => other.url),
  };
}

function candidate(id: string, { story, page, reading }: Judged): Candidate {
  const { lead } = story;
  return {
    id,
    title: lead.title,
    url: lead.url,
    outlet: lead.outlet,
    domain: lead.domain,
    date: lead.date,
    country: lead.country,
    patterns: [ORG_NAMES[reading.org], ...reading.also.map((org) => ORG_NAMES[org])].join("; "),
    read: !!page,
    page: page && {
      title: page.title,
      siteName: page.siteName,
      published: page.published,
      captions: page.captions.slice(0, 8).map((caption) => plain(caption, 300) as string),
      excerpts: excerpts(page.text, MENTION),
    },
  };
}

/** The entry for a story whose page was read: the outlet the file knows by its site, else as named; the page's own title and date. */
function addition(
  lead: Lead,
  page: Page,
  bySite: Map<string, string>,
  names: string[],
  verdict: Verdict | undefined,
  note: string,
): Addition {
  const named = verdict?.outlet ?? page.siteName ?? lead.domain;
  const outlet =
    bySite.get(lead.domain) ??
    names.find((name) => name.toLowerCase() === named.toLowerCase()) ??
    (plain(named, 80) as string);
  const suffix = page.siteName && new RegExp(` [|–-] ${RegExp.escape(page.siteName)}$`);
  const pageTitle = suffix ? page.title?.replace(suffix, "") : page.title;
  return {
    outlet,
    title: verdict?.title ?? plain(pageTitle, 200) ?? lead.title,
    url: lead.url,
    date: verdict?.date ?? page.published ?? lead.date,
    medium: verdict?.medium ?? (/(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/.test(lead.domain) ? "Video" : "Article"),
    note,
  };
}

/** One run of the survey. */
export async function runSurvey(input: SurveyInput, deps: SurveyDeps): Promise<SurveyResult> {
  const notes: string[] = [];
  const known = linksIn(`${input.file}\n${input.alsoKnown}`);
  const found = stories(await allLeads(deps, notes), known);

  // The pages most likely to be about us first, by their headlines.
  const byHeadline = found.map((story) => judge(story)).sort((a, b) => b.score - a.score);
  const toRead = byHeadline.filter((judged) => judged.story.lead.direct).slice(0, MOST_PAGES);
  const pages = new Map<Story, Page | undefined>();
  for (let i = 0; i < toRead.length; i += AT_ONCE) {
    const batch = toRead.slice(i, i + AT_ONCE);
    const read = await Promise.all(batch.map(({ story }) => readOne(deps, story.lead.url)));
    batch.forEach(({ story }, j) => pages.set(story, read[j]));
  }
  const unread = [...pages.values()].filter((page) => !page).length;
  if (unread > 0)
    notes.push(`${unread} of ${toRead.length} pages couldn't be read, so were judged on their headlines.`);

  const judged = byHeadline
    .map((first) => (pages.get(first.story) ? judge(first.story, pages.get(first.story)) : first))
    .sort((a, b) => b.score - a.score);
  const candidates = judged.filter((one) => couldBeUs(one.reading.org));
  // Both searches match the article's whole text, so a headline that
  // doesn't say "pause AI" hides where it does, on a page that couldn't be
  // read. One left unread for ranking below the pages read is set aside.
  const hidden = (one: Judged) =>
    !one.page && one.reading.org === "none" && (!one.story.lead.direct || pages.has(one.story));
  const unseen = judged.filter(hidden);
  const missed = judged.filter((one) => !couldBeUs(one.reading.org) && !hidden(one));

  const ids = new Map(candidates.map((one, i) => [`c${i + 1}`, one]));
  const verdicts = new Map<Judged, Verdict>();
  if (!deps.review) {
    notes.push(
      "No Claude review, as CLAUDE_CODE_OAUTH_TOKEN isn't set: only pages naming PauseAI UK were added, each marked TODO.",
    );
  } else if (candidates.length > 0) {
    const prompt = reviewPrompt(
      rulesOf(input.file),
      input.outlets.map((outlet) => outlet.name),
      [...ids].map(([id, one]) => candidate(id, one)),
    );
    try {
      for (const verdict of readVerdicts(await deps.review(prompt), new Set(ids.keys()))) {
        verdicts.set(ids.get(verdict.id) as Judged, verdict);
      }
    } catch (error) {
      notes.push(`Claude's review failed, so the candidates were sorted by pattern alone: ${(error as Error).message}`);
    }
  }

  const bySite = outletsBySite(input.outlets);
  const names = input.outlets.map((outlet) => outlet.name);
  const result: SurveyResult = { added: [], leads: [], setAside: [], notes };
  for (const one of candidates) {
    const verdict = verdicts.get(one);
    if (verdict?.decision === "reject") {
      result.setAside.push(listed(one, `Claude: ${verdict.reason}`));
    } else if (verdict?.decision === "include" && one.page && (verdict.org === "uk" || verdict.org === "global")) {
      result.added.push(addition(one.story.lead, one.page, bySite, names, verdict, verdict.note ?? verdict.reason));
    } else if (verdict) {
      result.leads.push(listed(one, `Claude: ${verdict.reason}`));
    } else if (one.page && one.reading.org === "uk" && one.reading.also.length === 0) {
      const passage = plain(excerpts(one.text, MENTION, 120, 1)[0], 300);
      const note = `TODO verify: the page names PauseAI UK: "${passage}"`;
      result.added.push(addition(one.story.lead, one.page, bySite, names, undefined, note));
    } else {
      result.leads.push(listed(one, `Patterns: ${ORG_NAMES[one.reading.org]}.`));
    }
  }

  for (const one of unseen) result.leads.push(listed(one, "The search matched the article's text, not its headline."));
  for (const one of missed.slice(0, MOST_SET_ASIDE))
    result.setAside.push(listed(one, `Patterns: ${ORG_NAMES[one.reading.org]}.`));
  if (missed.length > MOST_SET_ASIDE)
    notes.push(`${missed.length - MOST_SET_ASIDE} more stories were set aside, not listed.`);
  return result;
}
