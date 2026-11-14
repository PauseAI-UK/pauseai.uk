// What a flow does to picture a staff page while it loads, and to wait until
// it has: holding the page's data or its request back, keeping the browser
// on a button that's leaving, and the line along the top while something's
// pending.
import type { Page, Route } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { databaseUrl } from "@/scripts/fresh-database.mjs";
import { expect } from "./fixtures";

/**
 * Locks `table` in `database` until the returned function is called, so a
 * page that reads it waits there, and a flow can picture what shows while it
 * loads. The rest of the page, and every other table, go on as usual.
 */
export async function lockTable(database: string, table: string): Promise<() => Promise<void>> {
  const psql = spawn("psql", ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-d", databaseUrl(database)], {
    stdio: ["pipe", "pipe", "inherit"],
  });
  psql.stdin.write(`BEGIN; LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE; SELECT 'locked';\n`);
  await new Promise<void>((done) =>
    psql.stdout.on("data", (data: Buffer) => {
      if (data.toString().includes("locked")) done();
    }),
  );
  return async () => {
    psql.stdin.end("COMMIT;\n");
    await once(psql, "exit");
  };
}

/**
 * Holds the next request for the page at a URL matching `target` (a
 * navigation's, not a prefetch: a link hovered fetches its page whole
 * ahead), so a flow can picture the page while it waits; `release` lets it
 * through.
 */
export async function holdNextPage(page: Page, target: RegExp): Promise<{ release: () => Promise<void> }> {
  let open = () => {};
  const held = new Promise<void>((done) => (open = done));
  let holding = true;
  const matches = (url: URL) => url.searchParams.has("_rsc") && target.test(url.search);
  const handler = async (route: Route) => {
    if (!holding || route.request().headers()["next-router-prefetch"]) return route.continue();
    holding = false;
    await held;
    await route.continue();
  };
  await page.route(matches, handler);
  return {
    release: async () => {
      open();
      await page.unroute(matches, handler);
    },
  };
}

/**
 * Keeps the browser on the page when a button there next leaves it for a
 * URL matching `target`: the page cancels that navigation itself (the
 * Navigation API's navigate event), as if the next page were slow to come,
 * so a flow can picture the button waiting. No page load is begun, which
 * Playwright would wait on. `asked` gives the URL it was going to, to go on
 * to with page.goto.
 */
export async function stayOnPage(page: Page, target: RegExp): Promise<{ asked: () => Promise<string> }> {
  await page.evaluate((source) => {
    const pattern = new RegExp(source);
    const stay = (event: Event) => {
      const going = event as Event & { destination: { url: string } };
      if (!pattern.test(going.destination.url)) return;
      event.preventDefault();
      document.documentElement.dataset.stayedFrom = going.destination.url;
      (window as unknown as { navigation: EventTarget }).navigation.removeEventListener("navigate", stay);
    };
    (window as unknown as { navigation: EventTarget }).navigation.addEventListener("navigate", stay);
  }, target.source);
  return { asked: () => page.evaluate(() => document.documentElement.dataset.stayedFrom!) };
}

/**
 * Waits until nothing on the page is pending, so the line along the top
 * (StaffPage) has gone. A navigation can still be pending after the URL and
 * the rows show the answer, and the line fades in over it on a slow machine.
 */
export const settled = (page: Page) => expect(page.locator("[data-pending]")).toHaveCount(0);

/** Whether the line along the top of the page, while something loads, is showing (StaffPage). */
export const loadingLine = (page: Page) =>
  page.evaluate(() => {
    const line = getComputedStyle(document.querySelector("main")!, "::before");
    return line.content !== "none" && line.opacity === "1";
  });
