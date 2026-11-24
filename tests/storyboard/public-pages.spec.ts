import type { ConsoleMessage } from "@playwright/test";
import { isStaffRoute } from "../../app/sitemap";
import { BLOG, posts } from "../../lib/content/blog";
import { BRIEFINGS, briefings } from "../../lib/content/briefings";
import { feedPath } from "../../lib/content/posts";
import { ROUTES } from "../routes";
import { fakeTurnstile } from "./turnstile-steps";
import { BASE, expect, frame, story, test } from "./fixtures";
import { hydrated } from "./settle";
import type { Section } from "./report/frames";

export const section: Section = { name: "Every public page", part: "Public site", order: 10 };

// Every public page on the site (tests/routes.ts), loaded in a real browser
// against the production build, and pictured. This is the gate for page.tsx
// and layout.tsx, which sit outside the Vitest coverage report
// (docs/testing.md). The staff pages are in their own sections, staff-login.spec.ts first.
//
// Hydration mismatches are silent by design here: app/layout.tsx sets
// suppressHydrationWarning on both <html> and <body>, which hides the warning
// that would otherwise announce one. Meanwhile app/(site)/page.tsx shuffles the hero
// photos on the server on every render, and components/events/EventList.tsx computes
// "Happening today" after mount specifically to avoid a day-boundary mismatch.
// So the conditions for one exist and the usual alarm is muted. This fails on
// console errors and on React's hydration messages, which arrive as warnings.

// A campaign's write and preview pages show nothing without a postcode and a
// letter: the campaigns flow "the write, preview and sent pages, opened
// without a lookup or a letter" pictures that once, and the ZZ99ZZ flow
// pictures them filled in.
const EMPTY_STEP = /^\/campaigns\/[^/]+\/(write|preview)$/;
// The component gallery has its own section, gallery.spec.ts, which pictures
// its index and every group's page and checks them the same way.
const GALLERY = /^\/gallery(\/|$)/;
// Someone's contact preferences open only from a link made for them: email-settings.spec.ts pictures them.
const SETTINGS_LINK = /^\/contact-preferences\/./;
const PUBLIC_ROUTES = ROUTES.filter(
  (route) => !isStaffRoute(route) && !EMPTY_STEP.test(route) && !GALLERY.test(route) && !SETTINGS_LINK.test(route),
);

// Matched against the message text. Kept deliberately short — every entry here
// is a thing we have decided not to look at, so it should have a reason.
const IGNORED = [
  // next/image complains when CSS sizes one dimension; cosmetic, and a warning
  // rather than an error in any case.
  /has either width or height modified/,
  // Analytics is blocked for every flow (fixtures.ts), and third-party embeds
  // fail in a sandboxed browser with nothing to report to. Not our code.
  /googletagmanager|google-analytics|gtag/i,
  /ERR_BLOCKED_BY_CLIENT|ERR_INTERNET_DISCONNECTED/,
];

const HYDRATION = /hydrat|did not match|server rendered HTML/i;

// Text a page shows only when it really renders lib/server/fixtures/ rather than
// the live APIs, so the other flows are checking a known state.
const FIXTURE_TEXT: Record<string, string> = {
  "/donate": "Ada Pemberton",
  "/events": "PauseAI London: Protest at Parliament",
  "/manchester": "PauseAI Manchester Social",
};

for (const route of PUBLIC_ROUTES) {
  test(route, { tag: route === "/" ? "@phone" : [] }, async ({ page }) => {
    const problems: string[] = [];

    page.on("console", (message: ConsoleMessage) => {
      // Only our own code is in scope: embedded third parties log into the
      // same page, and their noise is not a signal about this codebase.
      const origin = message.location().url;
      if (origin && !origin.startsWith(BASE)) return;
      const text = message.text();
      if (IGNORED.some((pattern) => pattern.test(text))) return;
      if (message.type() === "error" || HYDRATION.test(text)) {
        problems.push(`[${message.type()}] ${text.slice(0, 300)}`);
      }
    });
    page.on("pageerror", (error) => problems.push(`[pageerror] ${String(error).slice(0, 300)}`));

    // A page with a form behind Turnstile, as /contact-preferences is, gets the stand-in, as no flow can pass the real one.
    await fakeTurnstile(page);
    const response = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    expect(response?.status(), "status").toBe(200);

    // Hydration warnings arrive just after mount, not at load: hydrated()
    // waits for the mount, then for the console to go quiet.
    await hydrated(page);

    await expect(page.locator("h1"), "exactly one <h1>").toHaveCount(1);
    if (FIXTURE_TEXT[route]) await expect(page.getByText(FIXTURE_TEXT[route])).toBeVisible();
    // The trackers count the fixture guest list, so they never show their "no access" fallback.
    if (route.startsWith("/trackers/")) await expect(page.getByText(/check the Luma access settings/i)).toHaveCount(0);

    await frame(page, route);

    expect(problems, "console problems").toEqual([]);
  });
}

// An <a> tag's href in a page's HTML, as the server sends it.
const LINK = /<a\b[^>]*?\shref="([^"]*)"/g;

// One flow checks every public page's links, so each page's own flow opens
// only its page, the same pages on every run (scripts/storyboard-reach.mjs
// chooses a review's flows by them).
test("Every public page's links work", async ({ request }) => {
  story("Each public page's links to the site's own pages open, from the HTML the server sends.");
  const pages = await Promise.all(
    PUBLIC_ROUTES.map(async (route) => {
      const response = await request.get(`${BASE}${route}`);
      expect(response.status(), route).toBe(200);
      return { route, html: await response.text() };
    }),
  );
  const linkedFrom = new Map<string, string>();
  for (const { route, html } of pages)
    for (const [, href] of html.matchAll(LINK)) {
      const url = new URL(href.replaceAll("&amp;", "&"), `${BASE}${route}`).href.split("#")[0];
      if (url.startsWith(BASE) && !linkedFrom.has(url)) linkedFrom.set(url, route);
    }
  const broken = await Promise.all(
    [...linkedFrom].map(async ([url, route]) => {
      const status = (await request.get(url, { maxRedirects: 5 })).status();
      return status >= 400 ? `${url} → ${status}, linked from ${route}` : [];
    }),
  );
  expect(broken.flat(), "broken same-site links").toEqual([]);
});

// Each section's Atom feed, linked from its index and its posts' pages.
for (const { opening, section, post } of [
  { opening: "The blog links to its feed", section: BLOG, post: posts[0] },
  { opening: "The briefings link to their feed", section: BRIEFINGS, post: briefings[0] },
]) {
  test(`${feedPath(section)}: the Atom feed, linked from the section's pages`, async ({ page, request }) => {
    story(`${opening}, for feed readers, from the index and each post. The feed lists the posts.`);
    const link = page.locator('head link[rel="alternate"][type="application/atom+xml"]');
    for (const path of [section.path, `${section.path}/${post.slug}`]) {
      await page.goto(`${BASE}${path}`);
      await expect(link).toHaveAttribute("href", new RegExp(`${feedPath(section)}$`));
    }
    const feed = await request.get(`${BASE}${feedPath(section)}`);
    expect(feed.headers()["content-type"]).toBe("application/xml; charset=utf-8");
    const xml = await feed.text();
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(xml).toContain(`/${post.slug}"/>`);
  });
}

test("The Groups menu", { tag: "@desktop-only" }, async ({ page }) => {
  story(
    "The Groups menu in the header lists the local groups in one column, and beside them the communities, such as parents and teachers.",
  );
  await page.goto(`${BASE}/london`);
  const trigger = page.getByRole("link", { name: "Groups", exact: true });
  const menu = trigger.locator("..");
  // Opened by focus, not hover: a frame moves the pointer away first, which
  // would close a hovered menu.
  await trigger.focus();
  const parents = menu.getByRole("menuitem", { name: "Parents" });
  await expect(menu.getByRole("menuitem", { name: "Cambridge" })).toBeVisible();
  await expect(parents).toBeVisible();
  await frame(page, "The Groups menu");
  story("Choosing Parents opens the parents' page, and the menu closes.");
  await parents.click();
  await expect(page).toHaveURL(`${BASE}/parents`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("PauseAI Parents");
  await expect(parents).toBeHidden();
  await frame(page, "The parents' page");
});
