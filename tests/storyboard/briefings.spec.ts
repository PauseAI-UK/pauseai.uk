import { findBriefing } from "@/lib/content/briefings";
import { BASE, expect, frame, story, test } from "./fixtures";
import type { Section } from "./report/frames";

export const section: Section = { name: "Briefings", part: "Public site", order: 30 };

// The briefings: posts like the blog's, under the campaigns. A briefing's
// page has its charts, diagrams and numbered sources.
const briefing = findBriefing("ai-news-weekly-briefing-23rd-30th-october")!;
const november = findBriefing("ai-news-weekly-briefing-6th-13th-november")!;
const thirteenth = findBriefing("ai-news-weekly-briefing-13th-20th-november")!;

test("The menu to briefings", { tag: "@desktop-only" }, async ({ page }) => {
  await page.goto(`${BASE}/`);
  const trigger = page.getByRole("link", { name: "Campaigns", exact: true });
  // Opened by focus, not hover: a frame moves the pointer away first, which
  // would close a hovered menu.
  await trigger.focus();
  const link = trigger.locator("..").getByRole("menuitem", { name: "Weekly briefings" });
  await expect(link).toBeVisible();
  await frame(page, "the Campaigns menu, with the briefings");
  await link.click();
  await expect(page).toHaveURL(`${BASE}/campaigns/briefings`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Weekly briefings");
  await frame(page, "the briefings, from the menu");
});

test("Read a briefing", async ({ page }) => {
  await page.goto(`${BASE}/campaigns/briefings`);
  await page.getByRole("link", { name: new RegExp(briefing.title) }).click();
  await expect(page).toHaveURL(`${BASE}/campaigns/briefings/${briefing.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(briefing.title);
  await frame(page, "a briefing, with the week's calendar");

  const budget = page.getByRole("table");
  await budget.scrollIntoViewIfNeeded();
  await expect(budget.locator("tbody tr")).toHaveCount(13);
  await frame(page, "the budget, by item");

  const signatories = page.getByText("Countries backing the Call");
  await signatories.scrollIntoViewIfNeeded();
  await frame(page, "the countries backing the call");

  const nextWeek = page.getByRole("heading", { name: "Next week key dates" });
  await nextWeek.scrollIntoViewIfNeeded();
  await frame(page, "next week's dates");

  await page.getByRole("link", { name: "Source 14" }).click();
  await expect(page).toHaveURL(/#source-14$/);
  await expect(page.locator("#source-14")).toBeInViewport();
  await frame(page, "a source, from its mark");

  await page.getByRole("link", { name: "← All briefings" }).click();
  await expect(page).toHaveURL(`${BASE}/campaigns/briefings`);
  await frame(page, "back at the briefings");
});

test("A briefing's diagrams and table", async ({ page }) => {
  story("A briefing whose stories have a diagram, a table and flags.");
  await page.goto(`${BASE}/campaigns/briefings/${november.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(november.title);
  await frame(page, "the 6th–13th November briefing");

  const diagram = page.getByRole("region", { name: /chip pathway/ });
  await diagram.scrollIntoViewIfNeeded();
  await frame(page, "the diagram of Nvidia's chips");
  if (test.info().project.name === "phone") {
    story("On a phone the diagram keeps a width its words can be read at, and scrolls sideways.");
    await diagram.evaluate((region) => region.scrollTo({ left: region.scrollWidth }));
    await expect.poll(() => diagram.evaluate((region) => region.scrollLeft)).toBeGreaterThan(0);
    await frame(page, "the diagram's far side, scrolled to");
  }

  const table = page.getByRole("table", { name: "What each AI text covers" });
  await table.scrollIntoViewIfNeeded();
  await expect(table.locator("tbody tr")).toHaveCount(8);
  await frame(page, "what each text covers");

  const lawsuit = page.getByRole("heading", { name: /US lawsuit/ });
  await lawsuit.scrollIntoViewIfNeeded();
  await frame(page, "the US lawsuit, set apart");

  const pace = page.getByRole("region", { name: /METR figure/ });
  await pace.scrollIntoViewIfNeeded();
  await frame(page, "the pace of AI research at Anthropic");
});

test("A briefing's diagram beside its story", async ({ page }) => {
  story("A briefing with a narrow diagram beside a story, a march's route and a list in two columns.");
  await page.goto(`${BASE}/campaigns/briefings/${thirteenth.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(thirteenth.title);
  await frame(page, "the 13th–20th November briefing");

  const regulator = page.getByRole("img", { name: /regulator that can act/ });
  await regulator.scrollIntoViewIfNeeded();
  await frame(page, "the diagram of the regulator MPs want, beside the story");

  const route = page.getByRole("img", { name: /London march/ });
  await route.scrollIntoViewIfNeeded();
  await frame(page, "the march's route");

  const calls = page.getByText("The report calls for:");
  await calls.scrollIntoViewIfNeeded();
  await frame(page, "what California's report calls for, in two columns");

  const flags = page.getByRole("img", { name: "China" });
  await flags.scrollIntoViewIfNeeded();
  await frame(page, "the US and China flags");
});
