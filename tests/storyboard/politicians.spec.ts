import type { Page } from "@playwright/test";
import { staffCopy } from "@/lib/content/staff-interface";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { runSql } from "@/scripts/fresh-database.mjs";
import { connectPolicyMailboxes } from "./gmail-steps";
import { addFilter, changeFilter } from "./list-steps";
import { addStaffAccount, logInAsStaff } from "./login-steps";
import { addPauseaiEmails, importPoliticians, PM_LETTER, recordAnswers } from "./politician-steps";
import { BASE, expect, frame, story, test } from "./fixtures";
import { POLLY_PERSONAL } from "@/lib/server/fixtures/policy-mailbox";
import { importPath } from "@/lib/import-runs";
import type { Section } from "./report/frames";

export const section: Section = { name: "Politicians", part: "Staff pages", order: 30 };

// The politicians of every body, as the nightly imports read them from the
// bodies' fixture lists (lib/server/fixtures/politician-lists.ts), with what
// the copy from the fixture Airtable adds, their answers to the asks as staff
// recorded them (recordAnswers) and PauseAI's emails to them.

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

/**
 * From a politician's page, back to the list by the trail, then sorted by
 * one of its headings. Gives the first row, and its cell under a heading.
 */
async function listSortedBy(page: Page, heading: string, sorted: RegExp) {
  await page
    .getByRole("navigation", { name: staffVocabulary.breadcrumb })
    .getByRole("link", { name: staffCopy.nav.politicians })
    .click();
  await expect(page).toHaveURL(`${BASE}/staff/politicians`);
  // The heading's link, not a count at the top of the politician's page, which can have the same words.
  await page.getByRole("columnheader", { name: heading }).getByRole("link").click();
  await expect(page).toHaveURL(sorted);
  const first = page.getByRole("row").nth(1);
  const headings = await page.getByRole("columnheader").allInnerTexts();
  const under = (name: string) => first.getByRole("cell").nth(headings.findIndex((text) => text.startsWith(name)));
  return { first, under };
}

test("A politician's page", async ({ page, request, flowDatabase }) => {
  story(
    "Staff open Polly Placeholder's page. It shows her markers, the notes kept on her in Airtable, her answers to the asks and the emails PauseAI has sent her.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  recordAnswers(flowDatabase);
  await logIn(page, flowDatabase);
  addPauseaiEmails(flowDatabase);
  await openPolitician(page, "Polly Placeholder");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Polly Placeholder");
  await expect(page.getByText(copy.importantTarget, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: staffCopy.notes.title }).getByText("Met at the example fair."),
  ).toBeVisible();
  const asks = page.getByRole("region", { name: copy.statusesTitle });
  // ControlAI's campaign statement and her answer to the conference, as staff recorded them.
  const answer = (ask: RegExp) => asks.getByRole("group", { name: ask }).locator("[class*=answer]");
  await expect(answer(/^Edinburgh/)).toHaveText(new RegExp(`^${staffVocabulary.statuses.declined}`));
  await expect(answer(/^ControlAI's campaign statement/)).toHaveText(new RegExp(`^${staffVocabulary.statuses.signed}`));
  // The conference's invitation, personalised, in her folded history.
  await expect(page.getByText(copy.personalised, { exact: false }).first()).toBeAttached();
  await frame(page, "Polly's page");
});

test("A politician's correspondence", async ({ page, request, flowDatabase }) => {
  story(
    "Polly has had PauseAI's emails and has answered one. Staff open her page, which lists each with who wrote and when.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  recordAnswers(flowDatabase);
  await logIn(page, flowDatabase);
  addPauseaiEmails(flowDatabase);
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

  story("Correspondence brings them all back.");
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

  story(
    "The politicians list has the same two counts for everyone. Staff sort it by Emails from them, which puts Polly first, with the numbers at the top of her page.",
  );
  const counted = async (label: string) =>
    Number.parseInt(await page.getByRole("link", { name: label }).innerText(), 10);
  const onHerPage = [await counted(copy.band.emailsToThem), await counted(copy.band.emailsFromThem)];
  expect(onHerPage[1]).toBe(1);
  const { columns } = staffCopy.politicians;
  const { first, under } = await listSortedBy(page, columns.emailsFromThem, /sort=emailsFromThem&dir=desc/);
  await expect(first.getByRole("link", { name: "Polly Placeholder", exact: true })).toBeVisible();
  await expect(under(columns.emailsToThem)).toHaveText(String(onHerPage[0]));
  await expect(under(columns.emailsFromThem)).toHaveText(String(onHerPage[1]));
  await frame(page, "The list, by emails from them");
});

test("A note on a politician", async ({ page, request, flowDatabase }) => {
  story("Staff write a note on Polly's page, in the notes beside her correspondence.");
  await importPoliticians(request, BASE, flowDatabase);
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
  // Airtable's notes are a note of their own, written by Airtable, the oldest.
  await expect(notes.getByRole("listitem").last()).toContainText("Met at the example fair.");
  await expect(notes.getByRole("listitem").last()).toContainText("Airtable");
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
  await importPoliticians(request, BASE, flowDatabase);
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
  await expect(row.locator("[class*=answer]")).toHaveText(new RegExp(`^${staffVocabulary.statuses.noAnswer}`));
  await row.getByLabel(copy.note).fill("Said yes on the phone");
  await frame(page, "The new row, with a note", { window: true });
  story("She signed it. Once saved, the answer and its note show like any other.");
  await row.getByRole("radio", { name: staffVocabulary.statuses.signed }).click();
  await row.getByRole("button", { name: copy.save }).click();
  await expect(row.locator("[class*=answer]")).toHaveText(new RegExp(`^${staffVocabulary.statuses.signed}`));
  await expect(row.getByText(/Said yes on the phone/)).toBeVisible();
  await frame(page, "The answer, saved");
});

test("Recording a no, then clearing it", async ({ page, request, flowDatabase }) => {
  story("Polly hasn't answered the letter to the Prime Minister, so it has no row among her asks.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  await openPolitician(page, "Polly Placeholder");
  const asks = page.getByRole("region", { name: copy.statusesTitle });
  await expect(asks.getByRole("group", { name: PM_LETTER })).toHaveCount(0);
  await frame(page, "Polly's asks");
  story("Her office says no. Staff add the letter from Add another answer, choose Declined and note how they know.");
  await asks.getByRole("button", { name: copy.otherAsk }).click();
  await page.getByRole("list", { name: copy.otherAsk }).getByRole("button", { name: PM_LETTER }).click();
  const row = asks.getByRole("group", { name: PM_LETTER });
  await row.getByRole("radio", { name: staffVocabulary.statuses.declined }).click();
  await row.getByLabel(copy.note).fill("Their office said no");
  await frame(page, "Declined, with a note", { window: true });
  story("Once saved, the answer shows with its note under it, and goes into her history.");
  await row.getByRole("button", { name: copy.save }).click();
  await expect(row.locator("[class*=answer]")).toHaveText(new RegExp(`^${staffVocabulary.statuses.declined}`));
  await page.locator("summary", { hasText: copy.historyTitle }).click();
  const history = page.getByRole("list", { name: copy.historyTitle });
  await expect(history).toContainText(staffVocabulary.statuses.declined);
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
  await importPoliticians(request, BASE, flowDatabase);
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
  await expect(page.getByText(`${copy.country}${staffVocabulary.countries.scotland}`)).toBeVisible();
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
  await importPoliticians(request, BASE, flowDatabase);
  recordAnswers(flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/politicians`);
  const filters = staffCopy.politicians;
  const rows = page.getByRole("row");
  // Those in office, to start; + Filter offers the rest, each applying as soon as it's chosen.
  await expect(rows.filter({ hasText: "Polly Placeholder" })).toBeVisible();
  await expect(rows.filter({ hasText: "Rita Retired" })).toHaveCount(0);
  await page.getByRole("button", { name: staffVocabulary.filters.add }).click();
  await frame(page, "The filters");
  story("Staff pick those who retired. The filter becomes a chip above the list.");
  await page.keyboard.press("Escape");
  await addFilter(page, filters.status, staffVocabulary.personStatuses.retired);
  await expect(page).toHaveURL(/status=retired/);
  await expect(rows.filter({ hasText: "Rita Retired" })).toBeVisible();
  await expect(rows.filter({ hasText: "Polly Placeholder" })).toHaveCount(0);
  await frame(page, "The politicians who retired");

  story("They take that filter off, and filter by a marker: personal connections.");
  await changeFilter(page, `${filters.status}: ${staffVocabulary.personStatuses.retired}`);
  await expect(page).toHaveURL(`${BASE}/staff/politicians`);
  await addFilter(page, filters.flag, filters.flags.connection);
  await expect(page).toHaveURL(/flag=connection/);
  await expect(rows.filter({ hasText: "Morag Example" })).toBeVisible();
  await expect(rows).toHaveCount(2);
  await frame(page, "The personal connections");

  story("Except this, in the chip's menu, turns it round: everyone but the personal connections.");
  // A chip's menu turns its choice to one the list leaves out.
  await changeFilter(page, `${filters.flag}: ${filters.flags.connection}`, staffVocabulary.filters.exceptThis);
  await expect(page).toHaveURL(/flag=%21connection/);
  await expect(rows.filter({ hasText: "Morag Example" })).toHaveCount(0);
  await expect(rows.filter({ hasText: "Polly Placeholder" })).toBeVisible();
  await frame(page, "Everyone but the personal connections");

  story("Next, an ask: the Edinburgh conference. Its chip has a second half, for the answer.");
  await changeFilter(page, staffVocabulary.filters.notChip(filters.flag, filters.flags.connection));
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

  await page.getByRole("link", { name: staffVocabulary.resetFilters }).click();
  await expect(page).toHaveURL(`${BASE}/staff/politicians`);
  await expect(rows.filter({ hasText: "Polly Placeholder" })).toBeVisible();
});

test("Several answers to an ask", { tag: "@phone" }, async ({ page, request, flowDatabase }) => {
  story("Staff want those going to the Edinburgh conference or who haven't answered, for a reminder.");
  await importPoliticians(request, BASE, flowDatabase);
  recordAnswers(flowDatabase);
  await logIn(page, flowDatabase);
  const filters = staffCopy.politicians;
  const rows = page.getByRole("row");
  await page.goto(`${BASE}/staff/politicians?ask=edinburgh-conference-2026`);
  await page.getByRole("button", { name: filters.anyAnswer }).click();
  const menu = page.locator("[popover]:popover-open");
  await frame(page, "The answers, a row each");

  story("+ Add turns the rows to boxes. Any answer isn't one of them: it's what ticking none means.");
  await menu.getByRole("button", { name: staffVocabulary.filters.addChoice }).click();
  await frame(page, "Boxes, with Any answer gone");

  story("Each tick changes the list at once, with the menu open. The chip's second half says both.");
  await menu.getByRole("checkbox", { name: staffVocabulary.statuses.going, exact: true }).check();
  await expect(page).toHaveURL(/answer=going$/);
  await menu.getByRole("checkbox", { name: filters.noAnswer }).check();
  await expect(page).toHaveURL(/answer=going&answer=none/);
  await expect(rows.filter({ hasText: "Ms Dora Dummy" })).toBeVisible();
  const both = staffVocabulary.filters.anyOf([staffVocabulary.statuses.going, filters.noAnswer]);
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
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/politicians?status=any`);
  const houses = page.getByRole("navigation", { name: staffVocabulary.fields.house });
  const rows = page.getByRole("row");
  await expect(houses.getByRole("link", { name: staffCopy.politicians.allHouses })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await frame(page, "Every house");

  story("In the Commons tab every row is an MP, so there's no column for the house.");
  await houses.getByRole("link", { name: staffVocabulary.houses.commons }).click();
  await expect(page).toHaveURL(/house=commons&status=any/);
  await expect(rows.filter({ hasText: "Gordon Gone" })).toBeVisible();
  await expect(rows.filter({ hasText: "Morag Example" })).toHaveCount(0);
  // Every row is in the Commons, so there's no column saying so.
  await expect(page.getByRole("columnheader", { name: staffVocabulary.fields.house })).toHaveCount(0);
  await frame(page, "The Commons");

  await houses.getByRole("link", { name: staffVocabulary.houses["scottish-parliament"] }).click();
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
  await page.getByRole("button", { name: staffVocabulary.lists.download }).click();
  const csv = page.getByRole("link", { name: staffVocabulary.lists.formats.csv });
  await expect(csv).toHaveAttribute("href", "/staff/politicians/download?status=any&format=csv");
  await frame(page, "Download's menu");
  // Every page of them, a line each under the headings.
  const file = await page.request.get(`${BASE}/staff/politicians/download?status=any&format=csv`);
  expect((await file.text()).trim().split("\r\n")).toHaveLength(251);
  story("At the foot of the list are the links to the other pages.");
  await page.keyboard.press("Escape");
  const pages = page.getByRole("navigation", { name: staffVocabulary.paging.label });
  await pages.scrollIntoViewIfNeeded();
  await frame(page, "The first page's foot");

  await pages.getByRole("link", { name: staffVocabulary.paging.next }).click();
  await expect(page).toHaveURL(/status=any&page=2/);
  await expect(page.getByText(staffVocabulary.paging.range(101, 200, 250))).toBeVisible();
  await frame(page, "The second page");

  story("The last page has no Next. Picking another house starts again from the first page.");
  // On to the last: by its number, or on a phone, where the numbers give way to "Page 2 of 3", by Next.
  const last = page.getByRole("navigation", { name: staffVocabulary.paging.label }).getByRole("link", {
    name: staffVocabulary.paging.page(3),
  });
  await ((await last.isVisible()) ? last : pages.getByRole("link", { name: staffVocabulary.paging.next })).click();
  await expect(page).toHaveURL(/status=any&page=3/);
  await expect(page.getByText(staffVocabulary.paging.range(201, 250, 250))).toBeVisible();
  await frame(page, "The last page");

  // Another house starts from the first page.
  await page
    .getByRole("navigation", { name: staffVocabulary.fields.house })
    .getByRole("link", { name: staffVocabulary.houses.lords })
    .click();
  await expect(page).toHaveURL(`${BASE}/staff/politicians?house=lords&status=any`);
});

test("Searching politicians", async ({ page, request, flowDatabase }) => {
  story('A search can mix words from a name and a constituency. "Pol Westminster" finds Polly.');
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/politicians`);
  const copy = staffCopy.politicians;
  const rows = page.getByRole("row");
  const search = async (text: string) => {
    await page.getByRole("searchbox").fill(text);
    await page.getByRole("button", { name: staffVocabulary.search }).click();
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

test("Who has been mailed", async ({ page, request, flowDatabase }) => {
  story("Staff filter the politicians list by who was mailed about the Edinburgh conference.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  addPauseaiEmails(flowDatabase);
  await page.goto(`${BASE}/staff/politicians?mailed=edinburgh-conference-2026`);
  await expect(page.getByRole("row").filter({ hasText: "Polly Placeholder" })).toBeVisible();
  await frame(page, "Mailed about the conference");
  story("With Except, the list is those not mailed yet: the ones to mail next.");
  await page.goto(`${BASE}/staff/politicians?mailed=!edinburgh-conference-2026`);
  await expect(page.getByRole("row").filter({ hasText: "Polly Placeholder" })).toHaveCount(0);
  await frame(page, "Not mailed about the conference");
});

test("PauseAI's email to a politician", async ({ page, request, flowDatabase }) => {
  story("Each email PauseAI sent a politician is in their history, and has its own page under its mailing.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  addPauseaiEmails(flowDatabase);
  await openPolitician(page, "Polly Placeholder");
  await page.locator("summary", { hasText: copy.historyTitle }).click();
  const history = page.getByRole("list", { name: copy.historyTitle });
  await history.getByRole("link", { name: staffCopy.mailingPages.theLetter }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    staffCopy.letters.oneTitle(staffCopy.letters.fromPauseai, "Polly Placeholder"),
  );
  await expect(page).toHaveURL(/\/staff\/mailings\/\d+\/letters\/\d+$/);
  await frame(page, "PauseAI's email to Polly");
  story(
    "Copy Gmail search copies a search for it by Polly's address and when it went. Airtable didn't say which mailbox sent it, so the page says to look in one that did.",
  );
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: staffCopy.findInGmail.copy }).click();
  await expect(page.getByRole("status")).toContainText(staffCopy.findInGmail.whereUnknown);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^to:polly\S+ after:\d+ before:\d+$/);
  await frame(page, "The search, copied");
});

test("A politician's own address", async ({ page, request, flowDatabase }) => {
  story(
    "Polly wrote to policy@ from her own Gmail, which is on no list, so her email matched no one. Staff press the “more” after her email at the top of her page, which opens her other addresses.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  connectPolicyMailboxes(flowDatabase);
  await logIn(page, flowDatabase, ["supporters", "admin"]);
  const [polly] = runSql(flowDatabase, "SELECT id FROM notable_people WHERE airtable_id = 'recPlaceholder'");
  await page.goto(`${BASE}/staff/politicians/${polly}`);
  const aliases = copy.aliases;
  await page.getByRole("button", { name: /^\+\d+ more$/ }).click();
  const bubble = page.locator("[popover]:popover-open");
  await expect(bubble.getByRole("heading", { name: aliases.title })).toBeVisible();
  await frame(page, "Her other addresses", { window: true });

  story("Staff add her Gmail. It appears at the foot of the list, and pulses once.");
  await bubble.getByLabel(aliases.address).fill(POLLY_PERSONAL);
  await bubble.getByRole("button", { name: aliases.add }).click();
  await expect(bubble.getByText(POLLY_PERSONAL)).toBeVisible();
  await frame(page, "Her Gmail added", { window: true });

  story("The next read of Gmail searches policy@ for her Gmail, and says so. Her email is kept, and shows under her.");
  await page.goto(`${BASE}${importPath("read-gmail")}`);
  await page.getByRole("button", { name: staffCopy.gmailReading.readNow }).click();
  const read = staffCopy.gmailReading.searched({ searched: 1, kept: 0, waiting: 0 }).split(",")[0];
  await expect(page.getByText(read, { exact: false }).first()).toBeVisible();
  await frame(page, "The read of Gmail, having searched for it");
  await page.goto(`${BASE}/staff/politicians/${polly}`);
  await expect(page.getByRole("link", { name: "From my own address" })).toBeVisible();
  await frame(page, "Her email from it, under her");

  story(
    "That email is all we've had to do with her. On the politicians list it's her one email from them, and the day of her first and last activity, so sorting by Last activity puts her first.",
  );
  const { columns } = staffCopy.politicians;
  const { first, under } = await listSortedBy(page, columns.last, /sort=active&dir=desc/);
  await expect(first.getByRole("link", { name: "Polly Placeholder", exact: true })).toBeVisible();
  await expect(under(columns.emailsFromThem)).toHaveText("1");
  await expect(under(columns.first)).toHaveText(/\d{4}$/);
  await expect(under(columns.last)).toHaveText(await under(columns.first).innerText());
  await frame(page, "The list, by last activity");
});

test("Marking a politician", async ({ page, request, flowDatabase }) => {
  story(
    "Polly Placeholder is an important target: its switch is on in the Marks card, under her notes. Staff switch Personal connection on, and Important target off.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  await openPolitician(page, "Polly Placeholder");
  const important = page.getByRole("switch", { name: copy.importantTarget });
  const connection = page.getByRole("switch", { name: copy.personalConnection });
  await expect(important).toHaveAttribute("aria-checked", "true");
  await expect(connection).toHaveAttribute("aria-checked", "false");
  await page.getByRole("heading", { name: copy.marks }).scrollIntoViewIfNeeded();
  await frame(page, "Her marks, an important target");
  await connection.click();
  await expect(connection).toHaveAttribute("aria-checked", "true");
  await important.click();
  await expect(important).toHaveAttribute("aria-checked", "false");
  await frame(page, "Her marks, a personal connection");

  story("What changed her record, folded at the foot of her page, says who changed each marker.");
  await page.getByRole("heading", { name: copy.recordTitle }).click();
  const record = page.locator("details").filter({ has: page.getByRole("heading", { name: copy.recordTitle }) });
  await expect(record.getByText(staffEmail(), { exact: false }).first()).toBeVisible();
  await page.getByRole("heading", { name: copy.recordTitle }).scrollIntoViewIfNeeded();
  await frame(page, "The record of changes");
});

test("Writing to a Lord", async ({ page, request, flowDatabase }) => {
  story(
    "Lord Seedling lists only the House of Lords' shared inbox, so he has no email. Staff find his own address, and press “add email” by his email at the top of his page.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  await openPolitician(page, "Lord Seedling of Example");
  const words = copy.editDetails;
  await page.getByRole("button", { name: words.add }).click();
  const bubble = page.locator("[popover]:popover-open");
  await expect(bubble.getByText(words.emailHint)).toBeVisible();
  await bubble.getByRole("textbox", { name: words.email }).fill("seedling@lords.example");
  await frame(page, "His new address", { window: true });

  story("They save it. The bubble closes, and the band shows his address.");
  await bubble.getByRole("button", { name: words.save }).click();
  await expect(page.getByRole("link", { name: "seedling@lords.example" }).first()).toBeVisible();
  await frame(page, "His page, with his address");

  story("An MP's address is their body's, so her bubble lists her other addresses, with no field for her email.");
  await openPolitician(page, "Polly Placeholder");
  await page.getByRole("button", { name: /^\+\d+ more$/ }).click();
  await expect(page.locator("[popover]:popover-open").getByRole("heading", { name: copy.aliases.title })).toBeVisible();
  await expect(page.locator("[popover]:popover-open").getByRole("textbox", { name: words.email })).toHaveCount(0);
  await frame(page, "An MP's other addresses", { window: true });
});

test("A salutation to check", async ({ page, request, flowDatabase }) => {
  story(
    "Wikidata was down when the Senedd's import added Gwen Example, so it didn't know her gender, and her salutation, under her email in the band, is her name.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  runSql(
    flowDatabase,
    "UPDATE notable_people SET salutation = name, salutation_to_check = true WHERE name = 'Gwen Example'",
  );
  await logIn(page, flowDatabase);
  await openPolitician(page, "Gwen Example");
  const words = copy.editDetails;
  await expect(page.getByText(words.dear("Gwen Example"))).toBeVisible();
  await frame(page, "Her salutation, made from her name");

  story(
    "Staff press edit by it. Its bubble says it's just her name, and offers Ms Example and Mr Example. They press Ms Example.",
  );
  await page.getByRole("button", { name: words.edit }).click();
  const bubble = page.locator("[popover]:popover-open");
  await expect(bubble.getByText(words.fromName)).toBeVisible();
  await expect(bubble.getByRole("button", { name: "Ms Example" })).toBeVisible();
  await frame(page, "The salutations it most likely is", { window: true });
  await bubble.getByRole("button", { name: "Ms Example" }).click();
  // The bubble closes once it's saved: a reload before then would beat the save.
  await expect(bubble).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(words.fromName)).toHaveCount(0);
  await expect(page.getByText(words.dear("Ms Example"))).toBeVisible();
  await frame(page, "Her salutation, set");
});

test("ControlAI's statement", async ({ page, request, flowDatabase }) => {
  story(
    "ControlAI's statement is backed by politicians of every body, each linked to their page on their body's site. Its nightly import marks them as having signed.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}${importPath("import-controlai-statement")}`);
  await page.getByRole("button", { name: staffCopy.controlAiStatement.importNow }).click();
  await expect(page.getByText(/5 supporters/)).toBeVisible();
  await frame(page, "The import's page");

  story("The ask's page lists who signed it.");
  await page.goto(`${BASE}/staff/asks/controlai-statement`);
  await expect(page.getByText("Morag Example").first()).toBeVisible();
  await frame(page, "The statement's ask");
});
