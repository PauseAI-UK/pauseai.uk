import { afterEach, describe, expect, it, vi } from "vitest";
import { BROWSER_ERROR_PATH, browserErrorReporter, fromOurScripts, REPORTS_A_PAGE } from "./browser-errors";

afterEach(() => vi.restoreAllMocks());

const answered = () => vi.spyOn(window, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

/** What the nth request posted. */
const posted = (fetch: ReturnType<typeof answered>, n = 0) => JSON.parse(String(fetch.mock.calls[n][1]?.body));

describe("telling the site of an error in the browser", () => {
  it("posts it once, however often it's caught, with its class, words, stack and the page's path", () => {
    const fetch = answered();
    const report = browserErrorReporter();
    const error = new TypeError("rows is undefined");
    report("browser-page", error);
    report("browser-other", error);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(BROWSER_ERROR_PATH);
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST", keepalive: true });
    expect(posted(fetch)).toEqual({
      kind: "browser-page",
      name: "TypeError",
      words: "rows is undefined",
      stack: error.stack,
      path: window.location.pathname,
    });
  });

  it("posts what's thrown that isn't an Error by its type, and an Error with no stack without one", () => {
    const fetch = answered();
    const report = browserErrorReporter();
    report("browser-other", "just a string");
    report("browser-other", "just a string");
    report("browser-other", null);
    const bare = new Error("bare");
    bare.stack = undefined;
    report("browser-other", bare);
    expect([0, 1, 2, 3].map((n) => posted(fetch, n))).toEqual([
      expect.objectContaining({ name: "string", words: "just a string", stack: "" }),
      expect.objectContaining({ name: "string", words: "just a string", stack: "" }),
      expect.objectContaining({ name: "object", words: "null", stack: "" }),
      expect.objectContaining({ name: "Error", words: "bare", stack: "" }),
    ]);
  });

  it("cuts long words and a long stack short", () => {
    const fetch = answered();
    const long = new Error("w".repeat(5000));
    long.stack = "s".repeat(20_000);
    browserErrorReporter()("browser-page", long);
    expect([posted(fetch).words.length, posted(fetch).stack.length]).toEqual([2000, 8000]);
  });

  it("stops after so many from one page", () => {
    const fetch = answered();
    const report = browserErrorReporter();
    for (let n = 0; n < REPORTS_A_PAGE + 3; n++) report("browser-other", new Error(`Error ${n}`));
    expect(fetch).toHaveBeenCalledTimes(REPORTS_A_PAGE);
  });

  it("doesn't mind the request failing", async () => {
    const fetch = vi.spyOn(window, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    browserErrorReporter()("browser-page", new Error("offline"));
    await expect(fetch.mock.results[0].value).rejects.toThrow("Failed to fetch");
  });
});

it("knows a stack with a frame from the site's own scripts", () => {
  const origin = "https://pauseai.uk";
  expect(fromOurScripts(`TypeError: x\n    at a (${origin}/_next/static/chunks/4f2a.js:1:2345)`, origin)).toBe(true);
  expect(fromOurScripts("TypeError: x\n    at a (chrome-extension://abcdef/content.js:1:2345)", origin)).toBe(false);
  expect(fromOurScripts("TypeError: x\n    at a (https://other.example/_next/static/x.js:1:1)", origin)).toBe(false);
  expect(fromOurScripts(undefined, origin)).toBe(false);
});
