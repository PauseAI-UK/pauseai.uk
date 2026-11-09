import type { Page } from "@playwright/test";
import { staffCopy } from "@/lib/content/staff-interface";
import { runSql } from "@/scripts/fresh-database.mjs";
import { addFilter, addStaffAccount, changeFilter, logInAsStaff, recordAnswers, syncPoliticians } from "../steps";
import { BASE, expect, frame, story, test } from "./fixtures";
import { importEmails, PM_LETTER } from "./staff-steps";
import type { Section } from "./report/frames";

export const section: Section = { name: "Politicians", part: "Staff pages", order: 30 };

// The politicians from Airtable: every body, as the nightly sync copies them
// from the fixture Airtable (lib/server/fixtures/airtable-*.json), with their
// answers to the asks as staff recorded them (recordAnswers) and PauseAI's
// emails to them.

const copy = staffCopy.politician;

/** This flow's own staff address: flows run alongside each other, and share the outbox. */
const staffEmail = () => `pol-${test.info().testId.replace(/\W/g, "").slice(-8)}@pauseai.uk`;

async function logIn(page: Page, database: string, permissions: string[] = []) {
  addStaffAccount(database, staffEmail(), permissions);
  return logInAsStaff(page, BASE, staffEmail());
}

/** Opens a politician's page from the list of everyone, in office or not. */
async function openPolitician(page: Page, name: string) {
  await page.goto(`${BASE}/staff/politicians?status=any`);
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
}

test("A politician's page", async ({ page, request, flowDatabase }) => {
  story(
    "Staff open Polly Placeholder's page. It shows her markers, the notes kept on her in Airtable, her answers to the asks and the emails PauseAI has sent her.",
  );
  await syncPoliticians(request, BASE);
  recordAnswers(flowDatabase);
  await logIn(page, flowDatabase);
  await importEmails(page);
  await openPolitician(page, "Polly Placeholder");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Polly Placeholder");
  await expect(page.getByText(copy.importantTarget, { exact: true })).toBeVisible();
  await expect(page.getByText("Met at the example fair.")).toBeVisible();
  const asks = page.getByRole("region", { name: copy.statusesTitle });
  // ControlAI's campaign statement and her answer to the conference, as staff recorded them.
  await expect(asks.getByText(staffCopy.statuses.declined)).toBeVisible();
  await expect(asks.getByText(staffCopy.statuses.signed)).toBeVisible();
  // The conference's invitation, personalised, in her folded history.
  await expect(page.getByText(copy.personalised, { exact: false }).first()).toBeAttached();
  await frame(page, "Polly's page");
});

test("A politician's correspondence", async ({ page, request, flowDatabase }) => {
  story(
    "Polly has had PauseAI's emails and has answered one. Staff open her page, which lists each with who wrote and when.",
  );
  await syncPoliticians(request, BASE);
  recordAnswers(flowDatabase);
  await logIn(page, flowDatabase);
  await importEmails(page);
  const [polly] = runSql(flowDatabase, "SELECT id FROM notable_people WHERE airtable_id = 'recPlaceholder'");
  runSql(
    flowDatabase,
    `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, from_address, from_name, at, from_us, blob_key, size)
     SELECT id, 'policy@pauseai.uk', 'correspondence-reply', 'correspondence-thread', 'polly.placeholder.mp@parliament.uk', 'Polly Placeholder',
       coalesce(sent_at, created_at) + interval '1 hour', false, 'correspondence-reply', 1
     FROM letters WHERE notable_person_id = ${polly} AND kind = 'pauseai' ORDER BY id LIMIT 1`,
  );
  await openPolitician(page, "Polly Placeholder");
  const words = copy.correspondence;
  const correspondence = page.getByRole("region", { name: words.title });
  const threads = correspondence.getByRole("listitem");
  await expect(correspondence.getByText(words.noReply).first()).toBeVisible();
  const all = await threads.count();
  expect(all).toBeGreaterThan(1);
  await frame(page, "Her correspondence, her reply in bold");

  story(
    "Replies only, at the card's top right, leaves just the emails she really answered, and keeps the list in view.",
  );
  await correspondence.getByRole("link", { name: words.repliesOnly }).click();
  await expect(page).toHaveURL(/\?correspondence=replies#correspondence-title$/);
  await expect(threads).toHaveCount(1);
  await expect(correspondence.getByRole("link", { name: words.repliesOnly })).toHaveAttribute("aria-current", "page");
  await frame(page, "Replies only", { of: correspondence });

  story("All emails brings them all back.");
  await correspondence.getByRole("link", { name: words.allEmails }).click();
  await expect(threads).toHaveCount(all);

  story("At the top, the count of emails from her does the same, and pressed again it shows them all.");
  const fromThem = page.getByRole("link", { name: copy.band.emailsFromThem });
  await fromThem.click();
  await expect(threads).toHaveCount(1);
  await expect(fromThem).toHaveAttribute("aria-current", "true");
  await frame(page, "From the count of emails from her");
  await fromThem.click();
  await expect(threads).toHaveCount(all);

  story("The count of emails to her leads down to her correspondence, and the asks she agreed to, to her asks.");
  await page.getByRole("link", { name: copy.band.emailsToThem }).click();
  await expect(page).toHaveURL(/#correspondence-title$/);
  await expect(correspondence).toBeInViewport();
  await page
    .getByRole("link", { name: copy.band.asksAgreed(2) })
    .or(page.getByRole("link", { name: copy.band.asksAgreed(1) }))
    .click();
  await expect(page).toHaveURL(/#asks-title$/);
  await expect(page.getByRole("region", { name: copy.statusesTitle })).toBeInViewport();
  await frame(page, "Down to her asks", { window: true });
});

test("A note on a politician", async ({ page, request, flowDatabase }) => {
  story("Staff write a note on Polly's page, in the notes beside her correspondence.");
  await syncPoliticians(request, BASE);
  await logIn(page, flowDatabase);
  await openPolitician(page, "Polly Placeholder");
  const notes = page.getByRole("region", { name: staffCopy.notes.title, exact: true });
  await notes.getByRole("button", { name: staffCopy.notes.write }).click();
  const box = notes.getByRole("textbox", { name: staffCopy.notes.note });
  await box.fill("Her office says write to www.example.org/contact");
  // The card alone, as where focus leaves the window varies between runs.
  await frame(page, "The note, written", { of: notes });
  story(
    "Once added, the note is the newest in the card, and the web address in it is a link. Airtable's notes on her stay last.",
  );
  await notes.getByRole("button", { name: staffCopy.notes.add }).click();
  const note = notes.getByRole("listitem").filter({ hasText: "Her office says" });
  await expect(note.getByRole("link", { name: "www.example.org/contact" })).toHaveAttribute(
    "href",
    "https://www.example.org/contact",
  );
  // Airtable's notes stay as the last, the sync's to change.
  await expect(notes.getByRole("listitem").last()).toContainText("Met at the example fair.");
  await expect(notes.getByRole("listitem").last()).toContainText(copy.notes);
  await frame(page, "The note in Polly's notes", { of: notes });
});

test("An answer to a new ask", async ({ page, request, flowDatabase }) => {
  story(
    "Staff have added an ask of their own, a letter about a giant pause button. Polly has no answer to it yet, so it isn't among her asks.",
  );
  runSql(
    flowDatabase,
    `INSERT INTO asks (slug, title, kind, date, asked_by)
     VALUES ('giant-pause-button-oct-2026', 'Giant pause button', 'letter', '2026-10-29', '{pauseai}')`,
  );
  await syncPoliticians(request, BASE);
  await logIn(page, flowDatabase);
  await openPolitician(page, "Polly Placeholder");
  const asks = page.getByRole("region", { name: copy.statusesTitle });
  await expect(asks.getByRole("group", { name: "Giant pause button" })).toHaveCount(0);
  await frame(page, "Polly's asks");
  story("Add another answer, under her asks, lists the other asks staff can record an answer to.");
  await asks.getByRole("button", { name: copy.otherAsk }).click();
  const menu = page.getByRole("list", { name: copy.otherAsk });
  await expect(menu.getByRole("button", { name: "Giant pause button" })).toBeVisible();
  await frame(page, "The other asks", { window: true });
  story("Choosing one adds a row for it, like the others, with no answer yet. Staff note how they know her answer.");
  await menu.getByRole("button", { name: "Giant pause button" }).click();
  const row = asks.getByRole("group", { name: "Giant pause button" });
  await expect(row.locator("[class*=answer]")).toHaveText(new RegExp(`^${staffCopy.statuses.noAnswer}`));
  await row.getByLabel(copy.note).fill("Said yes on the phone");
  await frame(page, "The new row, with a note", { window: true });
  story("She signed it. Once saved, the answer and its note show like any other.");
  await row.getByRole("radio", { name: staffCopy.statuses.signed }).click();
  await row.getByRole("button", { name: copy.save }).click();
  await expect(row.locator("[class*=answer]")).toHaveText(new RegExp(`^${staffCopy.statuses.signed}`));
  await expect(row.getByText(/Said yes on the phone/)).toBeVisible();
  await frame(page, "The answer, saved");
});

test("Recording a no, then clearing it", async ({ page, request, flowDatabase }) => {
  story("Polly hasn't answered the letter to the Prime Minister, so it has no row among her asks.");
  await syncPoliticians(request, BASE);
  await logIn(page, flowDatabase);
  await openPolitician(page, "Polly Placeholder");
  const asks = page.getByRole("region", { name: copy.statusesTitle });
  await expect(asks.getByRole("group", { name: PM_LETTER })).toHaveCount(0);
  await frame(page, "Polly's asks");
  story("Her office says no. Staff add the letter from Add another answer, choose Declined and note how they know.");
  await asks.getByRole("button", { name: copy.otherAsk }).click();
  await page.getByRole("list", { name: copy.otherAsk }).getByRole("button", { name: PM_LETTER }).click();
  const row = asks.getByRole("group", { name: PM_LETTER });
  await row.getByRole("radio", { name: staffCopy.statuses.declined }).click();
  await row.getByLabel(copy.note).fill("Their office said no");
  await frame(page, "Declined, with a note", { window: true });
  story("Once saved, the answer shows with its note under it, and goes into her history.");
  await row.getByRole("button", { name: copy.save }).click();
  await expect(row.locator("[class*=answer]")).toHaveText(new RegExp(`^${staffCopy.statuses.declined}`));
  await page.locator("summary", { hasText: copy.historyTitle }).click();
  const history = page.getByRole("list", { name: copy.historyTitle });
  await expect(history).toContainText(staffCopy.statuses.declined);
  await frame(page, "The letter, declined");

  story(
    "It was entered by mistake. Staff clear the answer, with a note saying why. The row goes, and her history says the answer was cleared.",
  );
  await row.getByText(copy.edit, { exact: true }).click();
  await row.getByRole("radio", { name: copy.clearAnswer }).click();
  await row.getByLabel(copy.note).fill("Entered by mistake");
  await row.getByRole("button", { name: copy.save }).click();
  await expect(asks.getByRole("group", { name: PM_LETTER })).toHaveCount(0);
  await expect(history).toContainText(copy.statusCleared.before);
  await expect(history).toContainText("Entered by mistake");
  await frame(page, "The answer, cleared", { of: history });
});

test("Peers, MSPs and former MPs", async ({ page, request, flowDatabase }) => {
  story(
    "Politicians come from every body, not only the Commons. Lord Seedling is a peer who signed the DeepMind letter.",
  );
  await syncPoliticians(request, BASE);
  recordAnswers(flowDatabase);
  await logIn(page, flowDatabase);
  await openPolitician(page, "Lord Seedling of Example");
  await expect(page.getByText(copy.role(copy.roles.lords, null, true), { exact: true })).toBeVisible();
  await frame(page, "Lord Seedling's page");

  story(
    "Morag Example is an MSP and a personal connection. She was invited to the Edinburgh conference, and is going.",
  );
  await openPolitician(page, "Morag Example");
  await expect(page.getByText(copy.personalConnection, { exact: true })).toBeVisible();
  await expect(page.getByText(`${copy.country}${staffCopy.countries.scotland}`)).toBeVisible();
  await frame(page, "Morag's page");

  story("Gordon Gone has left the Commons. He's kept, as a former MP.");
  await openPolitician(page, "Gordon Gone");
  await expect(page.getByText(copy.role(copy.roles.commons, "Former Seat", false), { exact: true })).toBeVisible();
  await frame(page, "Gordon's page");
});

test("Filtering politicians", async ({ page, request, flowDatabase }) => {
  story(
    "The politicians list starts with those in office. + Filter offers the rest of the filters, and each applies as soon as it's chosen.",
  );
  await syncPoliticians(request, BASE);
  recordAnswers(flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/politicians`);
  const filters = staffCopy.politicians;
  const rows = page.getByRole("row");
  // Those in office, to start; + Filter offers the rest, each applying as soon as it's chosen.
  await expect(rows.filter({ hasText: "Polly Placeholder" })).toBeVisible();
  await expect(rows.filter({ hasText: "Rita Retired" })).toHaveCount(0);
  await page.getByRole("button", { name: staffCopy.filters.add }).click();
  await frame(page, "The filters");
  story("Staff pick those who retired. The filter becomes a chip above the list.");
  await page.keyboard.press("Escape");
  await addFilter(page, filters.status, staffCopy.personStatuses.retired);
  await expect(page).toHaveURL(/status=retired/);
  await expect(rows.filter({ hasText: "Rita Retired" })).toBeVisible();
  await expect(rows.filter({ hasText: "Polly Placeholder" })).toHaveCount(0);
  await frame(page, "The politicians who retired");

  story("They take that filter off, and filter by a marker: personal connections.");
  await changeFilter(page, `${filters.status}: ${staffCopy.personStatuses.retired}`);
  await expect(page).toHaveURL(`${BASE}/staff/politicians`);
  await addFilter(page, filters.flag, filters.flags.connection);
  await expect(page).toHaveURL(/flag=connection/);
  await expect(rows.filter({ hasText: "Morag Example" })).toBeVisible();
  await expect(rows).toHaveCount(2);
  await frame(page, "The personal connections");

  story("Except this, in the chip's menu, turns it round: everyone but the personal connections.");
  // A chip's menu turns its choice to one the list leaves out.
  await changeFilter(page, `${filters.flag}: ${filters.flags.connection}`, staffCopy.filters.exceptThis);
  await expect(page).toHaveURL(/flag=%21connection/);
  await expect(rows.filter({ hasText: "Morag Example" })).toHaveCount(0);
  await expect(rows.filter({ hasText: "Polly Placeholder" })).toBeVisible();
  await frame(page, "Everyone but the personal connections");

  story("Next, an ask: the Edinburgh conference. Its chip has a second half, for the answer.");
  await changeFilter(page, staffCopy.filters.notChip(filters.flag, filters.flags.connection));
  await expect(page).toHaveURL(`${BASE}/staff/politicians`);
  await addFilter(page, filters.ask, "Edinburgh conference");
  await expect(page).toHaveURL(/ask=edinburgh-conference-2026$/);
  await frame(page, "The Edinburgh conference's chip");
  story("Staff choose those with no answer yet. Clear filters then brings back the whole list.");
  // The answer is chosen in the second half of the ask's chip.
  await changeFilter(page, filters.anyAnswer, filters.noAnswer);
  await expect(page).toHaveURL(/ask=edinburgh-conference-2026&answer=none/);
  await expect(rows.filter({ hasText: "Polly Placeholder" })).toHaveCount(0);
  await expect(rows.filter({ hasText: "Ms Dora Dummy" })).toBeVisible();
  await frame(page, "No answer to the conference yet");

  await page.getByRole("link", { name: staffCopy.resetFilters }).click();
  await expect(page).toHaveURL(`${BASE}/staff/politicians`);
  await expect(rows.filter({ hasText: "Polly Placeholder" })).toBeVisible();
});

test("Several answers to an ask", { tag: "@phone" }, async ({ page, request, flowDatabase }) => {
  story("Staff want those going to the Edinburgh conference or who haven't answered, for a reminder.");
  await syncPoliticians(request, BASE);
  recordAnswers(flowDatabase);
  await logIn(page, flowDatabase);
  const filters = staffCopy.politicians;
  const rows = page.getByRole("row");
  await page.goto(`${BASE}/staff/politicians?ask=edinburgh-conference-2026`);
  await page.getByRole("button", { name: filters.anyAnswer }).click();
  const menu = page.locator("[popover]:popover-open");
  await frame(page, "The answers, a row each");

  story("+ Add turns the rows to boxes. Any answer isn't one of them: it's what ticking none means.");
  await menu.getByRole("button", { name: staffCopy.filters.addChoice }).click();
  await frame(page, "Boxes, with Any answer gone");

  story("Each tick changes the list at once, with the menu open. The chip's second half says both.");
  await menu.getByRole("checkbox", { name: staffCopy.statuses.going, exact: true }).check();
  await expect(page).toHaveURL(/answer=going$/);
  await menu.getByRole("checkbox", { name: filters.noAnswer }).check();
  await expect(page).toHaveURL(/answer=going&answer=none/);
  await expect(rows.filter({ hasText: "Ms Dora Dummy" })).toBeVisible();
  const both = staffCopy.filters.anyOf([staffCopy.statuses.going, filters.noAnswer]);
  await expect(page.getByRole("button", { name: both })).toBeVisible();
  await frame(page, "Those going, or who haven't answered, the menu still open");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await frame(page, "Those going, or who haven't answered");

  story("A download keeps both answers, and says so in its name.");
  const download = await page.request.get(
    `${BASE}/staff/politicians/download?format=json&ask=edinburgh-conference-2026&answer=going&answer=none`,
  );
  expect(download.headers()["content-disposition"]).toContain("or");

  story("Choosing another ask clears the answers, as they might not be its answers.");
  await page.getByRole("button", { name: "Edinburgh conference" }).click();
  await menu.getByRole("link").filter({ hasNotText: "Edinburgh conference" }).first().click();
  await expect(page).not.toHaveURL(/answer=/);
  await expect(page.getByRole("button", { name: filters.anyAnswer })).toBeVisible();
  await frame(page, "Another ask, any answer");
});

test("The house tabs", async ({ page, request, flowDatabase }) => {
  story(
    "Staff look at every politician, in office or not, then pick a house from the tabs. The filters they chose stay.",
  );
  await syncPoliticians(request, BASE);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/politicians?status=any`);
  const houses = page.getByRole("navigation", { name: staffCopy.fields.house });
  const rows = page.getByRole("row");
  await expect(houses.getByRole("link", { name: staffCopy.politicians.allHouses })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await frame(page, "Every house");

  story("In the Commons tab every row is an MP, so there's no column for the house.");
  await houses.getByRole("link", { name: staffCopy.houses.commons }).click();
  await expect(page).toHaveURL(/house=commons&status=any/);
  await expect(rows.filter({ hasText: "Gordon Gone" })).toBeVisible();
  await expect(rows.filter({ hasText: "Morag Example" })).toHaveCount(0);
  // Every row is in the Commons, so there's no column saying so.
  await expect(page.getByRole("columnheader", { name: staffCopy.fields.house })).toHaveCount(0);
  await frame(page, "The Commons");

  await houses.getByRole("link", { name: staffCopy.houses["scottish-parliament"] }).click();
  await expect(rows.filter({ hasText: "Morag Example" })).toBeVisible();
  await expect(rows).toHaveCount(2);
  await frame(page, "The Scottish Parliament");
});

test("Pages of politicians, and Download", async ({ page, flowDatabase }) => {
  story("With 250 MPs, the list says how many there are and which are shown, a hundred to a page.");
  // 250 made-up MPs, the test MPs left out: three pages.
  runSql(
    flowDatabase,
    `WITH n AS (
       INSERT INTO notable_people (kind, name, salutation, status)
       SELECT 'politician', 'Example Member ' || lpad(i::text, 3, '0'), '', 'in_office' FROM generate_series(1, 250) i
       RETURNING id
     ) INSERT INTO politicians (id, house, constituency, party)
       SELECT id, 'commons', 'Exampleton ' || id, (ARRAY['Labour', 'Conservative', 'Green'])[1 + id % 3] FROM n`,
  );
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/politicians?status=any`);
  const copy = staffCopy.politicians;
  await expect(page.getByText(copy.total(250))).toBeVisible();
  await frame(page, "The politicians list");
  story("Download gets every one of them, not only this page, as a spreadsheet, JSON or vCards for WhatsApp.");
  await page.getByRole("button", { name: staffCopy.lists.download }).click();
  const csv = page.getByRole("link", { name: staffCopy.lists.formats.csv });
  await expect(csv).toHaveAttribute("href", "/staff/politicians/download?status=any&format=csv");
  await frame(page, "Download's menu");
  // Every page of them, a line each under the headings.
  const file = await page.request.get(`${BASE}/staff/politicians/download?status=any&format=csv`);
  expect((await file.text()).trim().split("\r\n")).toHaveLength(251);
  story("At the foot of the list are the links to the other pages.");
  await page.keyboard.press("Escape");
  const pages = page.getByRole("navigation", { name: staffCopy.paging.label });
  await pages.scrollIntoViewIfNeeded();
  await frame(page, "The first page's foot");

  await pages.getByRole("link", { name: staffCopy.paging.next }).click();
  await expect(page).toHaveURL(/status=any&page=2/);
  await expect(page.getByText(staffCopy.paging.range(101, 200, 250))).toBeVisible();
  await frame(page, "The second page");

  story("The last page has no Next. Picking another house starts again from the first page.");
  // On to the last: by its number, or on a phone, where the numbers give way to "Page 2 of 3", by Next.
  const last = page.getByRole("navigation", { name: staffCopy.paging.label }).getByRole("link", {
    name: staffCopy.paging.page(3),
  });
  await ((await last.isVisible()) ? last : pages.getByRole("link", { name: staffCopy.paging.next })).click();
  await expect(page).toHaveURL(/status=any&page=3/);
  await expect(page.getByText(staffCopy.paging.range(201, 250, 250))).toBeVisible();
  await frame(page, "The last page");

  // Another house starts from the first page.
  await page
    .getByRole("navigation", { name: staffCopy.fields.house })
    .getByRole("link", { name: staffCopy.houses.lords })
    .click();
  await expect(page).toHaveURL(`${BASE}/staff/politicians?house=lords&status=any`);
});

test("Searching politicians", async ({ page, request, flowDatabase }) => {
  story('A search can mix words from a name and a constituency. "Pol Westminster" finds Polly.');
  await syncPoliticians(request, BASE);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/politicians`);
  const copy = staffCopy.politicians;
  const rows = page.getByRole("row");
  const search = async (text: string) => {
    await page.getByRole("searchbox").fill(text);
    await page.getByRole("button", { name: staffCopy.search }).click();
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(text).replace(/%20/g, "\\+")}`));
  };
  await search("Pol Westminster");
  await expect(rows.filter({ hasText: "Polly Placeholder" })).toBeVisible();
  await expect(rows).toHaveCount(2);
  await frame(page, "The search for Polly");

  story(
    "No one in office is an Independent. The page says two politicians who left office match, and one click shows them.",
  );
  await search("Independent");
  await expect(page.getByText(copy.none)).toBeVisible();
  await page.getByRole("link", { name: copy.outOfOffice(2) }).click();
  await expect(page).toHaveURL(/q=Independent&status=any/);
  await expect(rows.filter({ hasText: "Rita Retired" })).toBeVisible();
  await expect(rows.filter({ hasText: "Gordon Gone" })).toBeVisible();
  await frame(page, "Independents not in office");

  await page.goto(`${BASE}/staff/politicians`);
  story("A misspelt name matches no one exactly, so the closest names are offered.");
  await search("Dorra Dumy");
  await expect(page.getByText(copy.closest)).toBeVisible();
  await expect(rows.filter({ hasText: "Ms Dora Dummy" })).toBeVisible();
  await frame(page, "Close matches");

  await page.goto(`${BASE}/staff/politicians?house=lords`);
  story("No one in the Lords is called Morag. One politician in another house is, and one click shows her.");
  await search("Morag");
  await expect(page.getByText(copy.none)).toBeVisible();
  await page.getByRole("link", { name: copy.otherHouses(1) }).click();
  await expect(page).toHaveURL(/q=Morag$/);
  await expect(rows.filter({ hasText: "Morag Example" })).toBeVisible();
  await frame(page, "Morag, from another house");

  await page.goto(`${BASE}/staff/politicians`);
  story("Test politicians are left out of a search, but the page says one matches, and one click shows them.");
  await search("Testy McTestface");
  await page.getByRole("link", { name: copy.tests(1) }).click();
  await expect(page).toHaveURL(/q=Testy\+McTestface&flag=test$/);
  await expect(rows.filter({ hasText: "Testy McTestface MP" })).toBeVisible();
  await frame(page, "The test MP");
});

test("Deleting a politician", async ({ page, request, flowDatabase }) => {
  story("Rita Retired is gone from Airtable, so staff can delete her. Anyone still in Airtable has no Delete button.");
  await syncPoliticians(request, BASE);
  runSql(flowDatabase, "UPDATE notable_people SET airtable_removed_at = now() WHERE name = 'Rita Retired'");
  await logIn(page, flowDatabase);
  // Anyone still in Airtable can't be.
  await openPolitician(page, "Polly Placeholder");
  await expect(page.getByRole("button", { name: copy.delete.button, exact: true })).toHaveCount(0);

  await openPolitician(page, "Rita Retired");
  await page.getByRole("button", { name: copy.delete.button, exact: true }).scrollIntoViewIfNeeded();
  await frame(page, "The foot of Rita's page");

  story("Delete asks to be pressed a second time.");
  await page.getByRole("button", { name: copy.delete.button, exact: true }).click();
  await expect(page.getByRole("button", { name: staffCopy.deleteIt })).toBeFocused();
  await frame(page, "Delete, pressed once", { window: true });
  story("Pressed again, she's deleted, and gone from the list of everyone.");

  await page.getByRole("button", { name: staffCopy.deleteIt }).click();
  await expect(page).toHaveURL(`${BASE}/staff/politicians`);
  await page.goto(`${BASE}/staff/politicians?status=any`);
  await expect(page.getByRole("link", { name: "Rita Retired" })).toHaveCount(0);
  await frame(page, "The politicians list, without Rita");
});

test("Who has been mailed", async ({ page, request, flowDatabase }) => {
  story("Staff filter the politicians list by who was mailed about the Edinburgh conference.");
  await syncPoliticians(request, BASE);
  await logIn(page, flowDatabase);
  await importEmails(page);
  await page.goto(`${BASE}/staff/politicians?mailed=edinburgh-conference-2026`);
  await expect(page.getByRole("row").filter({ hasText: "Polly Placeholder" })).toBeVisible();
  await frame(page, "Mailed about the conference");
  story("With Except, the list is those not mailed yet: the ones to mail next.");
  await page.goto(`${BASE}/staff/politicians?mailed=!edinburgh-conference-2026`);
  await expect(page.getByRole("row").filter({ hasText: "Polly Placeholder" })).toHaveCount(0);
  await frame(page, "Not mailed about the conference");
});
