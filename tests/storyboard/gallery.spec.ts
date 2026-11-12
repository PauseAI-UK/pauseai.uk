import { BASE, expect, frame, story, test } from "./fixtures";
import { hydrated } from "./settle";
import type { Section } from "./report/frames";

export const section: Section = { name: "Component gallery", part: "Tools and checks", order: 30 };

// The component gallery (app/(tools)/gallery): its index, then a flow per
// group with a frame of each component, so a change to any component shows
// beside main's, even one no other flow reaches. A frame is one component's
// section, not the group's whole page: a component that grows a line moves
// every one below it, and a picture of the page would differ all the way
// down. Pressing things is the other flows' job, and the examples' own
// Vitest tests'.

// Each group of the gallery, in its order. A new group fails the first test
// until it's here.
const GROUPS = [
  "tokens",
  "ui",
  "forms",
  "layout",
  "areas",
  "home",
  "blog-donate-events",
  "briefings",
  "campaigns-page",
  "campaigns-letter",
  "pages",
  "march-signup",
  "track-record",
  "sentiment",
  "tools",
  "collateral",
  "collateral-kit",
  "staff-kit",
  "staff-supporters",
  "staff-letters",
  "staff-politicians",
  "staff-mailings-events",
  "staff-broadcasts",
  "staff-admin",
];

// The public pages section leaves the gallery to this one, so this checks
// what it would: no uncaught error and no console error from our own code,
// on any gallery page a flow opens.
let problems: string[] = [];
test.beforeEach(({ page }) => {
  problems = [];
  page.on("console", (message) => {
    const origin = message.location().url;
    if (message.type() === "error" && (!origin || origin.startsWith(BASE))) {
      problems.push(`[error] ${message.text().slice(0, 300)}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`[pageerror] ${String(error).slice(0, 300)}`));
});
test.afterEach(() => {
  expect(problems, "console problems").toEqual([]);
});

/** Opens a gallery page, which search engines are told to leave alone. */
async function open(page: import("@playwright/test").Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await hydrated(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex, nofollow/);
}

test("gallery: index", async ({ page }) => {
  story("The gallery's index links to each group of components, in order.");
  await open(page, "/gallery");
  const hrefs = await page
    .getByRole("main")
    .getByRole("listitem")
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toEqual(GROUPS.map((group) => `/gallery/${group}`));
  await frame(page, "The index");
});

for (const group of GROUPS) {
  test(`gallery: ${group}`, async ({ page }) => {
    // A picture of each component: the staff kit's eighty took over half the minute a flow has, and
    // past it on a busy machine.
    test.slow();
    await open(page, `/gallery/${group}`);
    await expect(page.locator(`[data-gallery-group="${group}"]`)).toBeVisible();
    // The attachments' example PDF isn't there to draw, so each ends as a sheet, a blank canvas until pdf.js has found that.
    if (group === "staff-mailings-events") await expect(page.locator("canvas")).toHaveCount(0);
    const sections = page.locator(`[data-gallery-group="${group}"] > section`);
    // Each captioned with its component's name, and its file where two in the group share a name.
    const headings = await sections.evaluateAll((all) =>
      all.map((section) => {
        const h2 = section.querySelector(":scope > .container > h2")!;
        return { name: h2.firstChild!.textContent!.trim(), file: h2.querySelector("span")!.textContent! };
      }),
    );
    expect(headings.length).toBeGreaterThan(0);
    // A frame per component, so a group's flow takes as long as the group is big: the staff kit has fifty. Its
    // time limit grows with it, as a flat one is passed on a busy machine by the biggest group alone.
    test.setTimeout(60_000 + headings.length * 3_000);
    for (const [i, { name, file }] of headings.entries()) {
      const shared = headings.filter((other) => other.name === name).length > 1;
      await frame(page, shared ? `${name} (${file})` : name, { of: sections.nth(i) });
    }
  });
}
