import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { notifications } from "@/tests/notifications";
import { newsPagesFake } from "@/lib/server/fixtures/fakes/news-pages";
import { query } from "@/lib/server/db.server";
import * as googleNews from "@/lib/server/outside-services/google-news.server";
import { pressCopy } from "./copy";
import { MOST_READS } from "./finds";
import type { Candidate } from "./review";
import { GAP_MS, runPressSurvey } from "./survey.server";

// The fixture news sites have no addresses, so each is taken to be on the public internet.
vi.mock("@/lib/server/outside-services/public-address.server", () => ({ isPublicHost: async () => true }));

vi.mock("@/lib/server/outside-services/google-news.server", async (original) => {
  const real = await original<typeof import("@/lib/server/outside-services/google-news.server")>();
  return { ...real, articleAddress: vi.fn(real.articleAddress) };
});

// The fixture clock's day: the first night searches from 1 October, the
// day after where the migration starts the search, to the 16th, a week at
// a time, and finds FIXTURE_NEWS (lib/server/fixtures/fakes/google-news.ts).
const NIGHT = new Date("2026-10-16T06:29:00Z");
const JAPAN_TIMES = "https://www.japantimes.co.jp/commentary/2026/10/07/world/ai-doomsday-risk/";

beforeEach(() => {
  vi.useFakeTimers({ now: NIGHT, toFake: ["Date"] });
  vi.stubEnv("ANTHROPIC_API_KEY", "key");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.mocked(googleNews.articleAddress).mockClear();
});

/**
 * What Claude is asked, each time it asks, as the survey describes it: the
 * finds it's asked to judge, and the news sites it's asked about, by name.
 * The fake answers.
 */
function askedClaude(): { finds: Candidate[][]; sites: string[][] } {
  const asked: { finds: Candidate[][]; sites: string[][] } = { finds: [], sites: [] };
  server.use(
    http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
      const { messages } = (await request.clone().json()) as { messages: { content: string }[] };
      const sources = /<sources>([\s\S]*?)<\/sources>/.exec(messages[0].content)?.[1];
      if (sources) asked.sites.push((JSON.parse(sources) as { site: string }[]).map(({ site }) => site));
      else asked.finds.push(JSON.parse(/<candidates>([\s\S]*)<\/candidates>/.exec(messages[0].content)![1]));
    }),
  );
  return asked;
}

/** One find left unread from an earlier night, under `title`, with nothing left to search; its page is the Gazette's march. */
async function oneFind(title: string): Promise<void> {
  await query("UPDATE press_search SET searched_to = '2026-10-15'");
  await query(
    "INSERT INTO press_finds (google_link, title) VALUES ('https://news.google.com/rss/articles/fixture-march', $1)",
    [title],
  );
}

/** The Gazette's march page, which the find leads to, answered with `body`. */
function marchPage(body: string) {
  server.use(
    http.get(
      "https://www.examplegazette.co.uk/news/march",
      () => new HttpResponse(`<html><body><article>${body}</article></body></html>`, { headers: HTML }),
    ),
  );
}

/** The Gazette's march page refuses us. */
const marchRefused = () =>
  server.use(http.get("https://www.examplegazette.co.uk/news/march", () => new HttpResponse(null, { status: 403 })));

const HTML = { "Content-Type": "text/html; charset=utf-8" };

/** The Gazette's site, as Claude judged it on an earlier night. */
const gazetteTier = (tier: number) =>
  query("INSERT INTO press_sources (site, name, tier) VALUES ('examplegazette.co.uk', 'The Example Gazette', $1)", [
    tier,
  ]);

const findState = async () =>
  (await query<{ state: string; verdict: string | null }>("SELECT state, verdict FROM press_finds"))[0];

/**
 * Counts each pause of GAP_MS the survey takes between requests to Google,
 * taking none. Node's fetch sets timers of that length too, a connection's
 * keep-alive, but always with an argument for the timer, which the
 * survey's pause has none of.
 */
function gapsTaken(): { count: number } {
  const taken = { count: 0 };
  const realSetTimeout = globalThis.setTimeout;
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((
    handler: (...args: unknown[]) => void,
    ms?: number,
    ...args: unknown[]
  ) => {
    if (ms !== GAP_MS || args.length > 0) return realSetTimeout(handler, ms, ...args);
    taken.count++;
    return realSetTimeout(handler, 0);
  }) as typeof setTimeout);
  return taken;
}

/** The Japan Times piece on /press already, as the migration has it. */
async function coverageOnPress() {
  const [{ id }] = await query<{ id: number }>(
    "INSERT INTO press_outlets (name) VALUES ('The Japan Times') RETURNING id::int",
  );
  await query(
    `INSERT INTO press_coverage (outlet_id, title, medium, url, created_by)
     VALUES ($1, 'Hedging the AI doomsday risk', 'Article', $2, 'test')`,
    [id, JAPAN_TIMES],
  );
}

const finds = () =>
  query<{ title: string; state: string; verdict: string | null; org: string | null; passage: string | null }>(
    "SELECT title, state, verdict, org, passage FROM press_finds ORDER BY title",
  );

const searchedTo = async () =>
  (await query<{ day: string }>("SELECT to_char(searched_to, 'YYYY-MM-DD') AS day FROM press_search"))[0].day;

const problemCodes = async () =>
  (await query<{ problems: { code: string }[] }>("SELECT problems FROM import_runs ORDER BY id")).flatMap((run) =>
    run.problems.map((problem) => problem.code),
  );

describeWithDatabase("runPressSurvey", () => {
  useTestDatabase();

  it("searches the days since the last search, reads every find, asks Claude, and tells staff of those waiting", async () => {
    await coverageOnPress();
    const sent = notifications();
    expect(await runPressSurvey("nightly", undefined, 0)).toEqual({
      searched: 3,
      found: 6,
      read: 5,
      known: 1,
      unreadable: 0,
      waiting: 2,
      notOurs: 3,
      left: 0,
      told: 2,
    });
    expect(await finds()).toEqual([
      { title: "AI summit opens in Seoul", state: "not ours", verdict: "not ours", org: "none", passage: null },
      {
        title: "Council votes to pause AI chatbot pilot",
        state: "not ours",
        verdict: "not ours",
        org: "none",
        passage: expect.stringContaining("pause AI chatbots"),
      },
      { title: "Hedging the AI doomsday risk", state: "known", verdict: null, org: null, passage: null },
      {
        title: "Movement founder warns of AI risks",
        state: "waiting",
        verdict: "ours",
        org: "global",
        passage: expect.stringContaining("PauseAI Global"),
      },
      {
        title: "Protesters march on Whitehall",
        state: "waiting",
        verdict: "ours",
        org: "uk",
        // The caption that names us, rather than the text.
        passage: "Campaigners from PauseAI UK outside Downing Street. Photo: Jane Smith",
      },
      {
        title: "Rally in Washington calls for AI limits",
        state: "not ours",
        verdict: "not ours",
        org: "us",
        passage: expect.stringContaining("PauseAI US"),
      },
    ]);
    // Today is searched again tomorrow.
    expect(await searchedTo()).toBe("2026-10-15");
    expect(sent.map((email) => email.Subject)).toEqual([pressCopy.waitingEmail.subject(2)]);
    expect(sent[0].TextBody).toContain("The Example Gazette: Protesters march on Whitehall");
    expect(sent[0].TextBody).toContain("https://www.examplegazette.co.uk/news/march");
    expect(sent[0].TextBody).toContain("https://pauseai.uk/staff/press");

    // A second call that day searches nothing, finds nothing unread, and tells staff of nothing new.
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ searched: 0, found: 0, read: 0, told: 0 });
    expect(sent).toHaveLength(1);
  });

  it("without Claude's key, sends staff the finds the patterns say could be ours, with no verdict", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await coverageOnPress();
    notifications();
    const asked = askedClaude();
    await runPressSurvey("nightly", undefined, 0);
    // Nor are the news sites asked about, so they're asked about once there's a key.
    expect(asked).toEqual({ finds: [], sites: [] });
    expect(await query("SELECT site FROM press_sources")).toEqual([]);
    expect((await finds()).map(({ title, state, verdict }) => [title, state, verdict])).toEqual([
      ["AI summit opens in Seoul", "not ours", null],
      ["Council votes to pause AI chatbot pilot", "not ours", null],
      ["Hedging the AI doomsday risk", "known", null],
      ["Movement founder warns of AI risks", "waiting", null],
      ["Protesters march on Whitehall", "waiting", null],
      ["Rally in Washington calls for AI limits", "not ours", null],
    ]);
  });

  it("falls back to the patterns, and says so, when Claude fails, leaving the news sites to be asked about again", async () => {
    server.use(http.post("https://api.anthropic.com/v1/messages", () => new HttpResponse("down", { status: 500 })));
    await coverageOnPress();
    notifications();
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ waiting: 2, notOurs: 3 });
    expect(await problemCodes()).toEqual(["press.notJudged", "press.sourcesNotJudged"]);
    expect(await query("SELECT site FROM press_sources")).toEqual([]);
  });

  it("asks Claude about each news site once, the first time a find from it is read", async () => {
    await coverageOnPress();
    notifications();
    const asked = askedClaude();
    await runPressSurvey("nightly", undefined, 0);
    // The Japan Times' piece is known already, so it isn't read.
    const sites = [
      "examplegazette.co.uk",
      "exampletimes.com",
      "exampleweekly.com",
      "examplewire.com",
      "news.example.org",
    ];
    expect(asked.sites.map((each) => [...each].sort())).toEqual([sites]);
    expect(
      (await query<{ site: string }>("SELECT site FROM press_sources ORDER BY site")).map(({ site }) => site),
    ).toEqual(sites);

    // A find from a site met before, read on a later night, is judged with no question about its site.
    await query("UPDATE press_finds SET state = 'unread' WHERE title = 'Protesters march on Whitehall'");
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ read: 1, waiting: 1 });
    expect(asked.finds).toHaveLength(2);
    expect(asked.sites).toHaveLength(1);
  });

  it("removes a find from a site that isn't news, even when Claude says it's ours", async () => {
    await oneFind("Protesters march on Whitehall");
    await gazetteTier(4);
    const asked = askedClaude();
    notifications();
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ read: 1, waiting: 0, notOurs: 1 });
    expect(await findState()).toEqual({ state: "not ours", verdict: "ours" });
    // The site was met before, so it isn't asked about.
    expect(asked.sites).toEqual([]);
  });

  it("removes a find read whole that Claude says isn't ours, whatever its site's tier", async () => {
    await oneFind("Ministers meet on AI");
    await gazetteTier(1);
    marchPage(
      `<h1>Ministers meet on AI</h1><p>${"Ministers met in London to talk about the safety of AI. ".repeat(12)}</p>`,
    );
    notifications();
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ read: 1, notOurs: 1 });
    expect(await findState()).toEqual({ state: "not ours", verdict: "not ours" });
  });

  it("sends staff a find whose page has too little text to judge by, from a site worth more, though Claude says it isn't ours", async () => {
    await oneFind("Ministers meet on AI");
    await gazetteTier(1);
    // A video's page, say: a line under it, and no more.
    marchPage("<h1>Ministers meet on AI</h1><p>Watch ministers meet in London.</p>");
    notifications();
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ read: 1, waiting: 1 });
    expect(await findState()).toEqual({ state: "waiting", verdict: "not ours" });
  });

  it.each([1, 2])(
    "sends staff a find whose site won't show its page, from a site of tier %i, though Claude says it isn't ours",
    async (tier) => {
      await oneFind("Ministers meet on AI");
      await gazetteTier(tier);
      marchRefused();
      notifications();
      expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ read: 1, waiting: 1 });
      expect(await findState()).toEqual({ state: "waiting", verdict: "not ours" });
    },
  );

  it.each(["PauseAI protesters march on Whitehall", "Joseph Miller on the race to build AI"])(
    "sends staff a find known only by a headline that names us, though Claude says it isn't ours: %s",
    async (title) => {
      await oneFind(title);
      marchRefused();
      notifications();
      expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ read: 1, waiting: 1 });
      expect(await findState()).toEqual({ state: "waiting", verdict: "not ours" });
    },
  );

  it("searches the last week again each night, for a piece Google returns late, but each day once", async () => {
    await query("UPDATE press_search SET searched_to = '2026-10-15'");
    const searched: string[] = [];
    server.use(
      http.get("https://news.google.com/rss/search", ({ request }) => {
        searched.push(new URL(request.url).searchParams.get("q") ?? "");
        return new HttpResponse('<rss version="2.0"><channel></channel></rss>');
      }),
    );
    // The night of the 16th has searched up to the 15th already.
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ searched: 0 });
    // The next night searches the week before it again, not just the day since.
    vi.setSystemTime(new Date("2026-10-17T06:29:00Z"));
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ searched: 1 });
    expect(searched.map((q) => /after:\S+ before:\S+/.exec(q)?.[0])).toEqual([
      "after:2026-10-10 before:2026-10-18",
      "after:2026-10-10 before:2026-10-18",
      "after:2026-10-10 before:2026-10-18",
    ]);
    expect(await searchedTo()).toBe("2026-10-16");
  });

  it("searches a week again tomorrow when Google refuses it, or answers with something that isn't its feed", async () => {
    server.use(http.get("https://news.google.com/rss/search", () => new HttpResponse(null, { status: 503 })));
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ searched: 0, found: 0 });
    expect(await searchedTo()).toBe("2026-09-30");
    server.use(
      http.get("https://news.google.com/rss/search", () => new HttpResponse("<html>Before you continue</html>")),
    );
    await runPressSurvey("nightly", undefined, 0);
    expect(await searchedTo()).toBe("2026-09-30");
    expect(await problemCodes()).toEqual(["press.searchFailed", "press.searchFailed"]);
  });

  it("tries a find that can't be read again, keeping why, and after its last try judges it by its headline", async () => {
    await oneFind("PauseAI protesters march on Whitehall");
    server.use(
      http.post(
        "https://news.google.com/_/DotsSplashUi/data/batchexecute",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const asked = askedClaude();
    for (let night = 1; night < MOST_READS; night++) {
      expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ unreadable: 1, left: 1, told: 0 });
    }
    expect(asked.finds).toEqual([]);
    const sent = notifications();
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ unreadable: 1, left: 0, told: 1 });
    // Its address was never known, so Claude has its headline and Google link, no page, and no site is asked about.
    expect(asked).toEqual({
      finds: [
        [
          {
            id: "1",
            title: "PauseAI protesters march on Whitehall",
            url: "https://news.google.com/rss/articles/fixture-march",
            outlet: null,
            date: null,
            patterns: "unspecified",
          },
        ],
      ],
      sites: [],
    });
    const [find] = await query<{ state: string; reads: number; failure: { kind: string; service: string } }>(
      "SELECT state, reads, read_failure AS failure FROM press_finds",
    );
    expect(find).toEqual({
      // The fake Claude finds nothing of us in a headline alone, but the headline names us.
      state: "waiting",
      reads: MOST_READS,
      failure: expect.objectContaining({ service: "google-news", kind: "refused" }),
    });
    // With no outlet or address of its own, the email names its Google link's site.
    expect(sent[0].TextBody).toContain("news.google.com: PauseAI protesters march on Whitehall");
    expect(await problemCodes()).toEqual(Array(MOST_READS).fill("press.findNotRead"));
  });

  it("removes a find whose last try failed when Claude says from its headline it isn't ours", async () => {
    await oneFind("Ministers meet on AI");
    await query("UPDATE press_finds SET reads = $1", [MOST_READS - 1]);
    server.use(http.get("https://www.examplegazette.co.uk/news/march", () => HttpResponse.error()));
    notifications();
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ unreadable: 1, notOurs: 1, left: 0 });
    expect(
      await query("SELECT state, verdict, url, site, read_failure->>'service' AS service FROM press_finds"),
    ).toEqual([
      {
        state: "not ours",
        verdict: "not ours",
        url: "https://www.examplegazette.co.uk/news/march",
        // Its site was asked about, from its address.
        site: "examplegazette.co.uk",
        service: "news-page",
      },
    ]);
    expect(await query("SELECT site, tier FROM press_sources")).toEqual([{ site: "examplegazette.co.uk", tier: 3 }]);
  });

  it("stops reading when Google blocks us, spending none of the find's tries, and says so", async () => {
    await query("UPDATE press_search SET searched_to = '2026-10-15'");
    await query(
      `INSERT INTO press_finds (google_link, title) VALUES
         ('https://news.google.com/rss/articles/fixture-march', 'A find'),
         ('https://news.google.com/rss/articles/fixture-global', 'Another')`,
    );
    server.use(
      http.get(
        /news\.google\.com\/articles\//,
        () => new HttpResponse(null, { status: 302, headers: { Location: "https://www.google.com/sorry/index" } }),
      ),
    );
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ read: 0, unreadable: 0, left: 2 });
    expect(await query("SELECT reads, state FROM press_finds")).toEqual([
      { reads: 0, state: "unread" },
      { reads: 0, state: "unread" },
    ]);
    // It stopped at the first, rather than asking Google again for the second.
    expect(googleNews.articleAddress).toHaveBeenCalledTimes(1);
    expect(await problemCodes()).toEqual(["press.googleBlocked"]);
  });

  it("judges a find whose site won't show its page by its headline, keeping why, and removes it when that isn't ours", async () => {
    await oneFind("A find");
    marchRefused();
    notifications();
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ read: 1, notOurs: 1, left: 0 });
    expect(
      await query("SELECT url, state, verdict, medium, reads, read_failure->>'kind' AS kind FROM press_finds"),
    ).toEqual([
      {
        url: "https://www.examplegazette.co.uk/news/march",
        // The fake Claude finds nothing of us in a headline alone, the headline doesn't name us, and the fake takes
        // the site, which Google gave no name for, as other news.
        state: "not ours",
        verdict: "not ours",
        medium: "Article",
        reads: 1,
        kind: "unauthorised",
      },
    ]);
    expect(await query("SELECT name, tier FROM press_sources")).toEqual([{ name: "examplegazette.co.uk", tier: 3 }]);
    // A refusal is no fault of ours, so it isn't a problem of the run's.
    expect(await problemCodes()).toEqual([]);
  });

  it("tries a find again when its site is down, rather than taking it for a refusal, but not one that refuses us", async () => {
    for (const [status, kept] of [
      [500, "unread"],
      [503, "unread"],
      [406, "not ours"],
      [410, "not ours"],
    ] as const) {
      await query("DELETE FROM press_finds");
      await oneFind("A find");
      server.use(http.get("https://www.examplegazette.co.uk/news/march", () => new HttpResponse(null, { status })));
      await runPressSurvey("nightly", undefined, 0);
      expect(await query("SELECT state, reads FROM press_finds"), String(status)).toEqual([{ state: kept, reads: 1 }]);
    }
  });

  it("stops reading, and searching, when its time is up, leaving the rest for the next call", async () => {
    // Each news page takes a minute to read, so the first uses the call's time.
    server.use(
      http.get(/example/, ({ request }) => {
        vi.setSystemTime(Date.now() + 60_000);
        return newsPagesFake(new URL(request.url), undefined, undefined);
      }),
    );
    notifications();
    const first = await runPressSurvey("nightly", undefined, 0);
    expect(first).toMatchObject({ searched: 3, read: 1, told: 0 });
    expect(first.left).toBeGreaterThan(3);
    // A search still going when the time runs out stops after the week it's on.
    vi.setSystemTime(new Date("2026-11-30T06:29:00Z"));
    server.use(
      http.get("https://news.google.com/rss/search", () => {
        vi.setSystemTime(Date.now() + 60_000);
        return new HttpResponse('<rss version="2.0"><channel></channel></rss>');
      }),
    );
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ searched: 1 });
  });

  it("keeps a piece Google gives no headline, outlet or date for, under its link", async () => {
    // One week's window is left to search.
    await query("UPDATE press_search SET searched_to = '2026-10-14'");
    const link = "https://news.google.com/rss/articles/fixture-march";
    server.use(
      http.get(
        "https://news.google.com/rss/search",
        () =>
          new HttpResponse(
            `<rss version="2.0"><channel><item><title></title><link>${link}</link></item></channel></rss>`,
          ),
      ),
    );
    notifications();
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ searched: 1, found: 1, read: 1 });
    expect(await query("SELECT title, outlet_name AS outlet, published FROM press_finds")).toEqual([
      { title: link, outlet: null, published: null },
    ]);
  });

  it("passes over an address in the coverage that isn't a web address, as no article has it", async () => {
    await query("UPDATE press_search SET searched_to = '2026-10-15'");
    const [{ id }] = await query<{ id: number }>(
      "INSERT INTO press_outlets (name) VALUES ('The Example Gazette') RETURNING id::int",
    );
    await query(
      `INSERT INTO press_coverage (outlet_id, title, medium, links, created_by)
       VALUES ($1, 'Letters page', 'Article', '[{"label": "Email", "url": "mailto:letters@example.org"}]', 'test')`,
      [id],
    );
    await query(
      "INSERT INTO press_finds (google_link, title) VALUES ('https://news.google.com/rss/articles/fixture-march', 'A find')",
    );
    notifications();
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ read: 1, known: 0 });
  });

  it("reads a page with no title, leaving out a caption that's blank once its hidden characters are gone", async () => {
    await query("UPDATE press_search SET searched_to = '2026-10-15'");
    await query(
      "INSERT INTO press_finds (google_link, title) VALUES ('https://news.google.com/rss/articles/fixture-march', 'A find')",
    );
    server.use(
      http.get(
        "https://www.examplegazette.co.uk/news/march",
        () =>
          new HttpResponse(
            `<html><body><img src="/march.jpg" alt="​"><p>Campaigners from PauseAI UK marched.</p></body></html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          ),
      ),
    );
    const asked = askedClaude();
    notifications();
    expect(await runPressSurvey("nightly", undefined, 0)).toMatchObject({ read: 1, waiting: 1 });
    expect(asked.finds).toEqual([
      [expect.objectContaining({ page: { captions: [], excerpts: ["Campaigners from PauseAI UK marched."] } })],
    ]);
  });

  it.each([
    { build: "the live site", env: {}, gaps: 1 },
    { build: "a fixture build, where Google's fake answers", env: { DATA_FIXTURES: "1" }, gaps: 0 },
    {
      build: "a fixture build that asks the real Google",
      env: { DATA_FIXTURES: "1", REAL_SERVICES: "news-page,google-news" },
      gaps: 1,
    },
  ])("pauses $gaps time(s) between reading two finds on $build", async ({ env, gaps }) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    await query("UPDATE press_search SET searched_to = '2026-10-15'");
    await query(
      `INSERT INTO press_finds (google_link, title) VALUES
         ('https://news.google.com/rss/articles/fixture-march', 'A find'),
         ('https://news.google.com/rss/articles/fixture-global', 'Another')`,
    );
    const taken = gapsTaken();
    notifications();
    expect(await runPressSurvey("nightly")).toMatchObject({ read: 2 });
    expect(taken.count).toBe(gaps);
  });

  it("throws on anything going wrong that isn't the service failing, which is a bug of ours", async () => {
    const thrown = new TypeError("not a function");
    vi.mocked(googleNews.articleAddress).mockRejectedValueOnce(thrown);
    await expect(runPressSurvey("nightly", undefined, 0)).rejects.toBe(thrown);
  });
});
