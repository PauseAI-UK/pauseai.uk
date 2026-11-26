import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { query } from "@/lib/server/db.server";
import { CAREFUL_MODEL } from "@/lib/server/outside-services/anthropic.server";
import { inRun } from "@/lib/server/run-store.server";
import { pressProblems } from "./copy";
import { judgeSources, sourcesOf } from "./sources.server";
import type { Source } from "./sources";

beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", "key"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const MESSAGES = "https://api.anthropic.com/v1/messages";

/** Each request to Claude: its model and the sources in it. The fake answers. */
function askedClaude(): { model: string; sources: { name: string; site: string }[] }[] {
  const asked: { model: string; sources: { name: string; site: string }[] }[] = [];
  server.use(
    http.post(MESSAGES, async ({ request }) => {
      const { model, messages } = (await request.clone().json()) as { model: string; messages: { content: string }[] };
      const sources = JSON.parse(/<sources>([\s\S]*?)<\/sources>/.exec(messages[0].content)![1]) as {
        name: string;
        site: string;
      }[];
      asked.push({ model, sources: sources.map(({ name, site }) => ({ name, site })) });
    }),
  );
  return asked;
}

const kept = () =>
  query(
    `SELECT s.site, s.name, s.tier, o.name AS outlet, s.reason FROM press_sources s
       LEFT JOIN press_outlets o ON o.id = s.outlet_id ORDER BY s.site`,
  );

const GAZETTE: Source = { site: "examplegazette.co.uk", name: "The Example Gazette" };
const WIRE: Source = { site: "examplewire.com", name: "Example Wire" };
const TIMES: Source = { site: "exampletimes.com", name: "The Example Times" };
const LOCAL: Source = { site: "news.example.org", name: "Example Local News" };

describeWithDatabase("judgeSources", () => {
  useTestDatabase();

  it("asks the careful model about each new site in one request, and keeps its tier and the outlet it is", async () => {
    await query("INSERT INTO press_outlets (name) VALUES ('The Example Gazette')");
    const asked = askedClaude();
    // A site met twice in one run is asked about once.
    await judgeSources([GAZETTE, WIRE, TIMES, LOCAL, GAZETTE]);
    expect(asked).toEqual([{ model: CAREFUL_MODEL, sources: [GAZETTE, WIRE, TIMES, LOCAL] }]);
    expect(await kept()).toEqual([
      {
        site: "examplegazette.co.uk",
        name: "The Example Gazette",
        tier: 3,
        outlet: "The Example Gazette",
        reason: "Judged by the fake from its name, The Example Gazette.",
      },
      expect.objectContaining({ site: "exampletimes.com", tier: 2, outlet: null }),
      expect.objectContaining({ site: "examplewire.com", tier: 4, outlet: null }),
      // The fake doesn't know it.
      expect.objectContaining({ site: "news.example.org", tier: null, outlet: null }),
    ]);
  });

  it("asks only about the sites it hasn't met, and asks nothing when it has met them all", async () => {
    const asked = askedClaude();
    await judgeSources([GAZETTE]);
    await judgeSources([GAZETTE, WIRE]);
    await judgeSources([WIRE, GAZETTE]);
    await judgeSources([]);
    expect(asked.map(({ sources }) => sources)).toEqual([[GAZETTE], [WIRE]]);
  });

  it("keeps nothing, and says so, when Claude can't be asked, so the sites are asked about next time", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(MESSAGES, () => new HttpResponse("down", { status: 500 })));
    const problems = await inRun(async (run) => {
      await judgeSources([GAZETTE, WIRE]);
      return run.problems.map(({ code, values }) => ({ code, values }));
    });
    const { code, values } = pressProblems.sourcesNotJudged({ sites: 2 });
    expect(problems).toEqual([{ code, values }]);
    expect(await kept()).toEqual([]);

    server.resetHandlers();
    const asked = askedClaude();
    await judgeSources([GAZETTE, WIRE]);
    expect(asked.map(({ sources }) => sources)).toEqual([[GAZETTE, WIRE]]);
  });

  it("keeps only the sites Claude answered for, so the rest are asked about next time", async () => {
    server.use(
      http.post(MESSAGES, () =>
        HttpResponse.json({
          stop_reason: "end_turn",
          content: [
            { type: "text", text: JSON.stringify({ sources: [{ id: "1", tier: "1", sameAs: null, why: "" }] }) },
          ],
        }),
      ),
    );
    await judgeSources([GAZETTE, WIRE]);
    expect((await kept()).map(({ site }) => site)).toEqual(["examplewire.com"]);
  });
});

describeWithDatabase("sourcesOf", () => {
  useTestDatabase();

  it("gives the tier and outlet of each site met, and nothing for one that isn't", async () => {
    const [{ id }] = await query<{ id: number }>(
      "INSERT INTO press_outlets (name) VALUES ('The Example Gazette') RETURNING id::int",
    );
    await query(
      `INSERT INTO press_sources (site, name, tier, outlet_id) VALUES
         ('examplegazette.co.uk', 'The Example Gazette', 3, $1), ('news.example.org', 'Example Local News', NULL, NULL)`,
      [id],
    );
    expect(await sourcesOf(["examplegazette.co.uk", "news.example.org", "examplewire.com"])).toEqual(
      new Map([
        ["examplegazette.co.uk", { tier: 3, outletId: id }],
        ["news.example.org", { tier: null, outletId: null }],
      ]),
    );
  });
});
