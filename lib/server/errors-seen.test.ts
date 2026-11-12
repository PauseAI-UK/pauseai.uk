import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { staffCopy } from "@/lib/content/staff-interface";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { NOTIFICATIONS, notifications } from "@/tests/notifications";
import { query } from "./db";
import {
  BROWSER_EMAILS_AN_HOUR,
  errorSeen,
  keepBrowserError,
  keepProblem,
  keepRequestError,
  listErrorsSeen,
  NEW_BROWSER_ERRORS_AN_HOUR,
  SERVER_EMAILS_AN_HOUR,
  tidyErrorsSeen,
} from "./errors-seen";
import { registerProblemKeeper } from "./problems";

// Next's after() only works inside a request. Here it runs what it's given, or throws as it does outside one.
const held = vi.hoisted(() => ({ work: [] as unknown[], outside: false }));
vi.mock("next/server", async (importActual) => ({
  ...(await importActual<typeof import("next/server")>()),
  after: (work: () => unknown) => {
    if (held.outside) throw new Error("`after` was called outside a request scope");
    held.work.push(work());
  },
}));

const copy = staffCopy.errorsSeen;
const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";

/** What Next hands onRequestError besides the error. */
const REQUEST = { path: "/staff/politicians/4127", method: "GET", headers: {} };
const where = (routeType: "render" | "route" | "action" | "proxy", routePath: string) =>
  ({ routerKind: "App Router", routePath, routeType, revalidateReason: undefined }) as const;
const PAGE = where("render", "/staff/politicians/[id]");

const thrown = (error: unknown, context = PAGE) => keepRequestError(error, REQUEST, context);

type Row = {
  kind: string;
  route: string;
  name: string;
  code: string | null;
  words: string;
  latest: string;
  count: number;
  browser: string | null;
  alerted: boolean;
};

const rows = () =>
  query<Row>(
    `SELECT kind, route, name, code, words, latest_words AS latest, count, latest_browser AS browser,
       alerted_at IS NOT NULL AS alerted
     FROM errors_seen ORDER BY id`,
  );

beforeEach(() => {
  held.work = [];
  held.outside = false;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  registerProblemKeeper(undefined);
});

describeWithDatabase("errors the server throws", () => {
  useTestDatabase();

  it("keeps one, and counts it again when only what varies differs", async () => {
    await thrown(new TypeError("No politician 4127"));
    const again = new TypeError("No politician 4128");
    await thrown(again);
    expect(await rows()).toEqual([
      {
        kind: "render",
        route: "/staff/politicians/[id]",
        name: "TypeError",
        code: null,
        words: "No politician <n>",
        latest: "No politician 4128",
        count: 2,
        browser: null,
        alerted: false,
      },
    ]);
    const [{ stack }] = await query<{ stack: string }>("SELECT latest_stack AS stack FROM errors_seen");
    expect(stack).toBe(again.stack);
  });

  it("keeps apart errors that differ by where they were, what ran, their class or their words", async () => {
    await thrown(new Error("It broke"));
    await thrown(new Error("It broke"), where("render", "/staff/letters/[id]"));
    await thrown(new Error("It broke"), where("action", "/staff/politicians/[id]"));
    await thrown(new RangeError("It broke"));
    await thrown(new Error("It broke another way"));
    expect((await rows()).map((row) => row.count)).toEqual([1, 1, 1, 1, 1]);
  });

  it("knows a Postgres error by its code and constraint, whatever its message quotes", async () => {
    const insert = (id: number) =>
      query(
        "INSERT INTO errors_seen (id, key, kind, route, name, words, latest_words) OVERRIDING SYSTEM VALUE VALUES ($1, 'k', 'route', '', '', '', '')",
        [id],
      );
    await insert(900);
    const refused = await insert(901).catch((error: unknown) => error);
    await query("DELETE FROM errors_seen");
    await thrown(refused);
    // Shaped as pg's own, whose class is named "error".
    await thrown(
      Object.assign(new Error("another value refused"), {
        name: "error",
        code: "23505",
        severity: "ERROR",
        constraint: "errors_seen_key_key",
      }),
    );
    expect(await rows()).toEqual([
      expect.objectContaining({ code: "23505 errors_seen_key_key", count: 2, latest: "another value refused" }),
    ]);
  });

  it("keeps any other error's code beside its words, which still say which it is", async () => {
    await thrown(Object.assign(new Error("connect failed"), { code: "ECONNREFUSED" }));
    await thrown(Object.assign(new Error("lookup failed"), { code: "ECONNREFUSED" }));
    // Five characters, as a Postgres code is, but with nothing else of one.
    await thrown(Object.assign(new Error("lookup failed"), { code: "EPIPE" }));
    expect((await rows()).map(({ code, words }) => [code, words])).toEqual([
      ["ECONNREFUSED", "connect failed"],
      ["ECONNREFUSED", "lookup failed"],
      ["EPIPE", "lookup failed"],
    ]);
  });

  it("keeps what's thrown that isn't an Error, with its causes' words and no stack", async () => {
    await thrown("just a string");
    await thrown(new Error("fetch failed", { cause: new Error("connect ECONNREFUSED 10.0.0.1:443") }));
    await thrown({ code: 7, stack: "" });
    expect((await rows()).map(({ name, words, code }) => [name, words, code])).toEqual([
      ["string", "just a string", null],
      ["Error", "fetch failed (connect ECONNREFUSED <n>.<n>.<n>.<n>:<n>)", null],
      ["object", "[object Object]", null],
    ]);
    expect(await query("SELECT latest_stack AS stack FROM errors_seen WHERE name <> 'Error'")).toEqual([
      { stack: null },
      { stack: null },
    ]);
  });

  it("emails staff about a new one, with a link to it, and not again that day", async () => {
    const sent = notifications();
    await thrown(new Error("No politician 4127"));
    await thrown(new Error("No politician 4128"));
    const [{ id }] = await query<{ id: number }>("SELECT id::int AS id FROM errors_seen");
    const link = `https://pauseai.uk/staff/errors/${id}`;
    const place = `${copy.kinds.render} /staff/politicians/[id]`;
    expect(sent).toEqual([
      expect.objectContaining({
        To: NOTIFICATIONS,
        Subject: copy.email.server.subject("No politician <n>"),
        TextBody: copy.email.server.first(place, "No politician <n>", link),
      }),
    ]);
    expect(sent[0].TextBody).not.toContain("4127");
    expect(await rows()).toEqual([expect.objectContaining({ count: 2, alerted: true })]);
  });

  it("emails again once a day has passed, saying how many more times", async () => {
    const sent = notifications();
    await thrown(new Error("It broke"));
    await thrown(new Error("It broke"));
    await query("UPDATE errors_seen SET alerted_at = alerted_at - interval '25 hours'");
    await thrown(new Error("It broke"));
    await thrown(new Error("It broke"));
    const [{ id }] = await query<{ id: number }>("SELECT id::int AS id FROM errors_seen");
    expect(sent.map((email) => email.TextBody)).toEqual([
      expect.any(String),
      copy.email.server.again(
        `${copy.kinds.render} /staff/politicians/[id]`,
        "It broke",
        2,
        3,
        `https://pauseai.uk/staff/errors/${id}`,
      ),
    ]);
  });

  it("sends one email when the same new error is thrown twice at once", async () => {
    const sent = notifications();
    // An error not kept is only reported, so the count below would come up short without saying why.
    const notKept: string[] = [];
    registerProblemKeeper((what, described) => notKept.push(`${what} ${described}`));
    await Promise.all([thrown(new Error("At once")), thrown(new Error("At once")), thrown(new Error("At once"))]);
    expect(notKept).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(await rows()).toEqual([expect.objectContaining({ count: 3 })]);
  });

  it("stops at the hour's emails, says there are many, then sends no more", async () => {
    const sent = notifications();
    for (let n = 0; n < SERVER_EMAILS_AN_HOUR + 3; n++) await thrown(new Error(`Broke in way ${"x".repeat(n + 1)}`));
    expect(sent.map((email) => email.Subject)).toEqual([
      ...Array.from({ length: SERVER_EMAILS_AN_HOUR }, (_, n) =>
        copy.email.server.subject(`Broke in way ${"x".repeat(n + 1)}`),
      ),
      copy.email.many.subject,
    ]);
    expect(sent.at(-1)?.TextBody).toBe(copy.email.many.body("https://pauseai.uk/staff/errors"));
    // An hour on, the next new one is emailed about.
    await query("UPDATE errors_seen SET alerted_at = alerted_at - interval '61 minutes'");
    await thrown(new Error("Broke later"));
    expect(sent.at(-1)?.Subject).toBe(copy.email.server.subject("Broke later"));
  });

  it("emails no one where there's no notification inbox, and takes no row for an email", async () => {
    await thrown(new Error("Nobody to tell"));
    expect(await rows()).toEqual([expect.objectContaining({ count: 1, alerted: false })]);
  });

  it("keeps nothing in development, where the error is on the screen", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await thrown(new Error("On the screen"));
    expect(await rows()).toEqual([]);
  });

  it("logs an error it can't keep, without throwing or keeping that in turn", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    registerProblemKeeper(keepProblem);
    vi.stubEnv("NETLIFY_DB_URL", "");
    await thrown(new Error("With no database"));
    vi.unstubAllEnvs();
    expect(logged.mock.calls).toEqual([[staffCopy.problems.logs.errorNotKept, "NETLIFY_DB_URL is not set"]]);
    expect(held.work).toEqual([]);
    expect(await rows()).toEqual([]);
  });
});

describeWithDatabase("problems reported outside a run", () => {
  useTestDatabase();

  it("are kept by their sentence, with the error's words, and emailed about", async () => {
    const sent = notifications();
    // One after the other, as the latest words are those counted last, and two started together may be counted in either order.
    keepProblem("Letter 12 couldn't be sent, so it's gone back in the queue", "Gmail answered 503");
    await Promise.all(held.work);
    keepProblem("Letter 13 couldn't be sent, so it's gone back in the queue", undefined);
    await Promise.all(held.work);
    expect(await rows()).toEqual([
      {
        kind: "problem",
        route: "",
        name: "",
        code: null,
        words: "Letter <n> couldn't be sent, so it's gone back in the queue",
        latest: "Letter 13 couldn't be sent, so it's gone back in the queue",
        count: 2,
        browser: null,
        alerted: true,
      },
    ]);
    expect(sent.map((email) => email.Subject)).toEqual([
      copy.email.server.subject("Letter <n> couldn't be sent, so it's gone back in the queue"),
    ]);
    expect(sent[0].TextBody).toContain(`\n\n${copy.kinds.problem}\nLetter <n>`);
  });

  it("are kept outside a request too, where nothing holds the work open", async () => {
    held.outside = true;
    keepProblem("Turnstile couldn't be reached", "fetch failed");
    await vi.waitFor(async () => expect(await rows()).toHaveLength(1));
    expect(await rows()).toEqual([
      expect.objectContaining({
        words: "Turnstile couldn't be reached",
        latest: "Turnstile couldn't be reached: fetch failed",
      }),
    ]);
  });
});

describeWithDatabase("errors from browsers", () => {
  useTestDatabase();

  const report = (words: string, kind: "browser-page" | "browser-other" = "browser-page") => ({
    kind,
    name: "TypeError",
    words,
    stack: "TypeError: x is undefined\n    at a (https://pauseai.uk/_next/static/chunks/4f2a.js:1:2345)",
    path: "/staff/politicians/4127?tab=letters",
  });

  it("keeps one by its page's steady path, with the browser's name and version", async () => {
    await keepBrowserError(report("can't access property 7 of x"), FIREFOX);
    await keepBrowserError({ ...report("can't access property 8 of x"), stack: "" }, null);
    expect(await rows()).toEqual([
      {
        kind: "browser-page",
        route: "/staff/politicians/<n>",
        name: "TypeError",
        code: null,
        words: "can't access property <n> of x",
        latest: "can't access property 8 of x",
        count: 2,
        browser: null,
        alerted: false,
      },
    ]);
    await keepBrowserError(report("can't access property 9 of x"), FIREFOX);
    expect(await query("SELECT latest_browser AS browser, latest_stack IS NULL AS bare FROM errors_seen")).toEqual([
      { browser: "Firefox 131", bare: false },
    ]);
  });

  it("emails about a page that fell over, by its page alone, and not about anything else a browser throws", async () => {
    const sent = notifications();
    await keepBrowserError(report("Click here: evil"), FIREFOX);
    await keepBrowserError(report("ResizeObserver loop", "browser-other"), FIREFOX);
    const [{ id }] = await query<{ id: number }>("SELECT id::int AS id FROM errors_seen ORDER BY id");
    const place = `${copy.kinds["browser-page"]} /staff/politicians/<n>`;
    const link = `https://pauseai.uk/staff/errors/${id}`;
    expect(sent).toEqual([
      expect.objectContaining({
        Subject: copy.email.browser.subject("/staff/politicians/<n>"),
        TextBody: copy.email.browser.first(place, link),
      }),
    ]);
    expect(sent[0].TextBody).not.toContain("evil");
    await query("UPDATE errors_seen SET alerted_at = alerted_at - interval '2 days'");
    await keepBrowserError(report("Click here: evil"), FIREFOX);
    expect(sent.at(-1)?.TextBody).toBe(copy.email.browser.again(place, 1, 2, link));
  });

  it("has an hour's emails of its own, so a flood from browsers leaves the server's", async () => {
    const sent = notifications();
    for (let n = 0; n < BROWSER_EMAILS_AN_HOUR + 2; n++)
      await keepBrowserError(report(`Fell over ${"x".repeat(n + 1)}`), null);
    expect(sent.map((email) => email.Subject).slice(BROWSER_EMAILS_AN_HOUR)).toEqual([copy.email.manyBrowser.subject]);
    expect(sent.at(-1)?.TextBody).toBe(copy.email.manyBrowser.body("https://pauseai.uk/staff/errors"));
    await thrown(new Error("The server's own"));
    expect(sent.at(-1)?.Subject).toBe(copy.email.server.subject("The server's own"));
  });

  it("keeps only so many new ones an hour, but still counts those it has", async () => {
    for (let n = 0; n < NEW_BROWSER_ERRORS_AN_HOUR; n++)
      await keepBrowserError(report(`Junk ${"x".repeat(n + 1)}`, "browser-other"), null);
    await keepBrowserError(report("One too many", "browser-other"), null);
    await keepBrowserError(report("Junk x", "browser-other"), null);
    const kept = await rows();
    expect(kept).toHaveLength(NEW_BROWSER_ERRORS_AN_HOUR);
    expect(kept[0]).toEqual(expect.objectContaining({ words: "Junk x", count: 2 }));
    // The server's errors have no such limit, and an hour on there's room again.
    await thrown(new Error("The server's own"));
    await query(
      "UPDATE errors_seen SET first_seen = first_seen - interval '61 minutes', last_seen = last_seen - interval '1 minute'",
    );
    await keepBrowserError(report("One too many", "browser-other"), null);
    expect(await rows()).toHaveLength(NEW_BROWSER_ERRORS_AN_HOUR + 2);
  });
});

describeWithDatabase("the list of errors", () => {
  useTestDatabase();

  it("has the one seen most recently first, a page at a time, and each by its ID", async () => {
    await query(
      `INSERT INTO errors_seen (key, kind, route, name, words, latest_words, first_seen, last_seen)
       SELECT 'key ' || n, 'route', '/api/thing', 'Error', 'Words ' || n, 'Latest ' || n,
         now() - interval '2 days', now() - n * interval '1 minute'
       FROM generate_series(1, 101) AS n`,
    );
    const first = await listErrorsSeen(1);
    expect(first).toEqual(expect.objectContaining({ total: 101, pages: 2, page: 1, pageSize: 100 }));
    expect(first.errors).toHaveLength(100);
    expect(first.errors[0]).toEqual({
      id: expect.any(Number),
      kind: "route",
      route: "/api/thing",
      name: "Error",
      code: null,
      words: "Words 1",
      latestWords: "Latest 1",
      stack: null,
      browser: null,
      firstSeen: expect.any(Date),
      lastSeen: expect.any(Date),
      count: 1,
    });
    const second = await listErrorsSeen(2);
    expect(second.errors.map((error) => error.words)).toEqual(["Words 101"]);
    expect(await errorSeen(String(first.errors[0].id))).toEqual(first.errors[0]);
  });

  it("is one empty page with none, and finds no error by an ID that isn't one or isn't there", async () => {
    expect(await listErrorsSeen(1)).toEqual({ errors: [], total: 0, pages: 1, page: 1, pageSize: 100 });
    expect(await errorSeen("12")).toBeUndefined();
    expect(await errorSeen("12; DROP TABLE errors_seen")).toBeUndefined();
    expect(await errorSeen("")).toBeUndefined();
  });

  it("is tidied of those not seen for a month", async () => {
    await thrown(new Error("Old"));
    await thrown(new Error("Recent"));
    await query(
      "UPDATE errors_seen SET first_seen = now() - interval '3 months', last_seen = now() - interval '32 days' WHERE words = 'Old'",
    );
    expect(await tidyErrorsSeen()).toBe(1);
    expect((await rows()).map((row) => row.words)).toEqual(["Recent"]);
  });
});
