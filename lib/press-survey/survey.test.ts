import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OUTLETS } from "../content/press-coverage";
import { GDELT_MOST } from "./config";
import {
  GDELT_GAP,
  GDELT_RETRIES,
  MOST_SET_ASIDE,
  outletsBySite,
  runSurvey,
  type Fetched,
  type SurveyDeps,
} from "./survey";

const sample = (name: string) => readFileSync(join(__dirname, "samples", name), "utf8");
const file = readFileSync(join(__dirname, "..", "content", "press-coverage.ts"), "utf8");
const input = { file, outlets: OUTLETS, alsoKnown: "" };

const ok = (text: string, contentType = "text/html; charset=utf-8"): Fetched => ({ status: 200, text, contentType });
const json = (articles: object[]) => ok(JSON.stringify({ articles }), "application/json");
const gdelt = (url: string, title: string, fields: object = {}) => ({
  url,
  title,
  seendate: "20261110T080000Z",
  domain: new URL(url).hostname,
  sourcecountry: "United Kingdom",
  ...fields,
});
const page = (title: string, body: string) =>
  `<html><head><title>${title}</title></head><body><p>${body}</p></body></html>`;

/** Answers each request from `answers`, by the GDELT or Google News query or the page's URL; a list is answered in turn. */
function deps(answers: Record<string, Fetched | Error | (Fetched | Error)[]>, review?: SurveyDeps["review"]) {
  const asked: string[] = [];
  const waits: number[] = [];
  const fetch = async (url: string) => {
    const params = new URL(url).searchParams;
    const key = params.get("query") ?? params.get("q") ?? url;
    asked.push(key);
    const answer = answers[key];
    const next = Array.isArray(answer) ? answer.shift() : answer;
    if (next instanceof Error) throw next;
    if (next) return next;
    // A search not given an answer finds nothing; a page not given one is about something else.
    if (params.has("query")) return ok("{}", "application/json");
    if (params.has("q")) return ok("<rss></rss>", "application/rss+xml");
    return ok(page("Elsewhere", "Markets fell."));
  };
  return { asked, waits, deps: { fetch, wait: async (ms: number) => void waits.push(ms), review } };
}

const WORLD = '("PauseAI" OR "Pause AI")';
const UK = `${WORLD} sourcecountry:UK`;
const GOOGLE = '"PauseAI" OR "Pause AI" when:7d';
const GOOGLE_UK = '"PauseAI UK" OR "Pause AI UK" when:7d';

const GAZETTE = "https://www.examplegazette.co.uk/news/march";
const RALLY = "https://www.example.com/us-rally";
const UNREAD = "https://www.example.org/activists";
const PDF = "https://www.example.net/report.pdf";
const WESTMINSTER = "https://www.westminsterextra.co.uk/article/new-piece";
const COPY = "https://www.example.info/activists";
const LOCAL = "https://local.example/news";
const SITE = "https://site.example/a";
const BOTH = "https://both.example/a";

describe("runSurvey without a model", () => {
  it("adds a page naming PauseAI UK, marked TODO, and sorts the rest", async () => {
    const stored = JSON.parse(sample("gdelt.json")).articles;
    const run = deps({
      [WORLD]: [
        { status: 429, text: sample("gdelt-429.txt"), contentType: "text/plain" },
        json([
          ...stored,
          gdelt(GAZETTE, "Protesters march on Whitehall"),
          gdelt("https://www.ft.com/content/1b3e3117-b979-4187-b983-c785d230c09b", "Already in the file"),
          gdelt(RALLY, "Rally in Washington"),
          gdelt(UNREAD, "Pause AI activists gather"),
          gdelt(COPY, "Pause AI activists gather"),
          gdelt(PDF, "A PauseAI UK report"),
          gdelt(LOCAL, "Council meets campaigners", { sourcecountry: "" }),
        ]),
      ],
      [GOOGLE]: ok(sample("google-news.xml"), "application/rss+xml"),
      [GOOGLE_UK]: { status: 500, text: "", contentType: "text/html" },
      [GAZETTE]: ok(sample("article.html")),
      [RALLY]: ok(page("Rally", "PauseAI US rallied outside the Capitol.")),
      [UNREAD]: new Error("timeout"),
      [PDF]: ok("%PDF", "application/pdf"),
      [LOCAL]: ok("<p>PauseAI UK met the council.</p>"),
    });

    const result = await runSurvey(input, run.deps);

    expect(run.waits).toEqual([GDELT_RETRIES[0]]);
    expect(run.asked).not.toContain(UK);
    expect(result.added).toEqual([
      {
        outlet: "The Example Gazette",
        title: "Protesters march on Whitehall & Parliament",
        url: GAZETTE,
        date: "2026-11-10",
        medium: "Article",
        note: expect.stringMatching(
          /^TODO verify: the page names PauseAI UK: ".*PauseAI UK outside Downing Street.*"$/,
        ),
      },
      {
        outlet: "local.example",
        title: "Council meets campaigners",
        url: LOCAL,
        date: "2026-11-10",
        medium: "Article",
        note: 'TODO verify: the page names PauseAI UK: "PauseAI UK met the council."',
      },
    ]);
    expect(result.leads.find((lead) => lead.url === UNREAD)?.others).toEqual([COPY]);
    const headlineOnly = "Patterns: PauseAI, not saying which. Only the headline was read.";
    const hidden = "The search matched the article's text, not its headline. Only the headline was read.";
    const google = expect.stringMatching(/^https:\/\/news\.google\.com\//);
    expect(result.leads.map((lead) => [lead.url, lead.why])).toEqual([
      [PDF, "Patterns: PauseAI UK. Only the headline was read."],
      [UNREAD, headlineOnly],
      [google, headlineOnly],
      [google, headlineOnly],
      [google, headlineOnly],
      [google, hidden],
    ]);
    expect(result.setAside.map((listed) => listed.why)).toContain("Patterns: PauseAI US, a different organisation.");
    expect(result.setAside.some((listed) => listed.url.includes("ft.com"))).toBe(false);
    expect(result.notes).toEqual([
      `Google News "PauseAI UK" OR "Pause AI UK" answered 500: no message`,
      "2 of 15 pages couldn't be read, so were judged on their headlines.",
      "No Claude review, as CLAUDE_CODE_OAUTH_TOKEN isn't set: only pages naming PauseAI UK were added, each marked TODO.",
    ]);
  });

  it("gives up on GDELT after its retries, saying what it said", async () => {
    const busy = { status: 429, text: sample("gdelt-429.txt"), contentType: "text/plain" };
    const run = deps({ [WORLD]: [busy, busy, busy, busy] });
    const result = await runSurvey(input, run.deps);
    expect(run.waits).toEqual(GDELT_RETRIES);
    expect(result.notes[0]).toBe(
      `GDELT ${WORLD} answered 429: Please limit requests to one every 5 seconds or contact us for larger queries.`,
    );
    const text = await runSurvey(input, deps({ [WORLD]: ok(sample("gdelt-429.txt"), "text/plain") }).deps);
    expect(text.notes[0]).toBe(
      `GDELT ${WORLD} answered: Please limit requests to one every 5 seconds or contact us for larger queries.`,
    );
  });

  it("finds nothing when every search fails, and counts a thrown non-error", async () => {
    const run = deps({});
    run.deps.fetch = async () => {
      throw "down";
    };
    const result = await runSurvey(input, run.deps);
    expect(result.added).toEqual([]);
    expect(result.notes[0]).toBe(`GDELT ${WORLD} failed: down`);
  });

  it("searches UK outlets too when the worldwide search is full, and lists at most so many set aside", async () => {
    const many = Array.from({ length: GDELT_MOST }, (_, i) =>
      gdelt(`https://example.com/${i}`, `Markets fall ${i}`, { sourcecountry: "" }),
    );
    const run = deps({ [WORLD]: json(many), [UK]: new Error("socket hang up") });
    const result = await runSurvey(input, run.deps);
    expect(run.waits).toEqual([GDELT_GAP]);
    expect(result.leads).toEqual([]);
    expect(result.setAside).toHaveLength(MOST_SET_ASIDE);
    expect(result.notes).toEqual([
      `GDELT ${UK} failed: socket hang up`,
      expect.stringMatching(/^No Claude review/),
      `${GDELT_MOST - MOST_SET_ASIDE} more stories were set aside, not listed.`,
    ]);
  });

  it("leaves a page naming PauseAI UK and PauseAI US to a person", async () => {
    const both = "https://example.com/both";
    const result = await runSurvey(
      input,
      deps({
        [WORLD]: json([gdelt(both, "Two groups")]),
        [both]: ok(page("Two groups", "PauseAI UK and PauseAI US both protested.")),
      }).deps,
    );
    expect(result.added).toEqual([]);
    expect(result.leads[0].why).toBe("Patterns: PauseAI UK. Also names PauseAI US, a different organisation.");
  });
});

describe("runSurvey with a model", () => {
  const VIDEO = "https://www.youtube.com/watch?v=abc";
  const known = {
    [WORLD]: json([
      gdelt(GAZETTE, "Protesters march on Whitehall"),
      gdelt(WESTMINSTER, "Pause AI campaigners"),
      gdelt(VIDEO, "Pause AI protest video", { domain: "youtube.com" }),
      gdelt(RALLY, "PauseAI rally"),
      gdelt(UNREAD, "Pause AI activists gather"),
      gdelt(PDF, "PauseAI chief speaks"),
      gdelt(SITE, "Site piece"),
      gdelt(BOTH, "Two groups"),
    ]),
    [SITE]: ok('<meta property="og:site_name" content="Site Daily"><p>PauseAI UK spoke.</p>'),
    [BOTH]: ok(page("Two groups", "PauseAI UK and PauseAI US both protested.")),
    [UNREAD]: new Error("timeout"),
    [GAZETTE]: ok(sample("article.html")),
    [WESTMINSTER]: ok(page("Pause AI campaigners", "Activists from Pause AI marched.")),
    [VIDEO]: ok(page("Pause AI protest video", "Pause AI protesters at Downing Street.")),
    [RALLY]: ok(page("PauseAI rally", "The PauseAI movement rallied.")),
    [PDF]: ok(page("PauseAI chief speaks", "The PauseAI chief spoke.")),
  };

  it("asks once, with every candidate, and follows each verdict it can", async () => {
    const prompts: string[] = [];
    const review = async (prompt: string) => {
      prompts.push(prompt);
      const ids = [...prompt.matchAll(/"id": "(c\d+)",\s+"title": "([^"]+)"/g)];
      const id = (title: string) => (ids.find(([, , t]) => t === title) as string[])[1];
      return JSON.stringify({
        is_error: false,
        structured_output: {
          verdicts: [
            {
              id: id("Protesters march on Whitehall"),
              decision: "include",
              org: "uk",
              reason: "Names PauseAI UK.",
              title: "Marchers on Whitehall",
              note: "Quotes Jane Smith of PauseAI UK.",
            },
            {
              id: id("Pause AI campaigners"),
              decision: "include",
              org: "global",
              reason: "Names PauseAI Global.",
              outlet: "Somebody Else",
            },
            {
              id: id("Pause AI protest video"),
              decision: "include",
              org: "uk",
              reason: "Our protest.",
              outlet: "the guardian",
            },
            { id: id("PauseAI rally"), decision: "include", org: "us", reason: "PauseAI US." },
            { id: id("Pause AI activists gather"), decision: "include", org: "uk", reason: "Headline only." },
            { id: id("PauseAI chief speaks"), decision: "reject", org: "lookalike", reason: "PauseAI.com." },
            { id: id("Site piece"), decision: "include", org: "uk", reason: "Names PauseAI UK.", date: "2026-11-01" },
          ],
        },
      });
    };

    const result = await runSurvey(input, deps(known, review).deps);

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("THREE DISTINCT ORGS, NOT TWO");
    expect(prompts[0]).toContain('"read": true');
    expect(prompts[0]).toContain('"patterns": "PauseAI UK; PauseAI US, a different organisation"');
    expect(result.added.find((addition) => addition.url === SITE)).toEqual({
      outlet: "Site Daily",
      title: "Site piece",
      url: SITE,
      date: "2026-11-01",
      medium: "Article",
      note: "Names PauseAI UK.",
    });
    expect(result.added.filter((addition) => addition.url !== SITE)).toEqual([
      {
        outlet: "The Example Gazette",
        title: "Marchers on Whitehall",
        url: GAZETTE,
        date: "2026-11-10",
        medium: "Article",
        note: "Quotes Jane Smith of PauseAI UK.",
      },
      {
        outlet: "Westminster Extra",
        title: "Pause AI campaigners",
        url: WESTMINSTER,
        date: "2026-11-10",
        medium: "Article",
        note: "Names PauseAI Global.",
      },
      {
        outlet: "The Guardian",
        title: "Pause AI protest video",
        url: VIDEO,
        date: "2026-11-10",
        medium: "Video",
        note: "Our protest.",
      },
    ]);
    expect(result.leads.map((lead) => lead.why)).toEqual([
      "Patterns: PauseAI UK. Also names PauseAI US, a different organisation.",
      "Claude: PauseAI US.",
      "Claude: Headline only. Only the headline was read.",
    ]);
    expect(result.setAside.map((listed) => listed.why)).toEqual(["Claude: PauseAI.com."]);
  });

  it("falls back to the patterns when the review fails, or misses a candidate", async () => {
    const failed = await runSurvey(input, deps(known, async () => "not json").deps);
    expect(failed.notes.at(-1)).toMatch(/^Claude's review failed, so the candidates were sorted by pattern alone: /);
    expect(failed.added.map((addition) => addition.url)).toEqual([GAZETTE, SITE]);

    const silent = await runSurvey(
      input,
      deps(known, async () => JSON.stringify({ structured_output: { verdicts: [] } })).deps,
    );
    expect(silent.added.map((addition) => addition.url)).toEqual([GAZETTE, SITE]);
    expect(silent.notes).toEqual(["1 of 8 pages couldn't be read, so were judged on their headlines."]);
  });

  it("doesn't ask when there are no candidates", async () => {
    let asked = false;
    const review = async () => {
      asked = true;
      return "";
    };
    await runSurvey(input, deps({}, review).deps);
    expect(asked).toBe(false);
  });
});

it("outletsBySite knows an outlet by its own site, not one many outlets share", () => {
  const sites = outletsBySite([
    {
      name: "A",
      articles: [{ url: "https://www.a.example/1" }, { links: [{ url: "https://youtube.com/1" }] }],
    },
    { name: "B", articles: [{ url: "https://b.example/1" }, { url: "https://c.example/1" }] },
    { name: "C", articles: [{ url: "https://c.example/2" }, {}] },
  ]);
  expect([...sites]).toEqual([
    ["a.example", "A"],
    ["b.example", "B"],
  ]);
});
