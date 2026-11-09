import type { Page } from "@playwright/test";
import { staffCopy } from "@/lib/content/staff-interface";
import { runSql } from "@/scripts/fresh-database.mjs";
import { addFilter, changeFilter } from "../steps";
import { BASE, expect, frame, story, test } from "./fixtures";
import { holdNextPage, logIn } from "./staff-steps";
import type { Section } from "./report/frames";

export const section: Section = { name: "Audit log", part: "Staff pages", order: 70 };

// The audit log's search, filters and sorting, on a few entries of their own.

const copy = staffCopy.changes;
const filters = staffCopy.filters;

const JO = "jo.example@pauseai.uk";
const SAM = "sam.example@pauseai.uk";

/** Adds entries by Jo, Sam and the sync, some from long ago. */
function addEntries(database: string) {
  runSql(
    database,
    `INSERT INTO audit_log (actor, action, details, at) VALUES
       ('${JO}', 'save filter', '{"id": 1, "list": "events"}', now() - interval '2 days'),
       ('${SAM}', 'edit event', '{"owner": "${JO}"}', now() - interval '3 days'),
       ('${SAM}', 'save filter', '{"id": 2, "list": "events"}', now() - interval '5 days'),
       ('sync', 'sync politicians', '{}', now() - interval '6 days'),
       ('${JO}', 'rename filter', '{"id": 1, "list": "events"}', now() - interval '60 days')`,
  );
}

const menu = (page: Page) => page.locator("[popover]:popover-open");

/** The cells of who and what, a row a line. */
const whoAndWhat = async (page: Page) => {
  const rows = await page.locator("tbody tr").all();
  return Promise.all(
    rows.map(
      async (row) => `${await row.locator("td").nth(2).innerText()} ${await row.locator("td").nth(3).innerText()}`,
    ),
  );
};

test("Filtering the audit log", { tag: "@phone" }, async ({ page, flowDatabase }) => {
  story("An admin opens the audit log, to see what Jo has been doing. The newest is first.");
  addEntries(flowDatabase);
  await logIn(page, flowDatabase, ["admin", "supporters"]);
  await page.goto(`${BASE}/staff/audit-log`);
  await expect(page.getByRole("table")).toContainText(JO);
  await frame(page, "The audit log");

  story("They filter by who.");
  await addFilter(page, copy.actor, JO);
  await expect(page).toHaveURL(/actor=jo/);
  await expect.poll(() => whoAndWhat(page)).toEqual([`${JO} save filter`, `${JO} rename filter`]);
  await frame(page, "Only Jo's");

  story("A row in the chip's menu swaps to it, in one click.");
  const jo = `${copy.actor}: ${JO}`;
  await page.getByRole("button", { name: jo }).click();
  await expect(menu(page).getByRole("link", { name: JO })).toHaveAttribute("aria-current", "true");
  await frame(page, "The chip's menu");
  await menu(page).getByRole("link", { name: SAM, exact: true }).click();
  const sam = `${copy.actor}: ${SAM}`;
  await expect(page.getByRole("button", { name: sam })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await frame(page, "Only Sam's");

  story("To have Jo's as well, + Add turns the rows to boxes, with Sam ticked.");
  await page.getByRole("button", { name: sam }).click();
  await menu(page).getByRole("button", { name: filters.addChoice }).click();
  await expect(menu(page).getByRole("checkbox", { name: SAM })).toBeChecked();
  await frame(page, "The boxes, Sam ticked");

  story("Ticking Jo changes the list at once, behind the menu, which stays open.");
  await menu(page).getByRole("checkbox", { name: JO }).check();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expect(menu(page).getByRole("checkbox", { name: JO })).toBeChecked();
  const both = `${copy.actor}: ${filters.anyOf([SAM, JO])}`;
  await expect(page.getByRole("button", { name: both })).toBeVisible();
  await frame(page, "Jo's and Sam's, the menu still open");

  story("Clicking away just closes it. The URL has both, and only one step back to the list before them.");
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(page).toHaveURL(/actor=.*actor=/);
  await frame(page, "Jo's and Sam's, on one chip");

  story("Only the last week's, sorted by what they did.");
  await addFilter(page, copy.at, filters.lastDays(7));
  // The sort's link carries the filters of the page it's on, so wait for the filtered page.
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByRole("table").getByRole("link", { name: copy.action }).click();
  await expect(page).toHaveURL(/sort=action/);
  await expect.poll(() => whoAndWhat(page)).toEqual([`${SAM} edit event`, `${JO} save filter`, `${SAM} save filter`]);
  await frame(page, "The last week's, by what");

  story("Leaving out the saved filters, from Except.");
  await page.getByRole("button", { name: filters.except }).click();
  const group = page
    .locator("[popover]:popover-open details")
    .filter({ has: page.locator("summary", { hasText: new RegExp(`^${copy.action}$`) }) });
  await group.locator("summary").click();
  await group.getByRole("link", { name: "save filter", exact: true }).click();
  await expect(page.getByRole("button", { name: filters.notChip(copy.action, "save filter") })).toBeVisible();
  await expect.poll(() => whoAndWhat(page)).toEqual([`${SAM} edit event`]);
  await frame(page, "Without the saved filters");

  story("Turning Who round leaves both out, so the list is the sync's.");
  await changeFilter(page, both, filters.exceptThese);
  await expect(page.getByRole("button", { name: filters.notChip(copy.actor, filters.anyOf([SAM, JO])) })).toBeVisible();
  await expect.poll(() => whoAndWhat(page)).toEqual(["sync sync politicians"]);
  await frame(page, "All but Jo's and Sam's");
});

test("Back to one on a chip, and none", async ({ page, flowDatabase }) => {
  story(
    "Two people are chosen, so the chip's menu opens with its boxes ticked, and no row can clear them by accident.",
  );
  addEntries(flowDatabase);
  await logIn(page, flowDatabase, ["admin", "supporters"]);
  await page.goto(`${BASE}/staff/audit-log?actor=${JO}&actor=${SAM}`);
  const both = `${copy.actor}: ${filters.anyOf([JO, SAM])}`;
  await page.getByRole("button", { name: both }).click();
  await expect(menu(page).getByRole("checkbox", { name: SAM })).toBeChecked();
  await frame(page, "The menu, both ticked");

  story("Just one keeps the first ticked, and the list changes at once. The rows are links again.");
  await menu(page).getByRole("button", { name: filters.justOne }).click();
  await expect(menu(page).getByRole("link", { name: JO, exact: true })).toHaveAttribute("aria-current", "true");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await frame(page, "Jo alone, the menu still open");

  story("A row swaps, and the menu closes.");
  await menu(page).getByRole("link", { name: SAM, exact: true }).click();
  const sam = `${copy.actor}: ${SAM}`;
  await expect(page.getByRole("button", { name: sam })).toBeVisible();
  await expect(menu(page)).toHaveCount(0);
  await frame(page, "Only Sam's");

  story("Unticking the last one takes the filter off the list at once. The chip stays while the menu's open.");
  await page.getByRole("button", { name: sam }).click();
  await menu(page).getByRole("button", { name: filters.addChoice }).click();
  await menu(page).getByRole("checkbox", { name: SAM }).uncheck();
  await expect(page).toHaveURL(`${BASE}/staff/audit-log`);
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await expect(menu(page).getByRole("checkbox", { name: SAM })).not.toBeChecked();
  await frame(page, "Everyone's, the menu still open");

  story("Once the menu closes, the chip has gone.");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: `${copy.actor}:` })).toHaveCount(0);
  await frame(page, "No filter");
});

test("Ticking quickly", async ({ page, flowDatabase }) => {
  story("Each tick asks for the list. A slow answer to an older tick must not replace a newer one.");
  addEntries(flowDatabase);
  await logIn(page, flowDatabase, ["admin", "supporters"]);
  await page.goto(`${BASE}/staff/audit-log?actor=${JO}`);
  // The first tick's answer waits until the second tick's has arrived.
  const next = await holdNextPage(page, /actor=.*actor=sync$/);
  await page.getByRole("button", { name: `${copy.actor}: ${JO}` }).click();
  await menu(page).getByRole("button", { name: filters.addChoice }).click();
  await menu(page).getByRole("checkbox", { name: "sync", exact: true }).check();
  await menu(page).getByRole("checkbox", { name: "sync", exact: true }).uncheck();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await next.release();
  await expect(page).toHaveURL(new RegExp(`actor=${JO.replace("@", "(@|%40)")}$`));
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await frame(page, "Only Jo's: the newer tick won");
});

test("One way or the other, where a record has one value", async ({ page, flowDatabase }) => {
  story("An entry has one person, so someone left out and someone found can't both be needed. Sam is left out.");
  addEntries(flowDatabase);
  await logIn(page, flowDatabase, ["admin", "supporters"]);
  await page.goto(`${BASE}/staff/audit-log?actor=!${SAM}`);
  const out = filters.notChip(copy.actor, SAM);
  await expect(page.getByRole("button", { name: out })).toBeVisible();
  await frame(page, "All but Sam's");

  story("Staff add Jo from + Filter. Sam's lozenge goes, as finding Jo already leaves Sam out.");
  await addFilter(page, copy.actor, JO);
  await expect(page.getByRole("button", { name: `${copy.actor}: ${JO}` })).toBeVisible();
  await expect(page.getByRole("button", { name: out })).toHaveCount(0);
  await frame(page, "Only Jo's");
});

test("Leaving out every choice", async ({ page, flowDatabase }) => {
  story("All but one person is left out. Leaving that one out too would find nobody, so it takes the filter off.");
  addEntries(flowDatabase);
  await logIn(page, flowDatabase, ["admin", "supporters"]);
  await page.goto(`${BASE}/staff/audit-log?actor=!${JO}&actor=!${SAM}`);
  const out = filters.notChip(copy.actor, filters.anyOf([JO, SAM]));
  await page.getByRole("button", { name: out }).click();
  await menu(page).getByRole("checkbox", { name: "sync", exact: true }).check();
  await expect(page).toHaveURL(new RegExp(`/staff/audit-log$`));
  await frame(page, "Everyone ticked, and the list unfiltered");
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await frame(page, "No filter");
});

test("Searching the audit log, and saving it", async ({ page, flowDatabase }) => {
  story("The search box looks in who, what and the details. Here it's Jo, as the owner an edit gave an event.");
  addEntries(flowDatabase);
  await logIn(page, flowDatabase, ["admin", "supporters"]);
  await page.goto(`${BASE}/staff/audit-log`);
  const box = page.getByRole("searchbox", { name: copy.search });
  await box.fill("edit event");
  await box.press("Enter");
  await expect(page).toHaveURL(/q=edit/);
  await expect.poll(() => whoAndWhat(page)).toEqual([`${SAM} edit event`]);
  await frame(page, "What the search found");

  story("It can be saved for the rest of staff, as on the other lists.");
  const saved = filters.saved;
  await page.getByRole("button", { name: saved.save, exact: true }).click();
  await page.getByRole("textbox", { name: saved.name }).fill("Edits to events");
  await frame(page, "Saving it");
  await page.locator("[popover]:popover-open").getByRole("button", { name: saved.save, exact: true }).click();
  await expect(page.getByRole("button", { name: "Edits to events" })).toBeVisible();
  await frame(page, "Saved, and loaded");

  story("The download is what the search found, and no more.");
  const response = await page.request.get(`${BASE}/staff/audit-log/download?format=json&q=edit+event`);
  const rows: { action: string }[] = await response.json();
  expect(rows.map((row) => row.action)).toEqual(["edit event"]);
});

test("The audit log without Supporters", async ({ page, flowDatabase }) => {
  story("An admin who can't see supporters has the filters and the saved filters, but no entries about supporters.");
  addEntries(flowDatabase);
  runSql(
    flowDatabase,
    `INSERT INTO saved_filters (list, name, params, created_by) VALUES ('audit-log', 'Sam''s', '{"actor": ["${SAM}"]}', '${JO}')`,
  );
  await logIn(page, flowDatabase, ["admin"]);
  await page.goto(`${BASE}/staff/audit-log`);
  await expect(page.getByText(copy.withheld)).toBeVisible();
  await expect(page.getByRole("button", { name: filters.saved.chip, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: filters.add })).toBeVisible();
  await frame(page, "The audit log");
});
