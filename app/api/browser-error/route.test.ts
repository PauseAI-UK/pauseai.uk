import { expect, it } from "vitest";
import { query } from "@/lib/server/db.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { POST } from "./route";

const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";
const OURS = { "sec-fetch-site": "same-origin", "user-agent": FIREFOX };

const REPORT = {
  kind: "browser-page",
  name: "TypeError",
  words: "can't access property 3 of rows",
  stack: "TypeError: can't access property 3 of rows\n    at a (https://pauseai.uk/_next/static/chunks/4f2a.js:1:2345)",
  path: "/staff/politicians/4127",
};

function post(body: unknown, headers: Record<string, string> = OURS) {
  return POST(
    new Request("https://pauseai.uk/api/browser-error", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers,
    }),
  );
}

const kept = () => query(`SELECT kind, route, name, words, latest_browser AS browser FROM errors_seen ORDER BY id`);

describeWithDatabase("POST /api/browser-error", () => {
  useTestDatabase();

  it("keeps an error that a page of the site's posts, with the browser it came from", async () => {
    const response = await post(REPORT);
    expect([response.status, await response.text()]).toEqual([204, ""]);
    expect(await kept()).toEqual([
      {
        kind: "browser-page",
        route: "/staff/politicians/<n>",
        name: "TypeError",
        words: "can't access property <n> of rows",
        browser: "Firefox 131",
      },
    ]);
  });

  it("keeps nothing posted from another site, or by something that isn't a browser saying where it's from", async () => {
    const elsewhere: Record<string, string>[] = [
      { "sec-fetch-site": "cross-site" },
      { "sec-fetch-site": "same-site" },
      {},
    ];
    for (const headers of elsewhere) expect((await post(REPORT, headers)).status).toBe(204);
    expect(await kept()).toEqual([]);
  });

  it("keeps nothing that's too big, isn't JSON, or isn't shaped as an error from a browser", async () => {
    const bodies = [
      { ...REPORT, stack: "x".repeat(40_000) },
      "not JSON",
      null,
      [REPORT],
      { ...REPORT, kind: "render" },
      { ...REPORT, kind: undefined },
      { ...REPORT, name: 7 },
      { ...REPORT, words: ["a"] },
      { ...REPORT, words: "" },
      { ...REPORT, stack: undefined },
      { ...REPORT, path: undefined },
      { ...REPORT, path: "https://elsewhere.example/" },
    ];
    for (const body of bodies) expect((await post(body)).status).toBe(204);
    expect(await kept()).toEqual([]);
  });
});
