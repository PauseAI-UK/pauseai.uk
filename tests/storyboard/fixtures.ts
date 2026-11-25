// The storyboard's test object: every flow gets its own database, a fixed
// clock, and the cookie that tells the build which database it's on. Specs
// import `test` and `expect` from here, never from @playwright/test.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  test as base,
  expect,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type Request,
} from "@playwright/test";
import { copyDatabase, dropDatabase, runSql } from "@/scripts/fresh-database.mjs";
import { FLOW_DATABASES, LETTERS_INBOX_DIR, LOCAL_URL, REQUESTS_DIR, TEMPLATE_DATABASE } from "../checkout.mjs";
import { FIXTURE_NOW, FLOW_DATABASE_COOKIE } from "@/lib/server/fixtures/fixture-env.mjs";
import { historyIdNow } from "@/lib/server/fixtures/inbox-clock";
import { emptyLettersInbox } from "@/lib/server/fixtures/letters-inbox";
import { OPENING_BUBBLE } from "./settle";

export { expect } from "@playwright/test";
export { frame, story } from "./frame";

/** The build under test. */
export const BASE = LOCAL_URL;

/** The storage state (just the database cookie) a context needs to be on `database`. */
export function flowStorageState(database: string): Exclude<BrowserContextOptions["storageState"], string | undefined> {
  return {
    cookies: [
      {
        name: FLOW_DATABASE_COOKIE,
        value: database,
        domain: new URL(BASE).hostname,
        path: "/",
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ],
    origins: [],
  };
}

/** Google Analytics and Tag Manager, which the fixture build loads (ANALYTICS=1, lib/server/fixtures/fixture-env.mjs). */
export const ANALYTICS_URL = "**/www.googletagmanager.com/**";

/**
 * A picture from another site, such as a Luma event cover, as the build
 * resizes it (/_next/image of an outside URL). The build would fetch the real
 * one over the internet, which can time out, and the picture can change, so
 * every one is this.
 */
const OUTSIDE_IMAGE = /\/_next\/image\?url=https?%3A/;
const OUTSIDE_IMAGE_STAND_IN = readFileSync(join(process.cwd(), "public/images/bristol-launch.jpeg"));

/** Stands in for pauseai.info's onboarding form, posting its height as the real embed does. */
const ONBOARDING_FORM_STAND_IN = `<!doctype html>
<html lang="en"><body style="margin:0;background:#FDF8F3;font:16px system-ui,sans-serif">
<div style="height:600px;display:flex;align-items:center;justify-content:center;border:2px dashed #ccc;box-sizing:border-box">
  stand-in for the onboarding form on pauseai.info
</div>
<script>parent.postMessage({ height: 600 }, "*");</script>
</body></html>`;

/**
 * Stands in for Tally's embed script (the story form on /people): it loads
 * no form, so the form's space is the same, and empty, every run. The real
 * one's arrival varied with the network.
 */
const TALLY_STAND_IN = "window.Tally = { loadEmbeds: () => {} };";

/**
 * The path a request to the build is recorded by in a flow's `opened`: a
 * page's, an action's or an API route's own, and a picture the build resized
 * by the picture's. The build's scripts and styles, and other sites, aren't.
 */
function openedPath(url: string, base: string): string | undefined {
  const u = new URL(url);
  if (u.origin !== new URL(base).origin || u.pathname.startsWith("/_next/static/")) return undefined;
  const src = u.pathname === "/_next/image" ? u.searchParams.get("url")?.split("?")[0] : u.pathname;
  if (!src?.startsWith("/")) return undefined;
  try {
    return decodeURIComponent(src);
  } catch {
    // Not an encoding of anything: as it was asked for.
    return src;
  }
}

/** How many errors the server has kept, and how many times it has seen them. */
const ERRORS_KEPT = "SELECT count(*) || ' ' || coalesce(sum(count), 0) FROM errors_seen";

const API_METHODS = ["get", "post", "put", "patch", "delete", "head", "fetch"] as const;

/** The contexts recordContext is already recording. */
const recorded = new WeakSet<BrowserContext>();

/**
 * Adds to `opened` the path of everything `context` asks the build for, and
 * of each address its pages come to: a link followed to a page already
 * prefetched fetches nothing. Next's prefetches themselves don't count.
 */
function recordContext(context: BrowserContext, opened: Set<string>) {
  if (recorded.has(context)) return;
  recorded.add(context);
  context.on("request", (request) => {
    if (request.headers()["next-router-prefetch"]) return;
    const path = openedPath(request.url(), BASE);
    if (path) opened.add(path);
  });
  const watch = (page: Page) =>
    page.on("framenavigated", (frame) => {
      const path = frame === page.mainFrame() ? openedPath(frame.url(), BASE) : undefined;
      if (path) opened.add(path);
    });
  context.pages().forEach(watch);
  context.on("page", watch);
  recordCalls(context.request, opened);
}

/**
 * Every page `context` opens scrolls at once, where the site scrolls
 * smoothly (`scroll-behavior` in styles/base.css): a smooth scroll a step
 * starts, such as an editor keeping its cursor in view as it's typed in,
 * comes to rest where timing leaves it, a few pixels apart between runs.
 * Only scrolling: the rest of the site's motion is as visitors see it. An
 * adopted stylesheet, which the page's own code and React's leave alone.
 */
async function scrollAtOnce(context: BrowserContext) {
  await context.addInitScript(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync("html { scroll-behavior: auto !important; }");
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  });
}

/**
 * Console messages that say nothing about the site's own code, each with
 * its reason. Kept short: every entry is something no flow looks at.
 */
const NOT_OURS = [
  // next/image complains when CSS sizes one dimension; cosmetic, and a
  // warning rather than an error in any case.
  /has either width or height modified/,
  // Analytics is blocked for every flow (`context` below), and third-party
  // embeds fail in a sandboxed browser with nothing to report to.
  /googletagmanager|google-analytics|gtag/i,
  /ERR_BLOCKED_BY_CLIENT|ERR_INTERNET_DISCONNECTED/,
];

/** React's hydration messages, which arrive as warnings, not errors. */
const HYDRATION = /hydrat|did not match|server rendered HTML/i;

/** The contexts watchConsole is already watching. */
const watched = new WeakSet<BrowserContext>();

/** What a page logs of a promise that failed with nothing waiting on it, which it otherwise may not log at all. */
const REJECTION = "[unhandledrejection]";

/**
 * Logs, in every page of `context`, each promise that fails with nothing
 * waiting on it, as ErrorReporter would tell the site of it: an error thrown
 * from our own scripts, and not Next's redirect or not-found. Next marks
 * some such failures handled, so the browser logs nothing of them and
 * Playwright's pageerror never hears them. The listener is the page's
 * first, so it hears each before anything can mark it.
 */
async function logRejections(context: BrowserContext) {
  await context.addInitScript((marker: string) => {
    window.addEventListener("unhandledrejection", (event) => {
      const reason: unknown = event.reason;
      const digest = (reason as { digest?: unknown } | null)?.digest;
      if (typeof digest === "string" && /^NEXT_(REDIRECT|HTTP_ERROR_FALLBACK|NOT_FOUND)/.test(digest)) return;
      if (!(reason instanceof Error) || !reason.stack?.includes(`${window.location.origin}/_next/`)) return;
      console.error(`${marker} ${String(reason)}\n${reason.stack}`);
    });
  }, REJECTION);
}

/** What a page logs of a bubble that opened outside openBubble. */
const PLAIN_BUBBLE = "[bubble opened outside openBubble]";

/** What a page logs of the bubble `id` opening outside openBubble, for a flow where that's meant (expectConsole). */
export const bubbleOpenedOutside = (id: string) => new RegExp(`${PLAIN_BUBBLE.replace(/[[\]]/g, "\\$&")} #${id}$`);

/**
 * Logs, in every page of `context`, each bubble (BubbleBox, which names its
 * anchor in --bubble-anchor) that opens while openBubble isn't opening one
 * (OPENING_BUBBLE, tests/storyboard/settle.ts). A bubble scrolls the page to
 * show itself a moment after it opens, and openBubble waits for that; a flow
 * that presses the button itself can take its frame, or press inside the
 * bubble, mid-scroll.
 */
async function logPlainBubbles(context: BrowserContext) {
  await context.addInitScript(
    ([marker, flag]: [string, string]) => {
      document.addEventListener(
        "toggle",
        (event) => {
          const target = event.target;
          if ((event as ToggleEvent).newState !== "open" || !(target instanceof HTMLElement)) return;
          if (!target.style.getPropertyValue("--bubble-anchor")) return;
          if ((window as unknown as Record<string, unknown>)[flag]) return;
          console.error(`${marker} #${target.id}`);
        },
        true,
      );
    },
    [PLAIN_BUBBLE, OPENING_BUBBLE] as [string, string],
  );
}

/**
 * Adds to `problems` what every page of `context` logs that a flow fails
 * on: a bubble opened without openBubble (logPlainBubbles), an uncaught error, a promise failing with nothing waiting on it
 * (logRejections), a console error from our own code (an embedded site's
 * isn't), and React's hydration messages. A page that doesn't hydrate as it
 * rendered on the server, such as one whose text depends on the browser,
 * shows nothing wrong in a picture, only here.
 */
async function watchConsole(context: BrowserContext, problems: string[]) {
  if (watched.has(context)) return;
  watched.add(context);
  await logRejections(context);
  await logPlainBubbles(context);
  const watch = (page: Page) => {
    page.on("console", (message) => {
      const origin = message.location().url;
      if (origin && !origin.startsWith(BASE)) return;
      const text = message.text();
      if (NOT_OURS.some((pattern) => pattern.test(text))) return;
      if (message.type() === "error" || HYDRATION.test(text)) {
        problems.push(`[${message.type()}] ${text.slice(0, 300)}`);
      }
    });
    page.on("pageerror", (error) => problems.push(`[pageerror] ${String(error).slice(0, 300)}`));
  };
  context.pages().forEach(watch);
  context.on("page", watch);
}

/** The contexts logNetwork is already logging. */
const networkLogged = new WeakSet<BrowserContext>();

/** Whether a run asked for each flow's log of its pages' requests and errors (logNetwork). */
const NETWORK_LOG = process.env.STORYBOARD_NETWORK_LOG === "1";

/** Where each flow's log goes, a file a flow and viewport. */
const NETWORK_LOG_DIR = join("test-results", "storyboard-network");

/** The log's file for a flow, named by its title and viewport. */
const networkLogFile = (title: string, project: string) =>
  join(NETWORK_LOG_DIR, `${`${title}-${project}`.replace(/[^\w.-]+/g, "-")}.txt`);

/**
 * With STORYBOARD_NETWORK_LOG=1, adds to `lines` what every page of `context`
 * does, for finding where an error a flow failed on came from: each
 * document and fetch request (with the Server Action it calls) and its
 * answer, a Server Action's answer whole, the console, and each uncaught
 * exception with the stack where it was thrown, its async callers too, from
 * Chrome DevTools Protocol's Runtime.exceptionThrown. A trace has the test's
 * steps, and a minified error's own stack is one line.
 */
async function logNetwork(context: BrowserContext, lines: string[]) {
  if (networkLogged.has(context)) return;
  networkLogged.add(context);
  const at = () => new Date().toISOString().slice(11, 23);
  const logged = (request: { resourceType(): string }) => ["document", "fetch"].includes(request.resourceType());
  context.on("request", (request) => {
    if (!logged(request)) return;
    const action = request.headers()["next-action"];
    lines.push(`${at()} → ${request.method()} ${request.url()}${action ? ` (Server Action ${action})` : ""}`);
  });
  context.on("response", async (response) => {
    const request = response.request();
    if (!logged(request)) return;
    const body = request.headers()["next-action"] ? await response.text().catch(() => "") : "";
    lines.push(`${at()} ← ${response.status()} ${request.url()}${body ? `\n${body.slice(0, 4000)}` : ""}`);
  });
  const watch = async (page: Page) => {
    page.on("console", (message) => lines.push(`${at()} [console.${message.type()}] ${message.text()}`));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Runtime.enable");
    await cdp.send("Debugger.enable");
    await cdp.send("Debugger.setAsyncCallStackDepth", { maxDepth: 32 });
    cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
      const frames: string[] = [];
      for (let trace = exceptionDetails.stackTrace; trace; trace = trace.parent) {
        if (trace.description) frames.push(`  -- ${trace.description} --`);
        for (const f of trace.callFrames)
          frames.push(`  at ${f.functionName || "(anonymous)"} (${f.url}:${f.lineNumber + 1}:${f.columnNumber + 1})`);
      }
      const what = exceptionDetails.exception?.description ?? exceptionDetails.text;
      lines.push(`${at()} [exception] ${what}\n${frames.join("\n")}`);
    });
  };
  for (const page of context.pages()) await watch(page);
  context.on("page", (page) => void watch(page));
}

/** What each running flow expects its pages to log, by the flow's id (expectConsole). */
const expectedConsole = new Map<string, RegExp[]>();

/**
 * Tells the flow running that its pages will log something matching
 * `pattern`, which it brings about on purpose, such as a request it aborts
 * or an error it plants: the console check passes it over.
 */
export function expectConsole(pattern: RegExp) {
  const id = test.info().testId;
  expectedConsole.set(id, [...(expectedConsole.get(id) ?? []), pattern]);
}

/** Adds the path of each call `api` makes to `opened`. */
function recordCalls(api: APIRequestContext, opened: Set<string>) {
  for (const method of API_METHODS) {
    const call = api[method].bind(api) as (url: string | Request, options?: object) => Promise<APIResponse>;
    (api as unknown as Record<string, unknown>)[method] = (url: string | Request, options?: object) => {
      const path = openedPath(typeof url === "string" ? new URL(url, BASE).href : url.url(), BASE);
      if (path) opened.add(path);
      return call(url, options);
    };
  }
}

export const test = base.extend<{
  consoleProblems: string[];
  networkLog: string[];
  flowDatabase: string;
  opened: Set<string>;
  smoothScroll: boolean;
}>({
  // Whether the flow's pages scroll smoothly, as the site does for visitors,
  // or at once (scrollAtOnce), which every flow but scroll.spec.ts's does.
  smoothScroll: [false, { option: true }],
  // What the flow's pages did, with STORYBOARD_NETWORK_LOG=1 (logNetwork), written to its file once it's done.
  networkLog: [
    async ({}, provide, testInfo) => {
      const lines: string[] = [];
      await provide(lines);
      if (!NETWORK_LOG) return;
      mkdirSync(NETWORK_LOG_DIR, { recursive: true });
      writeFileSync(networkLogFile(testInfo.title, testInfo.project.name), `${lines.join("\n")}\n`);
    },
    { auto: true },
  ],
  // What the flow's pages logged that it fails on (watchConsole), in every
  // context it makes. Checked once the flow has passed, so a flow that
  // failed fails on its own step, not on what that step logged.
  consoleProblems: [
    async ({}, provide, testInfo) => {
      const problems: string[] = [];
      await provide(problems);
      const expected = expectedConsole.get(testInfo.testId) ?? [];
      expectedConsole.delete(testInfo.testId);
      if (testInfo.status !== "passed") return;
      const unexpected = problems.filter((problem) => !expected.some((pattern) => pattern.test(problem)));
      expect(unexpected, "console problems").toEqual([]);
    },
    { auto: true },
  ],
  // What the flow opened: each page, action, API route and public file, by its path, attached to the
  // test for the review to keep with the flow (report/reporter.ts). A change reruns the flows whose
  // pages it can reach (scripts/storyboard-reach.mjs). Next's prefetches of the pages a link
  // points to don't count: nothing of them is seen until the link is followed, which counts.
  //
  // A change to what's recorded here needs RECORDING (scripts/storyboard-reach.mjs) moved on, so flows
  // recorded before it aren't carried.
  //
  // One entry isn't a path. When the server kept an error during the flow (a row of errors_seen added,
  // or seen again), the flow ran what instrumentation.ts hands errors to, which no page imports: it's
  // recorded as having opened that file.
  opened: [
    async ({ flowDatabase, browser, smoothScroll, consoleProblems, networkLog }, provide, testInfo) => {
      const opened = new Set<string>();
      const [errorsBefore] = runSql(flowDatabase, ERRORS_KEPT);
      // What the build's server keeps of the flow's requests (scripts/record-requests.mjs): a run before
      // may have left some under the same name.
      const requests = join(REQUESTS_DIR, `${flowDatabase}.txt`);
      rmSync(requests, { force: true });
      // Every context made while the flow runs: its own, and any it makes for another person's browser.
      const newContext = browser.newContext;
      browser.newContext = async (...options) => {
        const context = await newContext.apply(browser, options);
        recordContext(context, opened);
        await watchConsole(context, consoleProblems);
        if (NETWORK_LOG) await logNetwork(context, networkLog);
        if (!smoothScroll) await scrollAtOnce(context);
        return context;
      };
      await provide(opened);
      browser.newContext = newContext;
      // Every request the server got from the flow: each step of a redirect that a request of its own
      // followed, too, which nothing here sees.
      const kept = existsSync(requests);
      if (kept) {
        for (const line of readFileSync(requests, "utf8").split("\n")) {
          const path = line && openedPath(new URL(line, BASE).href, BASE);
          if (path) opened.add(path);
        }
        rmSync(requests);
      }
      if (runSql(flowDatabase, ERRORS_KEPT)[0] !== errorsBefore) opened.add("instrumentation.ts");
      // A flow that asked the build for something, of which the server kept nothing, is on a build started
      // some other way (main's, for --this-suite-on-main), or one whose record failed: what it opened isn't
      // known whole, so nothing is recorded, and a review never carries the flow.
      if (!kept && opened.size > 0) return;
      await testInfo.attach("opened", { body: JSON.stringify([...opened].sort()), contentType: "application/json" });
    },
    { auto: true },
  ],
  // A copy of the template (global-setup.ts), made in tens of milliseconds,
  // for this flow alone, and dropped after it. Named after the test, so a
  // flow run twice, or alongside others, never shares one: a hash, as the
  // test's id and the checkout's are more than Postgres's 63 characters.
  flowDatabase: [
    async ({}, provide, testInfo) => {
      const flow = `${testInfo.testId} ${testInfo.repeatEachIndex} ${testInfo.retry}`;
      const name = `${FLOW_DATABASES}${createHash("sha256").update(flow).digest("hex").slice(0, 24)}`;
      copyDatabase(name, TEMPLATE_DATABASE);
      // The fixed clock's now() first, before Postgres's own (global-setup.ts).
      runSql("postgres", `ALTER DATABASE "${name}" SET search_path = fixture, pg_catalog, public`);
      // The letters inbox empty, and read from now: the build's fake keeps a database's mail by its name, and
      // this name's may have some from a run before (lib/server/fixtures/letters-inbox.ts).
      emptyLettersInbox(name, LETTERS_INBOX_DIR);
      runSql(name, `UPDATE staff_accounts SET gmail_history_id = '${historyIdNow()}' WHERE gmail_token IS NOT NULL`);
      await provide(name);
      dropDatabase(name);
    },
    { auto: true },
  ],
  // Every page and request in the flow carries the cookie naming its database.
  storageState: async ({ flowDatabase }, provide) => provide(flowStorageState(flowDatabase)),
  // No flow ever reaches Google: a test run is not a visit. consent.spec.ts
  // routes the same URLs on its page, which takes precedence, to record what
  // the page tried to load.
  // Recorded here too, in case it was made before `opened` began recording every context the flow makes.
  context: async ({ context, opened, smoothScroll, consoleProblems, networkLog }, provide) => {
    recordContext(context, opened);
    await watchConsole(context, consoleProblems);
    if (NETWORK_LOG) await logNetwork(context, networkLog);
    if (!smoothScroll) await scrollAtOnce(context);
    await context.route(ANALYTICS_URL, (route) => route.abort());
    await provide(context);
  },
  request: async ({ request, opened }, provide) => {
    recordCalls(request, opened);
    await provide(request);
  },
  // The page's clock agrees with the server's (FIXTURE_NOW), so dates match
  // between runs and nothing needs masking. The onboarding form, the one
  // outside page a fixture build still embeds, is a stand-in that reports a
  // fixed height: the real one's height, and so the page below it, varied
  // between runs. Tally's story form doesn't load at all. Pictures from
  // other sites are a local stand-in (OUTSIDE_IMAGE).
  page: async ({ page }, provide) => {
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await page.route(OUTSIDE_IMAGE, (route) =>
      route.fulfill({ contentType: "image/jpeg", body: OUTSIDE_IMAGE_STAND_IN }),
    );
    await page.route("https://pauseai.info/**", (route) =>
      route.fulfill({ contentType: "text/html", body: ONBOARDING_FORM_STAND_IN }),
    );
    await page.route("https://tally.so/**", (route) =>
      route.fulfill({ contentType: "text/javascript", body: TALLY_STAND_IN }),
    );
    await provide(page);
  },
});

/**
 * A made-up address for `name`, as a real one looks:
 * jane.smith11@example.com. Flows run side by side and find their emails
 * in one outbox by address, so each address a flow makes up has its own
 * `number`, 1 to 49, that no other uses; on the phone it's 50 more, as both
 * viewports run at once.
 */
export function madeUpAddress(name: string, number: number, domain = "example.com"): string {
  const local = name.toLowerCase().replace(/\s+/g, ".");
  return `${local}${number + (test.info().project.name === "phone" ? 50 : 0)}@${domain}`;
}
