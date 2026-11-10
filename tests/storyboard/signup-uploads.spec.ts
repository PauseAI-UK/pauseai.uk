import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { staffCopy } from "@/lib/content/staff-interface";
import { runSql } from "@/scripts/fresh-database.mjs";
import { importLuma } from "../steps";
import { BASE, expect, frame, story, test } from "./fixtures";
import type { Section } from "./report/frames";
import { logIn } from "./staff-steps";

export const section: Section = { name: "Import sign-ups", part: "Staff pages", order: 55 };

// Uploading a CSV of paper sign-ups, on files written different ways
// (tests/fixtures/signup-uploads/) and the fixture Luma calendar, whose five
// guests are at every event. Each flow on its own database.

const copy = staffCopy.signupUpload;
const EVENT = /PauseAI London: Protest at Parliament/;
const FILES = join(__dirname, "..", "fixtures", "signup-uploads");

/** Opens the page, as a staff member with the supporters permission. */
async function openUpload(page: Page, database: string) {
  await logIn(page, database, ["supporters"]);
  await page.goto(`${BASE}/staff/supporters/import`);
}

/** Chooses one of the fixture files, and gives the note any upload needs. */
async function chooseFile(page: Page, name: string, note = "Flyering at Camden Town") {
  await page.getByLabel(copy.drop.label).setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: readFileSync(join(FILES, name)),
  });
  await page.getByRole("textbox", { name: copy.form.note }).fill(note);
}

/** Chooses the column saying who's going, then finds the event by typing part of its name, and picks it. */
async function chooseEvent(page: Page, column: string) {
  await page.getByRole("combobox", { name: copy.form.eventColumn }).selectOption(column);
  await page.getByRole("searchbox", { name: copy.form.findEvent }).fill("Protest");
  await page.getByRole("button", { name: EVENT }).click();
}

/** Waits for the preview to finish working out what will happen, so a frame never catches it part-way. */
async function previewWorkedOut(page: Page) {
  await expect(page.getByText(copy.preview.loading)).toHaveCount(0);
}

/**
 * The foot of the page, where the preview is: choosing an event leaves the
 * window wherever the page's change in height put it, a different place each run.
 */
async function atFoot(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
}

test("A flyering file, linked to an event", async ({ page, flowDatabase, request }) => {
  await importLuma(request, BASE);
  story(
    "Staff open Import sign-ups, under Supporters in the navigation. Before any file, the page says what it needs.",
  );
  await logIn(page, flowDatabase, ["supporters"]);
  await page.goto(`${BASE}/staff/supporters`);
  // On a phone the navigation is behind the bar's menu.
  const navLink = page.getByRole("link", { name: new RegExp(`^${staffCopy.nav.signupUpload}`) });
  if (!(await navLink.first().isVisible())) await page.locator("nav details > summary").click();
  await navLink.filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: copy.title, level: 1 })).toBeVisible();
  await frame(page, "Before a file: its four steps");

  story("Every column name it understands, and the values each can hold, open in a section of their own.");
  await page.getByRole("button", { name: copy.help.more }).click();
  await frame(page, "All column names and values");
  await page.getByRole("button", { name: copy.help.less }).click();

  story("They drop in a file. Name, email, postcode and phone are understood. Other columns are ignored.");
  await chooseFile(page, "street-flyering.csv");
  await frame(page, "What each column will do");

  story("They choose the column saying who's going, then the event it's for.");
  await chooseEvent(page, "Saturday march");
  await previewWorkedOut(page);
  await atFoot(page);
  await frame(page, "The event, its column and a note");

  story("What will happen to everyone is worked out as soon as there's a file and a note, at the foot of the page.");
  await expect(page.getByRole("button", { name: copy.preview.importNow(5, 1) })).toBeVisible();
  await previewWorkedOut(page);
  await atFoot(page);
  await frame(page, "The preview: one long table");

  story("Importing adds the five, and registers the one who wasn't going yet.");
  await page.getByRole("button", { name: copy.preview.importNow(5, 1) }).click();
  await expect(page.getByRole("heading", { name: copy.result.title("street-flyering.csv") })).toBeVisible();
  await expect(page.getByText(copy.result.luma.added, { exact: true })).toHaveCount(1);
  await frame(page, "What the upload did");

  story("The person's own page shows the form they filled in, with the note, and permission to contact them.");
  await page.getByRole("link", { name: "Robin Newcomer" }).click();
  await page
    .locator("summary", { has: page.getByRole("heading", { name: staffCopy.supporters.detail.activityTitle }) })
    .click();
  await expect(page.getByText("Flyering at Camden Town")).toBeVisible();
  await frame(page, "On the supporter's page");

  story("The page links to every import so far, by the date on the forms.");
  await page.goto(`${BASE}/staff/supporters/import`);
  await page.getByRole("link", { name: copy.uploads.see }).click();
  await expect(page.getByRole("link", { name: "Flyering at Camden Town" })).toBeVisible();
  await frame(page, "Past imports");
});

test("A big file", async ({ page, flowDatabase, request }) => {
  await importLuma(request, BASE);
  story(
    "A hundred sign-ups from a cheese vigil's stall, linked to an event, with all the mistakes a pile of paper has. Those held back are at the top.",
  );
  await openUpload(page, flowDatabase);
  await chooseFile(page, "cheesemouse.csv", "Cheese vigil stall");
  await chooseEvent(page, "5 Dec cheese vigil");
  const importNow = page.getByRole("button", { name: /^Import \d+ people and register \d+ on Luma/ });
  await expect(importNow).toBeEnabled();
  await previewWorkedOut(page);
  await page
    .getByRole("heading", { name: copy.steps.check })
    .evaluate((heading) => heading.scrollIntoView({ block: "center", behavior: "instant" }));
  await frame(page, "What will happen, those held back first");

  story("Importing them all.");
  await importNow.click();
  await expect(page.getByRole("heading", { name: copy.result.title("cheesemouse.csv") })).toBeVisible();
  await frame(page, "A hundred imported");
});

test("A spreadsheet's own export, with no event", async ({ page, flowDatabase }) => {
  story(
    "This file has semicolons, a title over its headings, a heading in capitals, and emails written all sorts of ways. It's still read.",
  );
  await openUpload(page, flowDatabase);
  await chooseFile(page, "stall-export.csv");
  await expect(page.getByRole("button", { name: copy.preview.importOnly(3) })).toBeVisible();
  await previewWorkedOut(page);
  await frame(page, "Its columns, read");

  story("With no event, nobody goes on Luma.");
  await expect(page.getByRole("button", { name: copy.preview.importOnly(3) })).toBeVisible();
  await frame(page, "The preview, with nobody on Luma");

  await page.getByRole("button", { name: copy.preview.importOnly(3) }).click();
  await expect(page.getByRole("heading", { name: copy.result.title("stall-export.csv") })).toBeVisible();
  await frame(page, "All three imported");
});

test("A file with a column it won't guess at", async ({ page, flowDatabase, request }) => {
  await importLuma(request, BASE);
  story(
    "A tab-separated file with a favourite colour. That column goes nowhere, and there's nothing to link to an event.",
  );
  await openUpload(page, flowDatabase);
  await chooseFile(page, "volunteers.tsv");
  await expect(page.getByText(copy.form.noEventColumn)).toBeVisible();
  await expect(page.getByRole("searchbox", { name: copy.form.findEvent })).toBeDisabled();
  await previewWorkedOut(page);
  await frame(page, "No column to link an event to");
});

test("Rows held back, fixed and uploaded again", async ({ page, flowDatabase }) => {
  runSql(
    flowDatabase,
    `WITH p AS (INSERT INTO email_problems (kind, address, can_reset) VALUES ('hard', 'blocked.person@example.com', true) RETURNING id)
     INSERT INTO email_blocks (address, problem_id) SELECT 'blocked.person@example.com', id FROM p`,
  );
  story("One row in this file is fine. Each of the others has something the site won't guess at.");
  await openUpload(page, flowDatabase);
  await chooseFile(page, "needs-fixing.csv");
  await expect(page.getByText(copy.preview.problems["bad-phone"])).toBeVisible();
  await frame(page, "Those held back, and why");

  story("Importing goes ahead with the one that's fine. The rest are fixed in the spreadsheet.");
  await page.getByRole("button", { name: copy.preview.importOnly(1) }).click();
  await expect(page.getByRole("heading", { name: copy.result.title("needs-fixing.csv") })).toBeVisible();
  await frame(page, "One imported, seven held back");

  story("Fixed, the whole file goes in again. The person already in isn't added twice.");
  await page.goto(`${BASE}/staff/supporters/import`);
  await chooseFile(page, "fixed.csv");
  await expect(page.getByRole("button", { name: copy.preview.importOnly(5) })).toBeVisible();
  await expect(page.getByText(copy.preview.happens.alreadyImported)).toBeVisible();
  await frame(page, "The fixed file: one already imported");

  story("Uploaded a third time, there's nothing left to do.");
  await page.getByRole("button", { name: copy.preview.importOnly(5) }).click();
  await expect(page.getByRole("heading", { name: copy.result.title("fixed.csv") })).toBeVisible();
  await page.goto(`${BASE}/staff/supporters/import`);
  await chooseFile(page, "fixed.csv");
  await expect(page.getByText(copy.preview.nothing)).toBeVisible();
  await frame(page, "Nothing to import");
});

test("Files it refuses", async ({ page, flowDatabase }) => {
  story("A file with no name or email can't be anyone, and the page says what it found.");
  await openUpload(page, flowDatabase);
  await chooseFile(page, "petition.csv");
  await expect(
    page.getByText(
      copy.refused.missing(
        `${copy.help.fields.name.label}, ${copy.help.fields.email.label}`,
        "Signed at, Comment, Signature",
      ),
    ),
  ).toBeVisible();
  await frame(page, "No name or email");

  story("With two columns that could each be the email, it won't pick one.");
  await chooseFile(page, "two-emails.csv");
  await expect(page.getByText(copy.refused.clash(copy.help.fields.email.label, "Email, E-mail address"))).toBeVisible();
  await frame(page, "Two columns for the email");

  story("A spreadsheet's own file isn't a CSV.");
  await page
    .getByLabel(copy.drop.label)
    .setInputFiles({ name: "signups.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("PK") });
  await expect(page.getByText(copy.drop.notCsv("signups.xlsx"))).toBeVisible();
  await frame(page, "Not a CSV");
});

test("What Luma says", async ({ page, flowDatabase, request }) => {
  await importLuma(request, BASE);
  story("Luma takes one guest here, and skips another who's left the calendar. They're imported either way.");
  await openUpload(page, flowDatabase);
  await chooseFile(page, "luma-skips.csv");
  await chooseEvent(page, "Going");
  await page.getByRole("button", { name: copy.preview.importNow(2, 2) }).click();
  await expect(page.getByText(copy.result.luma.skipped)).toBeVisible();
  await frame(page, "Luma skips one");

  story("When Luma fails, the person is kept, and the page says to upload again to retry.");
  await page.goto(`${BASE}/staff/supporters/import`);
  await chooseFile(page, "luma-fails.csv");
  await chooseEvent(page, "Going");
  await page.getByRole("button", { name: copy.preview.importNow(1, 1) }).click();
  await expect(page.getByText(copy.result.luma.failed)).toBeVisible();
  await frame(page, "Luma fails");

  story("Uploading again tries Luma again, without adding them twice.");
  await page.goto(`${BASE}/staff/supporters/import`);
  await chooseFile(page, "luma-fails.csv");
  await chooseEvent(page, "Going");
  await expect(page.getByRole("button", { name: copy.preview.importNow(0, 1) })).toBeVisible();
  await frame(page, "Trying Luma again");
});

test("Something changes before importing", async ({ page, flowDatabase, request }) => {
  await importLuma(request, BASE);
  story("Staff look at what a file will do. While they read it, Robin registers for the event on Luma.");
  await openUpload(page, flowDatabase);
  await chooseFile(page, "street-flyering.csv");
  await chooseEvent(page, "Saturday march");
  const before = page.getByRole("button", { name: copy.preview.importNow(5, 1) });
  await expect(before).toBeVisible();
  runSql(
    flowDatabase,
    `INSERT INTO luma_people (user_id, email, name) VALUES ('usr-robin', 'robin.newcomer@example.com', 'Robin Newcomer');
     INSERT INTO luma_guests (id, event_id, user_id, approval_status, registered_at)
     SELECT 'gst-robin', id, 'usr-robin', 'approved', now() FROM luma_events WHERE name ~ 'Protest at Parliament'`,
  );
  story("Pressing Import does nothing yet, and shows what would happen now.");
  await before.click();
  await expect(page.getByText(copy.preview.changed)).toBeVisible();
  await expect(page.getByRole("button", { name: copy.preview.importNow(5, 0) })).toBeVisible();
  await frame(page, "What would happen now");
});
