// The storyboard's test object: every flow gets its own database, a fixed
// clock, and the cookie that tells the build which database it's on. Specs
// import `test` and `expect` from here, never from @playwright/test.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, type BrowserContextOptions } from "@playwright/test";
import { copyDatabase, dropDatabase, runSql } from "@/scripts/fresh-database.mjs";
import { FLOW_DATABASES, LOCAL_URL, TEMPLATE_DATABASE } from "../checkout.mjs";
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

// Experiment: every request a flow makes to the build, written beside the
// run, to work out which flows a change can reach.
type Seen = { method: string; url: string; action?: string; api?: boolean; prefetch?: boolean; rsc?: boolean };
const recordings = new WeakMap<object, Seen[]>();
function recorded(testInfo: import("@playwright/test").TestInfo): Seen[] {
  let seen = recordings.get(testInfo);
  if (!seen) {
    const list: Seen[] = [];
    seen = list;
    recordings.set(testInfo, list);
    const dir = join(process.cwd(), "tmp/flow-requests", testInfo.project.name);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${createHash("sha256").update(testInfo.testId).digest("hex").slice(0, 16)}.json`);
    // Written after the test, by the flowDatabase fixture's teardown.
    flushers.set(testInfo, () =>
      writeFileSync(
        file,
        JSON.stringify({ file: testInfo.file, title: testInfo.title, project: testInfo.project.name, requests: list }),
      ),
    );
  }
  return seen;
}
const flushers = new WeakMap<object, () => void>();

// Experiment: the server's V8 coverage, taken between flows run one at a
// time (FLOW_COVERAGE=1, --workers=1) from a server started with
// tmp/affected/serve-inspect.mjs.
type Json = ReturnType<typeof JSON.parse>;
type Cdp = (method: string, params?: object) => Promise<Json>;
const clientCoverage = new WeakMap<object, Record<string, number[]>>();
let cdp: Promise<Cdp> | undefined;
function inspector(): Promise<Cdp> {
  cdp ??= (async () => {
    const [target] = await (await fetch("http://127.0.0.1:9339/json/list")).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    let id = 0;
    const waiting = new Map<number, (v: Json) => void>();
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(String(e.data));
      if (m.id) waiting.get(m.id)?.(m.result);
    });
    const send: Cdp = (method, params = {}) =>
      new Promise((r) => {
        waiting.set(++id, r);
        ws.send(JSON.stringify({ id, method, params }));
      });
    await send("Profiler.enable");
    await send("Profiler.startPreciseCoverage", { callCount: true, detailed: false });
    return send;
  })();
  return cdp;
}
async function takeCoverage(): Promise<Record<string, number[]>> {
  const send = await inspector();
  const { result } = await send("Profiler.takePreciseCoverage");
  const out: Record<string, number[]> = {};
  for (const script of result as { url: string; functions: { ranges: { startOffset: number; count: number }[] }[] }[]) {
    if (!script.url.includes("/.next/server/")) continue;
    const offsets = script.functions.filter((f) => f.ranges[0].count > 0).map((f) => f.ranges[0].startOffset);
    if (offsets.length) out[script.url] = offsets;
  }
  return out;
}

export const test = base.extend<{ flowDatabase: string }>({
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
      recorded(testInfo);
      const coverage = process.env.FLOW_COVERAGE === "1";
      if (coverage) await takeCoverage();
      await provide(name);
      flushers.get(testInfo)?.();
      if (coverage) {
        // Let the server finish what the flow started (after() work, emails)
        await new Promise((r) => setTimeout(r, 300));
        const dir = join(process.cwd(), "tmp/flow-coverage");
        mkdirSync(dir, { recursive: true });
        const hash = createHash("sha256").update(testInfo.testId).digest("hex").slice(0, 16);
        writeFileSync(
          join(dir, `${testInfo.project.name}-${hash}.json`),
          JSON.stringify({
            file: testInfo.file,
            title: testInfo.title,
            project: testInfo.project.name,
            coverage: await takeCoverage(),
            client: clientCoverage.get(testInfo) ?? {},
          }),
        );
      }
      dropDatabase(name);
    },
    { auto: true },
  ],
  // Every page and request in the flow carries the cookie naming its database.
  storageState: async ({ flowDatabase }, provide) => provide(flowStorageState(flowDatabase)),
  // No flow ever reaches Google: a test run is not a visit. consent.spec.ts
  // routes the same URLs on its page, which takes precedence, to record what
  // the page tried to load.
  context: async ({ context }, provide, testInfo) => {
    await context.route(ANALYTICS_URL, (route) => route.abort());
    // Experiment: in a coverage run, the server renders only what the flow opens
    if (process.env.FLOW_COVERAGE === "1")
      await context.route(
        (url) => url.href.startsWith(BASE),
        (route) =>
          route.request().headers()["next-router-prefetch"] ? route.fulfill({ status: 204 }) : route.fallback(),
      );
    const seen = recorded(testInfo);
    context.on("request", (request) => {
      if (!request.url().startsWith(BASE)) return;
      const headers = request.headers();
      seen.push({
        method: request.method(),
        url: request.url(),
        action: headers["next-action"],
        prefetch: !!headers["next-router-prefetch"] || headers["purpose"] === "prefetch",
        rsc: !!headers["rsc"],
      });
    });
    const covering = process.env.FLOW_COVERAGE === "1";
    const started: Promise<void>[] = [];
    const watch = (p: import("@playwright/test").Page) => {
      p.on("framenavigated", (f) => {
        if (f === p.mainFrame() && f.url().startsWith(BASE)) seen.push({ method: "NAV", url: f.url() });
      });
      if (covering) started.push(p.coverage.startJSCoverage({ resetOnNavigation: false }).catch(() => {}));
    };
    context.pages().forEach(watch);
    context.on("page", watch);
    await provide(context);
    if (covering) {
      await Promise.all(started);
      const client: Record<string, number[]> = {};
      for (const p of context.pages()) {
        const entries = await p.coverage.stopJSCoverage().catch(() => []);
        for (const e of entries) {
          if (!e.url.startsWith(`${BASE}/_next/static/`)) continue;
          const offsets = e.functions.filter((f) => f.ranges[0].count > 0).map((f) => f.ranges[0].startOffset);
          client[e.url] = [...new Set([...(client[e.url] ?? []), ...offsets])];
        }
      }
      clientCoverage.set(testInfo, client);
    }
  },
  request: async ({ request }, provide, testInfo) => {
    const seen = recorded(testInfo);
    const wrapped = new Proxy(request, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (typeof value !== "function") return value;
        if (!["get", "post", "put", "patch", "delete", "fetch", "head"].includes(String(key)))
          return value.bind(target);
        return (url: string | { url(): string }, options?: { method?: string }) => {
          const href = typeof url === "string" ? new URL(url, BASE).href : url.url();
          seen.push({ method: options?.method ?? String(key).toUpperCase(), url: href, api: true });
          return value.call(target, url, options);
        };
      },
    });
    await provide(wrapped);
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
