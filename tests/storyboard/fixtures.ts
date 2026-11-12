// The storyboard's test object: every flow gets its own database, a fixed
// clock, and the cookie that tells the build which database it's on. Specs
// import `test` and `expect` from here, never from @playwright/test.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  test as base,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type Request,
} from "@playwright/test";
import { copyDatabase, dropDatabase, runSql } from "@/scripts/fresh-database.mjs";
import { FLOW_DATABASES, LOCAL_URL, REQUESTS_DIR, TEMPLATE_DATABASE } from "../checkout.mjs";
import { FIXTURE_NOW, FLOW_DATABASE_COOKIE } from "@/lib/server/fixtures/fixture-env.mjs";
import { historyIdNow } from "@/lib/server/fixtures/letters-inbox";

export { expect } from "@playwright/test";
export { emailFrame, frame, story } from "./frame";

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

export const test = base.extend<{ flowDatabase: string; opened: Set<string> }>({
  // What the flow opened: each page, action, API route and public file, by its path, attached to the
  // test for the review to keep with the flow (report/reporter.ts). A change reruns the flows whose
  // pages it can reach (scripts/storyboard-reach.mjs). Next's prefetches of the pages a link
  // points to don't count: nothing of them is seen until the link is followed, which counts.
  //
  // One entry isn't a path. When the server kept an error during the flow (a row of errors_seen added,
  // or seen again), the flow ran what instrumentation.ts hands errors to, which no page imports: it's
  // recorded as having opened that file.
  opened: [
    async ({ flowDatabase, browser }, provide, testInfo) => {
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
      // The letters inbox read from now: the build's fake keeps a database's mail by its name, and
      // this name's may have some from a run before (lib/server/fixtures/letters-inbox.ts).
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
  context: async ({ context, opened }, provide) => {
    recordContext(context, opened);
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
