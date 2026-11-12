import { FIXTURE_NOW } from "@/lib/server/fixtures/fixture-env.mjs";
import { campaigns } from "@/lib/content/email-your-mp";
import type { Page } from "@playwright/test";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { marchSignupCopy } from "@/lib/content/march-signup";
import { staffCopy } from "@/lib/content/staff-interface";
import type { Reason, Topic } from "@/lib/contact-permissions";
import { staffDate } from "@/lib/staff-time";
import { TEST_MPS } from "@/lib/test-mps";
import { runSql } from "@/scripts/fresh-database.mjs";
import {
  addFilter,
  addStaffAccount,
  changeFilter,
  fakeTurnstile,
  fillLetter,
  importLuma,
  importCivicrm,
  importMembers,
  logInAsStaff,
  lookUpTestMp,
  postLumaWebhook,
  sendLetter,
  syncPoliticians,
} from "../steps";
import { BASE, expect, madeUpAddress, frame, story, test } from "./fixtures";
import type { Section } from "./report/frames";

export const section: Section = { name: "Supporters", part: "Staff pages", order: 50 };

// The supporter pages, behind the supporters permission, on the fixture
// Luma calendar (five guests at every event, three contacts) and the
// letters a flow writes. Each flow on its own database.

const staffEmail = () => `staff-${test.info().testId.replace(/\W/g, "").slice(-8)}@pauseai.uk`;

/** Gives this flow's staff member the supporters permission, then logs them in. */
async function logInWithSupporters(page: Page, database: string) {
  addStaffAccount(database, staffEmail(), ["supporters"]);
  await logInAsStaff(page, BASE, staffEmail());
}

const copy = staffCopy.supporters;

/** Changes the Consent filter's topic, from its chip, to `topic` by email: the first of its ways in the menu. */
async function changeTopic(page: Page, chip: string, topic: string) {
  await page.getByRole("button", { name: chip }).click();
  await page.locator("[popover]:popover-open").getByRole("link", { name: topic, exact: true }).first().click();
}

/** A reason's words on a supporter's page, from `source`, without its date, which a flow's fixture data moves. */
function said(reason: Reason, source: string, topic?: Topic): string {
  const { reasons, sources } = copy.detail.permissions;
  return reasons[reason]("", sources[source], topic).replace(/[, ]*(by|since)?\s*$/, "");
}

/** Opens everything we hold of a supporter, folded at the foot of their page, with the erase button at its end. */
async function openEverything(page: Page) {
  await page.locator("summary", { has: page.getByRole("heading", { name: copy.detail.everythingTitle }) }).click();
}

/** Opens a supporter's history, folded at the foot of their page. */
async function openHistory(page: Page) {
  await page.locator("summary", { has: page.getByRole("heading", { name: copy.detail.activityTitle }) }).click();
}

test("Without the Supporters permission", async ({ page, flowDatabase }) => {
  story(
    "Staff without the Supporters permission have no Supporters link. Going to the supporters list, or to a supporter's page, takes them to the dashboard.",
  );
  addStaffAccount(flowDatabase, staffEmail());
  await logInAsStaff(page, BASE, staffEmail());
  await expect(page.getByRole("link", { name: staffCopy.nav.supporters })).toHaveCount(0);
  await page.goto(`${BASE}/staff/supporters`);
  await expect(page).toHaveURL(`${BASE}/staff`);
  await page.goto(`${BASE}/staff/supporters/1`);
  await expect(page).toHaveURL(`${BASE}/staff`);
});

test("Filtering supporters", async ({ page, request, flowDatabase }) => {
  story(
    "Staff with the Supporters permission open Supporters. Everyone the Luma import found is there, the newest activity first.",
  );
  await importLuma(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.title);
  // Five guests, a contact who never registered, and a host who never registered.
  await expect(page.getByText(copy.total(7), { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fay Follower" })).toBeVisible();
  await frame(page, "The supporters list");
  story("They search for an address. Every supporter here has one at fixture@example, so all seven stay.");

  // The search waits for its button; a filter applies as soon as it's chosen, keeping the search.
  await page.getByRole("searchbox", { name: copy.filters.search }).fill("fixture@example");
  await page.getByRole("button", { name: staffCopy.search }).click();
  await expect(page).toHaveURL(/\/staff\/supporters\?q=fixture%40example$/);
  // Every one of them has an address at fixture@example.
  await expect(page.getByText(copy.total(7), { exact: true })).toBeVisible();
  await frame(page, "The list, searched");
  story(
    "They filter to those with Luma events among their activities, and sort by name. Five registered for an event. The one with no name comes last.",
  );
  await addFilter(page, copy.columns.badges, copy.badges.registered);
  await expect(page).toHaveURL(/\/staff\/supporters\?q=fixture%40example&activity=registered$/);
  await page.getByRole("link", { name: copy.columns.name, exact: true }).click();
  await expect(page).toHaveURL(/sort=name/);
  await expect(page.getByRole("link", { name: "Fay Follower" })).toHaveCount(0);
  // Five: the fifth guest declined every event; the host with no name never registered, but hosts one.
  await expect(page.getByText(copy.total(5), { exact: true })).toBeVisible();
  const names = await page.locator("tbody").getByRole("link").allTextContents();
  // By name, the one with none last.
  const named = names.filter((name) => name !== copy.noName);
  expect(names).toEqual([...named.sort(), copy.noName]);
  await frame(page, "The list, filtered and sorted by name");
  story("They change the filter to those who wrote to their MP. Nobody has yet.");

  await changeFilter(page, `${copy.columns.badges}: ${copy.badges.registered}`, copy.badges.letter);
  await expect(page.getByText(copy.none)).toBeVisible();
  await frame(page, "The list, with nobody in it");

  story("Clear filters takes away the search, the filters and the sort.");
  // Reset clears every filter, and the sort.
  await page.getByRole("link", { name: staffCopy.resetFilters }).click();
  await expect(page).toHaveURL(`${BASE}/staff/supporters`);
  await expect(page.getByText(copy.total(7), { exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: copy.filters.search })).toHaveValue("");
  await expect(page.getByRole("button", { name: `${copy.columns.badges}: ${copy.badges.letter}` })).toHaveCount(0);
  await frame(page, "The supporters list, cleared");

  story("Clicking the Name heading sorts the list by name. Clicking it again reverses it.");
  // A heading sorts the list; clicking it again reverses it.
  await page.getByRole("link", { name: copy.columns.name, exact: true }).click();
  await expect(page).toHaveURL(/sort=name&dir=asc/);
  expect(await page.locator("tbody").getByRole("link").first().textContent()).toBe("Alex Fixture");
  await page.getByRole("link", { name: copy.columns.name, exact: true }).click();
  await expect(page).toHaveURL(/sort=name&dir=desc/);
  expect(await page.locator("tbody").getByRole("link").first().textContent()).toBe("Sam Fixture");
  await frame(page, "The list, by name, Z to A");
});

test("Supporters not at an event", async ({ page, request, flowDatabase }) => {
  story(
    "Staff want the supporters who weren't at the London March. Except offers the filters that can leave people out.",
  );
  await importLuma(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  await expect(page.getByText(copy.total(7), { exact: true })).toBeVisible();
  const march = copy.filters.eventChoice("PauseAI London March", staffDate(new Date("2026-02-14T12:00:00Z")));
  await page.getByRole("button", { name: staffCopy.filters.except }).click();
  await expect(page.locator("[popover]:popover-open").getByText(staffCopy.filters.exceptHeading)).toBeVisible();
  await frame(page, "Except, open");
  story('They choose Event, and type "march" to find it.');
  await page.locator("[popover]:popover-open summary", { hasText: new RegExp(`^${copy.filters.event}$`) }).click();
  // Its events show once something's typed in its box.
  await page.locator("[popover]:popover-open").getByRole("searchbox", { name: staffCopy.filters.narrow }).fill("march");
  await expect(page.locator("[popover]:popover-open").getByRole("link", { name: march, exact: true })).toBeVisible();
  await frame(page, "Except's events, narrowed");
  story("Three supporters weren't at the march: Dee, who declined, and Fay and a host, who never registered.");
  await page.locator("[popover]:popover-open").getByRole("link", { name: march, exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/supporters\?event=%21/);
  // Four guests were approved for it; Dee declined, Fay follows the calendar but never registered, and the
  // protest's host with no name never registered either.
  await expect(page.getByText(copy.total(3), { exact: true })).toBeVisible();
  expect(await page.locator("tbody").getByRole("link").allTextContents()).toEqual(
    expect.arrayContaining(["Dee Clined", "Fay Follower"]),
  );
  await frame(page, "Supporters not at the London March");
  story("The filter's chip has a menu. Only this turns the filter round.");
  await page.getByRole("button", { name: staffCopy.filters.notChip(copy.filters.event, march) }).click();
  await expect(
    page.locator("[popover]:popover-open").getByRole("link", { name: staffCopy.filters.onlyThis }),
  ).toBeVisible();
  await frame(page, "The chip's menu");
  story("Now the list is the four guests approved for the march, with a column for each one's registration.");
  await page.locator("[popover]:popover-open").getByRole("link", { name: staffCopy.filters.onlyThis }).click();
  await expect(page.getByText(copy.total(4), { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: copy.columns.registrations })).toBeVisible();
  await expect(page.locator("tbody").getByText(copy.detail.registered).first()).toBeVisible();
  await frame(page, "Supporters at the London March");
});

test("Supporters by MP", async ({ page, request, flowDatabase }) => {
  story(
    "Staff look for the supporters in Mo Example's constituency, Manchester Central. The MP filter shows MPs once something's typed in its box.",
  );
  await importLuma(request, BASE);
  await syncPoliticians(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  await expect(page.getByText(copy.total(7), { exact: true })).toBeVisible();
  const mp = staffCopy.politician.roles.commons;
  const mo = copy.filters.mpChoice("Mo Example", "Manchester Central");
  await page.getByRole("button", { name: staffCopy.filters.add }).click();
  await page.locator("[popover]:popover-open summary", { hasText: new RegExp(`^${mp}$`) }).click();
  // The MPs show once something's typed in the box.
  await page.locator("[popover]:popover-open").getByRole("searchbox", { name: staffCopy.filters.narrow }).fill("manc");
  await expect(page.locator("[popover]:popover-open").getByRole("link", { name: mo, exact: true })).toBeVisible();
  await frame(page, "The MP filter, narrowed");
  story("Only Jane Fixture's postcode is in Manchester Central. The page's title names the filter.");
  await page.locator("[popover]:popover-open").getByRole("link", { name: mo, exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/supporters\?mp=\d+$/);
  // Jane's postcode is the one in Manchester Central.
  await expect(page.getByText(copy.total(1), { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Jane Fixture" })).toBeVisible();
  await expect(page).toHaveTitle(`${staffCopy.filters.pageTitle(copy.title, `${mp}: ${mo}`)} - ${staffCopy.metaTitle}`);
  await frame(page, "Mo Example's constituents");
});

test("A supporter's page", async ({ page, request, flowDatabase }) => {
  story(
    "Jane Fixture unsubscribes from the Luma calendar's emails, and Luma tells us. Luma tells us twice, and it's recorded once.",
  );
  await importLuma(request, BASE);
  await syncPoliticians(request, BASE);
  // Jane unsubscribed from the calendar's emails, Luma told us, and someone redelivered it.
  expect(
    await postLumaWebhook(request, BASE, "calendar.person.unsubscribed", "jane.fixture@example.com", "msg_1"),
  ).toEqual({
    recorded: true,
  });
  expect(
    await postLumaWebhook(request, BASE, "calendar.person.unsubscribed", "jane.fixture@example.com", "msg_1"),
  ).toEqual({
    recorded: false,
  });
  story(
    "Staff open Jane's page. It says she first came via Luma, and shows her phone number, her MP and that she opted out of the calendar's emails.",
  );
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  const jane = page.getByRole("row").filter({ hasText: "Jane Fixture" });
  await jane.getByRole("link", { name: "Jane Fixture" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Jane Fixture");
  await expect(page.getByText(copy.detail.firstVia(copy.sources.luma))).toBeVisible();
  await expect(page.getByText("07700 900001", { exact: false }).first()).toBeVisible();
  // Her postcode is in Manchester Central, whose MP the politicians sync brought.
  await expect(page.getByRole("link", { name: "Mo Example" })).toBeVisible();
  const reasons = copy.detail.permissions.reasons;
  // Her email and her Luma number in one row, each with its reason.
  await expect(
    page.getByText(reasons.unsubscribed("16 Oct 2026", copy.detail.permissions.sources.luma), { exact: false }),
  ).toHaveCount(2);
  await frame(page, "Jane's page");
  story("Her history, at the foot of the page, has the opt-out.");
  await openHistory(page);
  const history = page.getByRole("list", { name: copy.detail.activityTitle });
  await expect(history.getByText(copy.detail.kinds["opted-out"], { exact: false }).first()).toBeVisible();
  await frame(page, "Jane's history");

  story("Jane subscribes again. Her page says so, and her history keeps both.");
  // Subscribing again closes the opt-out, and both show in the history.
  expect(
    await postLumaWebhook(request, BASE, "calendar.person.subscribed", "jane.fixture@example.com", "msg_2"),
  ).toEqual({
    recorded: true,
  });
  await page.reload();
  // A contact again, since before Luma's webhook, her email and number alike.
  await expect(
    page.getByText(reasons.following("20 Sept 2026", copy.detail.permissions.sources.luma), { exact: false }),
  ).toHaveCount(2);
  await openHistory(page);
  await expect(history.getByText(copy.detail.kinds.resubscribed, { exact: false })).toBeVisible();
  await frame(page, "Jane's page, subscribed again");

  story(
    "Staff download the supporters as contact cards for WhatsApp. The audit log records the download, but not looking at a supporter's page.",
  );
  // Downloading them, as cards for WhatsApp, is logged; looking isn't.
  const cards = await page.request.get(`${BASE}/staff/supporters/download?format=vcf`);
  expect(await cards.text()).toMatch(/^FN:PauseAI \w{4} - Jane Fixture$/m);
  addStaffAccount(flowDatabase, staffEmail(), ["admin", "supporters"]);
  await page.goto(`${BASE}/staff/audit-log`);
  await expect(page.getByRole("cell", { name: "download supporters" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "view supporter" })).toHaveCount(0);
  await frame(page, "The audit log");
});

test("Notes on a supporter", async ({ page, request, flowDatabase }) => {
  story(
    "A colleague wrote a note on Jane Fixture's page last week. Only its writer could change it, and only for a day, so there's no way to edit or delete it here.",
  );
  await importLuma(request, BASE);
  const [jane] = runSql(
    flowDatabase,
    "SELECT supporter_id FROM supporter_links WHERE matched_value = 'jane.fixture@example.com' LIMIT 1",
  );
  // A colleague's note from last week, which only its writer could have changed, and only for a day.
  runSql(
    flowDatabase,
    `INSERT INTO notes (supporter_id, body, written_by, created_at)
     VALUES (${jane}, 'Asked about the Manchester group.', 'sam.example@pauseai.uk', '2026-10-09T10:00:00Z')`,
  );
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters/${jane}`);
  const card = page.getByRole("region", { name: staffCopy.notes.title });
  const notes = card.getByRole("listitem");
  await expect(notes).toHaveCount(1);
  await expect(card.getByRole("button", { name: staffCopy.notes.edit })).toHaveCount(0);
  await expect(card.getByRole("button", { name: staffCopy.notes.delete })).toHaveCount(0);
  await frame(page, "Jane's page, with a colleague's note");
  story("Staff write a note of their own, with a link in it.");
  await card.getByRole("button", { name: staffCopy.notes.write }).click();
  await card
    .getByRole("textbox", { name: staffCopy.notes.note })
    .fill("Met her at the Leeds stall.\nSlides from her talk: https://example.org/slides/leeds");
  await frame(page, "Writing a note");
  story("Added, the note is at the top, and its link can be followed. Its writer can edit or delete it for a day.");
  await card.getByRole("button", { name: staffCopy.notes.add }).click();
  await expect(notes).toHaveCount(2);
  await expect(card.getByRole("textbox", { name: staffCopy.notes.note })).toHaveCount(0);
  await expect(notes.first().getByRole("link", { name: "https://example.org/slides/leeds" })).toHaveAttribute(
    "href",
    "https://example.org/slides/leeds",
  );
  await frame(page, "The new note");
  story("They edit it.");

  await notes.first().getByRole("button", { name: staffCopy.notes.edit }).click();
  await notes
    .first()
    .getByRole("textbox", { name: staffCopy.notes.note })
    .fill("Met her at the Leeds stall in October.");
  await frame(page, "Editing the note");
  story("Saved, the note is marked as edited.");
  await notes.first().getByRole("button", { name: staffCopy.notes.save }).click();
  await expect(notes.first()).toContainText(`· ${staffCopy.notes.edited}`);
  await expect(notes.first().getByRole("textbox")).toBeHidden();
  await frame(page, "The note, edited");

  story("An admin can't delete the colleague's note from last week, as its day is up. They can delete one from today.");
  addStaffAccount(flowDatabase, staffEmail(), ["admin", "supporters"]);
  runSql(
    flowDatabase,
    `INSERT INTO notes (supporter_id, body, written_by, created_at)
     VALUES (${jane}, 'Wrong supporter, sorry.', 'sam.example@pauseai.uk', '${FIXTURE_NOW}'::timestamptz - interval '1 hour')`,
  );
  await page.reload();
  const oldNote = notes.filter({ hasText: "Asked about the Manchester group." });
  const newNote = notes.filter({ hasText: "Wrong supporter, sorry." });
  await expect(oldNote.getByRole("button", { name: staffCopy.notes.delete })).toHaveCount(0);
  await expect(newNote.getByRole("button", { name: staffCopy.notes.delete })).toBeVisible();
  await frame(page, "An admin, with Delete on today's note only");
  story("Delete asks to be pressed a second time.");
  await newNote.getByRole("button", { name: staffCopy.notes.delete }).click();
  await frame(page, "Deleting the colleague's note");
  await newNote.getByRole("button", { name: staffCopy.deleteItShort }).click();
  await expect(notes).toHaveCount(2);
  await frame(page, "The note, deleted");
  story("The audit log records who added, edited and deleted a note on Jane.");

  await page.goto(`${BASE}/staff/audit-log`);
  for (const action of ["add note", "edit note", "delete note"]) {
    await expect(page.getByRole("cell", { name: action, exact: true })).toBeVisible();
  }
  await frame(page, "The audit log");
});

test("Merged by phone number", async ({ page, request, flowDatabase }) => {
  story(
    "A newer Luma guest gives Jane Fixture's mobile number, written differently. The next pass over everyone's numbers makes the two one supporter.",
  );
  await importLuma(request, BASE);
  // A newer guest gives Jane's mobile, written as people write it; the next pass over everyone's numbers makes them one.
  const [jane] = runSql(
    flowDatabase,
    "SELECT supporter_id FROM supporter_links WHERE matched_value = 'jane.fixture@example.com' LIMIT 1",
  );
  const [guest, other, email] = runSql(
    flowDatabase,
    `SELECT g.user_id, k.supporter_id, k.matched_value FROM luma_guests g JOIN supporter_links k ON k.luma_user_id = g.user_id
     WHERE k.supporter_id > ${jane} ORDER BY k.supporter_id DESC LIMIT 1`,
  )[0].split("\t");
  runSql(flowDatabase, `UPDATE luma_guests SET phone = '07700 900001' WHERE user_id = '${guest}'`);
  runSql(flowDatabase, "SELECT count(*) FROM merge_supporters_by_phone(); REFRESH MATERIALIZED VIEW supporters_list");
  story("The other supporter's page now goes to Jane's, which has both email addresses.");
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters/${other}`);
  await expect(page).toHaveURL(`${BASE}/staff/supporters/${jane}`);
  // Both addresses; the name the newest of them gave.
  await expect(page.getByText("jane.fixture@example.com").first()).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
  await frame(page, "The merged supporter's page");
});

test("A letter writer's page", async ({ page, request, flowDatabase }) => {
  story("Jane Smith writes to her MP. Staff find her letter on its campaign's page, and click her name.");
  await syncPoliticians(request, BASE);
  const sender = madeUpAddress("Jane Smith", 41);
  await fakeTurnstile(page);
  await lookUpTestMp(page, BASE, TEST_MPS[0]);
  await fillLetter(page, sender);
  await sendLetter(page, TEST_MPS[0]);

  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/campaigns/${campaigns[0].slug}`);
  await page.getByRole("row").filter({ hasText: "Jane Smith" }).getByRole("link", { name: "Jane Smith" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Jane Smith");
  await expect(page.getByText(`1 ${copy.detail.lettersCounted(1)}`)).toBeVisible();
  await expect(
    page.getByRole("region", { name: copy.detail.lettersTitle }).getByRole("link", { name: "Testy McTestface MP" }),
  ).toBeVisible();
  story("Her page has her letter and, in Everything we hold, the postcode she gave.");
  await openEverything(page);
  await expect(page.getByText("ZZ9 9ZZ", { exact: false })).toBeVisible();
  await frame(page, "Jane's page");
  story("Letter → opens her letter's page.");

  // The letter's status leads to its page, and back to her.
  await page.getByRole("link", { name: staffCopy.mailingPages.theLetter }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    staffCopy.letters.oneTitle("Jane Smith", "Testy McTestface MP"),
  );
  await frame(page, "Jane's letter");
  story("Her name on the letter's page leads back to her page.");
  await page.getByRole("link", { name: "Jane Smith" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Jane Smith");
});

test("A march sign-up's page", async ({ page, flowDatabase }) => {
  story(
    'Marta signs up for the march on its page, following a link tagged "nl". She gives her phone number, city and postcode, and ticks the box to hear about future campaigns.',
  );
  const email = madeUpAddress("Marta Marcher", 42, "example.org");
  const form = marchSignupCopy.form;
  await page.goto(`${BASE}/protests/march-against-ai-extinction-nov-26?utm_source=nl#register`);
  await page.getByLabel(form.name).fill("Marta Marcher");
  await page.getByLabel(form.email).fill(email);
  await page.getByRole("textbox", { name: new RegExp(`^${form.phone}`) }).fill("07700 900123");
  await page.getByRole("textbox", { name: new RegExp(`^${form.city}`) }).fill("Leeds");
  await page.getByRole("textbox", { name: new RegExp(`^${form.postcode}`) }).fill("ls1 1aa");
  await page.getByLabel(form.consent).check();
  await page.getByRole("button", { name: form.submit, exact: true }).click();
  await expect(page.getByRole("heading", { name: marchSignupCopy.share.title })).toBeVisible();

  story("In the supporters list, Marta has a March sign-up.");
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  const marta = page.getByRole("row").filter({ hasText: "Marta Marcher" });
  await expect(marta).toContainText(copy.badges.march);
  await frame(page, "The supporters list");
  story(
    "Her page has her phone number and, in Everything we hold, her postcode and the box she ticked. Her history has the sign-up, and where she came from.",
  );

  await marta.getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Marta Marcher");
  // Her number, without the country code, a yes for texts on the march's day and, as she agreed, after.
  await expect(page.getByText("07700 900123", { exact: false }).first()).toBeVisible();
  await openEverything(page);
  await expect(page.getByText("LS1 1AA", { exact: true })).toBeVisible();
  // Her email and number in the newsletter's row, each with its reason.
  await expect(
    page.getByText(
      copy.detail.permissions.reasons.asked("16 Oct 2026", copy.detail.permissions.sources["march-2026-11"]),
      { exact: false },
    ),
  ).toHaveCount(2);
  await openHistory(page);
  const history = page.getByRole("list", { name: copy.detail.activityTitle });
  await expect(history.getByText(copy.detail.cameFrom("nl"), { exact: false })).toBeVisible();
  await frame(page, "Marta's page");
});

test("A member who wrote to their MP", async ({ page, request, flowDatabase }) => {
  story(
    "Lee writes to their MP. The members import finds Lee is a member too, and the two are one supporter, with both a Member and a Wrote to MP activity.",
  );
  await syncPoliticians(request, BASE);
  await fakeTurnstile(page);
  await lookUpTestMp(page, BASE, TEST_MPS[0], "Lee Letter");
  await fillLetter(page, "lee.letter@example.com");
  await sendLetter(page, TEST_MPS[0]);
  await importMembers(request, BASE);

  await importCivicrm(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  // The only member who wrote to their MP.
  const lee = page.getByRole("row").filter({ hasText: copy.badges.member }).filter({ hasText: copy.badges.letter });
  await expect(lee).toContainText(copy.badges.member);
  await expect(lee).toContainText(copy.badges.letter);
  await frame(page, "The supporters list");
  story(
    "Lee's page has the name from the letter, the newest, and says Lee first came via Airtable's members, as CiviCRM doesn't return Lee. Lee joined before the join form asked about updates, so gets them. The history has the joining and the letter.",
  );

  await lee.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/staff\/supporters\/\d+$/);
  // The letter's sender's name, as the newest; how they first came, as a member.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lee Letter");
  await expect(page.getByText(copy.detail.firstVia(copy.sources.airtable))).toBeVisible();
  await expect(page.getByText("29 Nov 2025", { exact: false }).first()).toBeVisible();
  // Left the box on their letter unticked, the newest thing they told us about the newsletter.
  await expect(page.getByText(said("declined", "email-your-mp"), { exact: false })).toBeVisible();
  await openHistory(page);
  const history = page.getByRole("list", { name: copy.detail.activityTitle });
  await expect(history.getByText(copy.detail.kinds["member-joined"], { exact: false })).toBeVisible();
  await expect(history.getByText(copy.detail.kinds.letter, { exact: false })).toBeVisible();
  await frame(page, "Lee's page");
});

test("Supporters by subscription", async ({ page, request, flowDatabase }) => {
  story(
    "Jane Fixture has unsubscribed from the Luma calendar's emails. The supporters list has a Consent column: what each supporter gets, by topic.",
  );
  await importLuma(request, BASE);
  await importMembers(request, BASE);
  // Jane unsubscribed from the calendar's emails, and Luma told us.
  await postLumaWebhook(request, BASE, "calendar.person.unsubscribed", "jane.fixture@example.com", "msg_1");
  await importCivicrm(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  await expect(page.getByRole("columnheader", { name: copy.columns.subscriptions })).toBeVisible();
  await frame(page, "The supporters list");
  story(
    "Staff filter to those they can't email about events. Jane is there. Owen, a member who never opted in to chapter emails, isn't, as he never followed the calendar.",
  );

  // A topic first, those we can email about it, then in the chip's second half, those we can't.
  const answers = copy.detail.permissions.answers;
  // Consent has its own button, as it's what lets a message go.
  await page.getByRole("button", { name: copy.columns.subscriptions, exact: true }).click();
  await page
    .locator("[popover]:popover-open")
    .getByRole("link", { name: copy.filters.topics["events"] })
    .first()
    .click();
  await changeFilter(page, answers.email.yes, answers.email.no);
  await expect(page.getByRole("row").filter({ hasText: "Jane Fixture" })).toBeVisible();
  // Owen has never had anything to do with the calendar.
  await expect(page.getByRole("row").filter({ hasText: "Owen Member" })).toHaveCount(0);
  await frame(page, "Those who can't be emailed about events");
  story("They change the topic to the newsletter. Now Owen is there, and Jane, on the newsletter in CiviCRM, isn't.");

  // Another topic, from the chip's first half, keeping its answer: the newsletter by email, the first of its three.
  await changeTopic(
    page,
    `${copy.columns.subscriptions}: ${copy.filters.topics.events}`,
    copy.filters.topics.newsletter,
  );
  await expect(page).toHaveURL(/contact=email%3Anewsletter%3Ano/);
  await expect(page.getByRole("row").filter({ hasText: "Owen Member" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Jane Fixture" })).toHaveCount(0);
  await frame(page, "Those who can't be emailed the newsletter");
});

test("An old link with two subscriptions", async ({ page, request, flowDatabase }) => {
  story(
    "Subscriptions is chosen one at a time now, but a link or saved filter from before can have two. Each keeps its chip.",
  );
  await importLuma(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters?contact=email:events:no&contact=email:volunteering:no`);
  const { topics } = copy.filters;
  const label = copy.columns.subscriptions;
  await expect(page.getByRole("button", { name: `${label}: ${topics.events}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `${label}: ${topics.volunteering}` })).toBeVisible();
  await frame(page, "Two chips");

  story("Choosing another topic in one takes the filter's place, leaving one chip.");
  await changeTopic(page, `${label}: ${topics.events}`, topics.newsletter);
  await expect(page.getByRole("button", { name: `${label}: ${topics.newsletter}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `${label}: ${topics.volunteering}` })).toHaveCount(0);
  await frame(page, "One chip");
});

test("A member who never opted in", async ({ page, request, flowDatabase }) => {
  story(
    "Owen joined as a member without ticking Keep me informed. CiviCRM says they never opted in to chapter emails, so their page says we won't send them the newsletter.",
  );
  await importMembers(request, BASE);
  await importCivicrm(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  await page.getByRole("link", { name: "Owen Member" }).click();
  await expect(page.getByText(said("not-opted-in", "civicrm"), { exact: false })).toBeVisible();
  await expect(page.getByText(copy.detail.permissions.answers.email.no).first()).toBeVisible();
  await openHistory(page);
  await expect(page.getByText(copy.detail.intents.act_now)).toBeVisible();
  await frame(page, "Owen's page");
});

test("A member with No bulk emails", async ({ page, request, flowDatabase }) => {
  story(
    "Rhea is on the newsletter in CiviCRM, but has set No bulk emails there, so their page says we won't email them about anything. The ? by a topic says what it is.",
  );
  await importMembers(request, BASE);
  await importCivicrm(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  await page.getByRole("link", { name: "Rhea Member" }).click();
  await expect(page.getByText(said("no-bulk-email", "civicrm"), { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: copy.detail.permissions.why }).first().click();
  await expect(page.getByText(copy.detail.permissions.details.newsletter.about)).toBeVisible();
  await frame(page, "Rhea's page");
});

test("Their contact preferences, from their page", async ({ page, request, flowDatabase }) => {
  story(
    "In a fixture build, a supporter's page has a link per address at the foot of Can we contact them?, which opens the contact preferences page as one of our emails' links would, to see what they'd see.",
  );
  await importMembers(request, BASE);
  await importCivicrm(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  await page.getByRole("link", { name: "Tom Seed" }).click();
  const dev = page.getByRole("region", { name: staffCopy.devPreferences.title });
  await dev.scrollIntoViewIfNeeded();
  await frame(page, "A link for each address", { window: true });
  await dev.getByRole("link", { name: "tom.seed@example.com" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(emailSettingsCopy.settings.title);
  await frame(page, "Tom's contact preferences");
});

test("A member who unsubscribed in CiviCRM", async ({ page, request, flowDatabase }) => {
  story(
    "Kit unsubscribed from the newsletter in CiviCRM, and the hourly pull from CiviCRM brought it here as a stop. They're still on the volunteer list there, so we may email them about volunteering.",
  );
  await importMembers(request, BASE);
  await importCivicrm(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  await page.getByRole("link", { name: "Kit Member" }).click();
  await expect(page.getByText(said("unsubscribed", "civicrm"), { exact: false })).toBeVisible();
  await expect(page.getByText(said("subscribed", "civicrm", "volunteering"), { exact: false })).toBeVisible();
  await frame(page, "Kit's page");
});

test("A member CiviCRM doesn't have", async ({ page, request, flowDatabase }) => {
  story(
    "CiviCRM doesn't return some members, Mara among them. Mara ticked Keep me informed on joining, so that's still a yes to the newsletter.",
  );
  await importMembers(request, BASE);
  await importCivicrm(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  await page.getByRole("link", { name: "Mara Member" }).click();
  await expect(page.getByText(said("asked", "airtable"), { exact: false })).toBeVisible();
  await frame(page, "Mara's page");
});

test("Erasing a supporter", async ({ page, request, flowDatabase }) => {
  story("Sam Fixture asks to be erased. The button is at the end of Everything we hold, on Sam's page.");
  await importLuma(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  await page.getByRole("link", { name: "Sam Fixture" }).click();
  await openEverything(page);
  const eraseLink = page.getByRole("link", { name: staffCopy.erase.title });
  await eraseLink.scrollIntoViewIfNeeded();
  await frame(page, "The end of Sam's page");
  story("The erase page's button can't be pressed yet.");
  await eraseLink.click();
  await expect(page).toHaveURL(/\/staff\/supporters\/\d+\/erase$/);
  await expect(page.getByRole("button", { name: staffCopy.erase.button })).toBeDisabled();
  await frame(page, "The erase page");
  story("Staff give the request's reference, tick the box and erase Sam. The supporters list says it's done.");

  await page.getByRole("textbox", { name: staffCopy.erase.referenceLabel }).fill("Request of 16 Oct 2026");
  await page.getByRole("checkbox", { name: staffCopy.erase.confirm }).check();
  await page.getByRole("button", { name: staffCopy.erase.button }).click();
  await expect(page).toHaveURL(`${BASE}/staff/supporters?erased=1`);
  await expect(page.getByRole("status")).toHaveText(staffCopy.erase.done);
  await expect(page.getByRole("link", { name: "Sam Fixture" })).toHaveCount(0);
  await expect(page.getByText(copy.total(6), { exact: true })).toBeVisible();
  await frame(page, "The supporters list, without Sam");

  story(
    "The next Luma import reads every guest list again, and leaves Sam out. The audit log has the erasure, by its reference.",
  );
  // The next import, reading every guest list and host again, leaves Sam out.
  runSql(flowDatabase, "UPDATE luma_events SET guests_synced_at = NULL, hosts_synced_at = NULL");
  await importLuma(request, BASE);
  await page.reload();
  await expect(page.getByRole("link", { name: "Sam Fixture" })).toHaveCount(0);

  addStaffAccount(flowDatabase, staffEmail(), ["admin", "supporters"]);
  await page.goto(`${BASE}/staff/audit-log`);
  await expect(page.getByRole("cell", { name: "erase supporter" })).toBeVisible();
  // In the entry's details; its JSON, behind its button, has it too.
  await expect(page.getByText("Request of 16 Oct 2026").filter({ visible: true })).toBeVisible();
  await frame(page, "The audit log");
});

test("Erasing a member", async ({ page, request, flowDatabase }) => {
  story("Staff erase Mara, a member. The next members import leaves Mara out.");
  await importMembers(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters`);
  await page.getByRole("link", { name: "Mara Member" }).click();
  await openEverything(page);
  await page.getByRole("link", { name: staffCopy.erase.title }).click();
  await page.getByRole("textbox", { name: staffCopy.erase.referenceLabel }).fill("Request of 16 Oct 2026");
  await page.getByRole("checkbox", { name: staffCopy.erase.confirm }).check();
  await page.getByRole("button", { name: staffCopy.erase.button }).click();
  await expect(page.getByRole("status")).toHaveText(staffCopy.erase.done);
  await expect(page.getByRole("link", { name: "Mara Member" })).toHaveCount(0);

  await importMembers(request, BASE);
  await page.reload();
  await expect(page.getByText(copy.total(8), { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mara Member" })).toHaveCount(0);
  await frame(page, "The supporters list, after the members import");
});

test("A hold in CiviCRM", async ({ page, request, flowDatabase }) => {
  story(
    "CiviCRM has Casey's address on hold, as its emails to it bounced. The CiviCRM import blocks it here too, and it's listed with the supporters' blocked emails.",
  );
  await importCivicrm(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters/blocked-emails`);
  const row = page.getByRole("table").first().getByRole("row").filter({ hasText: "casey.chapter@example.com" });
  await expect(row).toContainText(staffCopy.emails.kinds.hold);
  await frame(page, "Supporters' blocked emails");
  story("Staff lift it, with a note. Only a new hold in CiviCRM blocks it again.");
  await row.getByLabel(staffCopy.emails.note).fill("Global say the address works again");
  await row.getByRole("button", { name: staffCopy.emails.unblock }).click();
  await expect(page.getByText(staffCopy.emails.noBlocks)).toBeVisible();
  await frame(page, "Supporters' blocked emails, empty");
});

test("Recording an opt-out told to staff", async ({ page, request, flowDatabase }) => {
  story(
    "Jane tells someone at a stall she'd rather not hear about volunteering any more. Under her consents, staff record it, with how she told them; only Jane can opt back in.",
  );
  await importCivicrm(request, BASE);
  await logInWithSupporters(page, flowDatabase);
  const [jane] = runSql(
    flowDatabase,
    "SELECT supporter_id FROM supporter_links WHERE matched_value = 'jane.fixture@example.com'",
  );
  await page.goto(`${BASE}/staff/supporters/${jane}`);
  const words = copy.detail.permissions.recordOptOut;
  await page.getByRole("button", { name: words.open }).click();
  // The box near the window's top, so its menu opens below it, as it does wherever it fits.
  await page
    .getByRole("button", { name: `${words.what}: ${words.choose}` })
    .evaluate((box) => box.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.evaluate(() => window.scrollBy({ top: -80, behavior: "instant" }));
  await page.getByRole("button", { name: `${words.what}: ${words.choose}` }).click();
  await expect(page.getByRole("button", { name: /^Volunteering, jane\.fixture@example\.com/ })).toBeVisible();
  await frame(page, "What they opted out of: under each address and number, by each way", { window: true });
  await page.getByRole("button", { name: /^Volunteering, jane\.fixture@example\.com/ }).click();
  await page.getByRole("textbox", { name: words.how }).fill("Asked at the Leeds stall");
  await page.getByRole("button", { name: words.record }).scrollIntoViewIfNeeded();
  await frame(page, "The form, filled in", { window: true });
  await page.getByRole("button", { name: words.record }).click();
  await expect(page.getByRole("button", { name: words.open })).toBeVisible();
  await expect(page.getByText(said("unsubscribed", "staff"), { exact: false })).toBeVisible();
  await page.getByRole("heading", { name: copy.detail.listsTitle }).scrollIntoViewIfNeeded();
  await frame(page, "Her consents, volunteering by email off", { window: true });
});
