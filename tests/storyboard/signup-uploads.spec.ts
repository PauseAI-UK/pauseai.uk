import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { staffCopy } from "@/lib/content/staff-interface";
import { runSql } from "@/scripts/fresh-database.mjs";
import { importLuma } from "../steps";
import { BASE, expect, frame, story, test } from "./fixtures";
import { logIn } from "./staff-steps";

// Uploading a CSV of paper sign-ups, on files written different ways
// (tests/fixtures/signup-uploads/) and the fixture Luma calendar, whose five
// guests are at every event. Each flow on its own database.

const copy = staffCopy.signupUpload;
const EVENT = /PauseAI London: Protest at Parliament/;
const FILES = join(__dirname, "..", "fixtures", "signup-uploads");

/** Opens the page, as a staff member with the supporters permission. */
async function openUpload(page: Page, database: string) {
  await logIn(page, database, ["supporters"]);
  await page.goto(`${BASE}/staff/supporters/upload`);
}

/** Chooses one of the fixture files, and waits for it to be read. */
async function chooseFile(page: Page, name: string) {
  await page.getByLabel(copy.drop.label).setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: readFileSync(join(FILES, name)),
  });
  await expect(page.locator("strong", { hasText: name })).toBeVisible();
}

const pile = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`\\d+ ${name}$`) });
const preview = (page: Page) => page.getByRole("button", { name: copy.form.preview });

/** Picks the event by its name, as its option also says its date. */
async function chooseEvent(page: Page) {
  const select = page.getByRole("combobox", { name: copy.form.event });
  const value = await select.locator("option", { hasText: EVENT }).first().getAttribute("value");
  await select.selectOption(value!);
}

test("A flyering file, linked to an event", async ({ page, flowDatabase, request }) => {
  await importLuma(request, BASE);
  story("Staff open Upload sign-ups, from the navigation. Before any file, the page says what it understands.");
  await openUpload(page, flowDatabase);
  await frame(page, "Before a file: the drop box beside the columns and values it understands");

  story(
    "They drop in a file. Name, email, postcode, phone and mailing list are understood. Other columns are ignored.",
  );
  await chooseFile(page, "street-flyering.csv");
  await frame(page, "What each column will do");

  story("They link the column saying who's going to an event, and add a note saying where the forms came from.");
  await chooseEvent(page);
  await page.getByRole("combobox", { name: copy.form.eventColumn }).selectOption("Saturday march");
  await page.getByLabel(copy.form.note).fill("Flyering at Camden Town");
  await frame(page, "The event, its column and a note");

  story("The preview is its own page, with exactly what will happen to everyone.");
  await preview(page).click();
  await expect(page.getByRole("heading", { name: copy.preview.title })).toBeVisible();
  await expect(page.getByRole("button", { name: copy.preview.importNow(5, 1) })).toBeVisible();
  await frame(page, "The preview: one long table");

  story("Each pile can be looked at on its own. Two of the three going are on Luma already.");
  await pile(page, copy.preview.piles.going).click();
  await frame(page, "Only those already going");

  story("Importing adds the five, and registers the one who wasn't going yet.");
  await page.getByRole("button", { name: copy.preview.importNow(5, 1) }).click();
  await expect(page.getByRole("heading", { name: copy.result.title("street-flyering.csv") })).toBeVisible();
  await expect(page.getByText(copy.result.luma.added)).toHaveCount(1);
  await frame(page, "What the upload did");

  story("The person's own page shows the form they filled in, with the note, and permission to contact them.");
  await page.getByRole("link", { name: "Robin Newcomer" }).click();
  await page
    .locator("summary", { has: page.getByRole("heading", { name: staffCopy.supporters.detail.activityTitle }) })
    .click();
  await expect(page.getByText("Flyering at Camden Town")).toBeVisible();
  await frame(page, "On the supporter's page");

  story("The upload is listed for next time.");
  await page.goto(`${BASE}/staff/supporters/upload`);
  await expect(page.getByRole("link", { name: "street-flyering.csv" })).toBeVisible();
  await frame(page, "The earlier uploads");
});

test("A spreadsheet's own export, with no event", async ({ page, flowDatabase }) => {
  story(
    "This file has semicolons, a title over its headings, first names and surnames, a heading in capitals, and emails written all sorts of ways. It's still read.",
  );
  await openUpload(page, flowDatabase);
  await chooseFile(page, "stall-export.csv");
  await frame(page, "Its columns, read");

  story("With no event, nobody goes on Luma. The last row has no first name, and goes in by surname.");
  await preview(page).click();
  await expect(page.getByRole("button", { name: copy.preview.importNow(3, 0) })).toBeVisible();
  await frame(page, "The preview, with nobody on Luma");

  await page.getByRole("button", { name: copy.preview.importNow(3, 0) }).click();
  await expect(page.getByRole("heading", { name: copy.result.title("stall-export.csv") })).toBeVisible();
  await frame(page, "All three imported");
});

test("A file with a column it won't guess at", async ({ page, flowDatabase }) => {
  story(
    "A tab-separated file with a favourite colour. That column goes nowhere, and there's nothing to link to an event.",
  );
  await openUpload(page, flowDatabase);
  await chooseFile(page, "volunteers.tsv");
  await page.getByRole("combobox", { name: copy.form.event }).selectOption({ index: 1 });
  await expect(page.getByText(copy.form.noEventColumn)).toBeVisible();
  await expect(preview(page)).toBeDisabled();
  await frame(page, "An event chosen, with no column to link it to");
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
  await preview(page).click();
  await pile(page, copy.preview.piles.held).click();
  await expect(page.getByText(copy.preview.unread("Maybe", "Mailing list"))).toBeVisible();
  await frame(page, "Those held back, and why");

  story("They can be downloaded, with why, to fix. Importing goes ahead with the one that's fine.");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: copy.preview.download }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(copy.preview.downloadName("needs-fixing.csv"));
  await page.getByRole("button", { name: copy.preview.importNow(1, 0) }).click();
  await expect(page.getByRole("heading", { name: copy.result.title("needs-fixing.csv") })).toBeVisible();
  await frame(page, "One imported, eight held back");

  story("Fixed, the whole file goes in again. The person already in isn't added twice.");
  await page.goto(`${BASE}/staff/supporters/upload`);
  await chooseFile(page, "fixed.csv");
  await preview(page).click();
  await expect(page.getByRole("button", { name: copy.preview.importNow(6, 0) })).toBeVisible();
  await expect(pile(page, copy.preview.piles.done)).toBeVisible();
  await frame(page, "The fixed file: one already imported");

  story("Uploaded a third time, there's nothing left to do.");
  await page.getByRole("button", { name: copy.preview.importNow(6, 0) }).click();
  await expect(page.getByRole("heading", { name: copy.result.title("fixed.csv") })).toBeVisible();
  await page.goto(`${BASE}/staff/supporters/upload`);
  await chooseFile(page, "fixed.csv");
  await preview(page).click();
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
  await chooseEvent(page);
  await preview(page).click();
  await page.getByRole("button", { name: copy.preview.importNow(2, 2) }).click();
  await expect(page.getByText(copy.result.luma.skipped)).toBeVisible();
  await frame(page, "Luma skips one");

  story("When Luma fails, the person is kept, and the page says to upload again to retry.");
  await page.goto(`${BASE}/staff/supporters/upload`);
  await chooseFile(page, "luma-fails.csv");
  await chooseEvent(page);
  await preview(page).click();
  await page.getByRole("button", { name: copy.preview.importNow(1, 1) }).click();
  await expect(page.getByText(copy.result.luma.failed)).toBeVisible();
  await frame(page, "Luma fails");

  story("Uploading again tries Luma again, without adding them twice.");
  await page.goto(`${BASE}/staff/supporters/upload`);
  await chooseFile(page, "luma-fails.csv");
  await chooseEvent(page);
  await preview(page).click();
  await expect(page.getByRole("button", { name: copy.preview.importNow(0, 1) })).toBeVisible();
  await frame(page, "Trying Luma again");
});

test("Something changes before importing", async ({ page, flowDatabase, request }) => {
  await importLuma(request, BASE);
  story("Staff preview a file. While they read it, Robin registers for the event on Luma.");
  await openUpload(page, flowDatabase);
  await chooseFile(page, "street-flyering.csv");
  await chooseEvent(page);
  await page.getByRole("combobox", { name: copy.form.eventColumn }).selectOption("Saturday march");
  await preview(page).click();
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

test("The preview with no file", async ({ page, flowDatabase }) => {
  story("The file stays only in the browser tab. A new tab's preview has none, and says so.");
  await logIn(page, flowDatabase, ["supporters"]);
  await page.goto(`${BASE}/staff/supporters/upload/preview`);
  await expect(page.getByText(copy.preview.none)).toBeVisible();
  await frame(page, "No file to preview");
});
