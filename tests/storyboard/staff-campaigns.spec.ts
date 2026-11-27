import type { Page } from "@playwright/test";
import { longDay } from "@/lib/calendar-days";
import { DATE_PICKER_WORDS } from "@/lib/content/date-picker";
import { campaigns, copy as emailYourMpCopy } from "@/lib/content/email-your-mp";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { runSql } from "@/scripts/fresh-database.mjs";
import { BILL_THANKS, openLookup, sentLetterId, SUBJECTS } from "./letter-steps";
import { addFilter } from "./list-steps";
import { logIn } from "./login-steps";
import { addPauseaiEmails, importPoliticians, recordAnswers } from "./politician-steps";
import { BASE, expect, frame, madeUpAddress, story, test } from "./fixtures";
import type { Section } from "./report/frames";
import { asksCopy } from "@/lib/asks/copy";
import { mailingsCopy } from "@/app/(staff)/staff/_components/mailings/copy";
import { lettersCopy } from "@/app/(staff)/staff/_components/letters/copy";
import { oversightCopy } from "@/lib/oversight/copy";

export const section: Section = { name: "Campaigns, asks and sent emails", part: "Staff pages", order: 80 };

// Campaigns, each ask's page and form, and the sent emails. Each flow on its
// own database.

const copy = mailingsCopy.campaigns;

/**
 * Chooses `day` with the date picker the field `label` names: opens it,
 * moves on a few weeks at a time until the day is in view, and clicks it.
 */
async function chooseDay(page: Page, label: string, day: string) {
  await page.getByRole("button", { name: label }).click();
  const calendar = page.getByRole("dialog");
  const target = calendar.getByRole("button", { name: new RegExp(`^${longDay(day)}`) });
  while (!(await target.isVisible())) await calendar.getByRole("button", { name: DATE_PICKER_WORDS.later }).click();
  await target.click();
}

test("Campaigns", async ({ page, flowDatabase }) => {
  story(
    "Jane writes to her MP. Campaigns lists each one under the month of its most recent letter, with the same counts as a mailing.",
  );
  await sentLetterId(page, flowDatabase, madeUpAddress("Jane Smith", 41));
  await page.goto(`${BASE}/staff/letters`);
  await expect(page).toHaveURL(`${BASE}/staff/campaigns`);
  await frame(page, "The list of campaigns");

  story(
    "A campaign's page shows the letter people were given, how many changed its wording, and the letters they sent.",
  );
  await page.getByRole("link", { name: campaigns[0].title, exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(campaigns[0].title);
  await expect(page.getByRole("region", { name: copy.theLetter })).toContainText(SUBJECTS[campaigns[0].slug]);
  await frame(page, "A campaign's page");

  story("Each count shows only the letters it counts: the sent count, the letters that went.");
  await page
    .getByRole("link", { name: new RegExp(` ${lettersCopy.copyStates.counts.sent}$`) })
    .first()
    .click();
  await expect(page).toHaveURL(/tab=sent/);
  await expect(page.getByRole("heading", { name: lettersCopy.copyStates.tabs.sent })).toBeVisible();
  await frame(page, "The letters sent");
});

test("Staff edit a campaign's letter", async ({ page, flowDatabase }) => {
  const bill = campaigns[1];
  const writer = mailingsCopy.campaignLetter;
  story("Staff open the bill's campaign. Its letter is the version the code had, published for them to edit.");
  await logIn(page, flowDatabase, ["supporters"]);
  await page.goto(`${BASE}/staff/campaigns/${bill.slug}`);
  await expect(page.getByRole("region", { name: copy.theLetter })).toContainText(SUBJECTS[bill.slug]);
  await frame(page, "The bill's campaign and its letter");

  story("Edit the letter opens a draft, a copy of it. Beside it is the letter as an MP's constituent starts from it.");
  await page.getByRole("link", { name: copy.editLetter }).click();
  await expect(page).toHaveURL(`${BASE}/staff/campaigns/${bill.slug}/letter`);
  const preview = page.getByRole("region", { name: writer.preview });
  await expect(preview.getByText(writer.exampleNote)).toBeVisible();
  await frame(page, "The draft and its preview");

  story("The preview's button for the thank-you part shows it for an MP who signed ControlAI's letter.");
  const part = preview.getByRole("button", { name: /signed ControlAI/ });
  await part.click();
  await expect(part).toHaveAttribute("aria-pressed", "true");
  await expect(preview.getByText(BILL_THANKS)).toBeVisible();
  await frame(page, "The preview for an MP who signed");

  story("She changes the subject. It saves as she types, but supporters don't see it yet.");
  const subject = "Please attend the debate on the Artificial Superintelligence Bill";
  await page.getByLabel(mailingsCopy.mailingPages.subject).fill(subject);
  await expect(page.getByRole("status").first()).toHaveText(mailingsCopy.mailingPages.savePill.saved);
  await frame(page, "The subject changed, saved");

  story("Publish makes it the version supporters start from, and goes back to the campaign.");
  await page.getByRole("button", { name: writer.publish }).click();
  await expect(page).toHaveURL(`${BASE}/staff/campaigns/${bill.slug}`);
  await expect(page.getByRole("region", { name: copy.theLetter })).toContainText(subject);
  await expect(page.getByRole("link", { name: copy.editLetter })).toBeVisible();
  await frame(page, "The new version on the campaign's page");

  story("A supporter writing to their MP about the bill now starts from it.");
  await openLookup(page, BASE, "ZZ9 9ZZ", `/campaigns/${bill.slug}`);
  await page.getByRole("button", { name: emailYourMpCopy.lookup.button }).click();
  await expect(page).toHaveURL(`${BASE}/campaigns/${bill.slug}/write`);
  await expect(page.getByLabel(emailYourMpCopy.form.subjectLabel)).toHaveValue(subject);
  await frame(page, "The letter a supporter starts from");
});

test("Asks", async ({ page, request, flowDatabase }) => {
  story("The asks page lists each ask as the mailings page does: who asked, what they answered, and how it stands.");
  await importPoliticians(request, BASE, flowDatabase);
  recordAnswers(flowDatabase);
  await logIn(page, flowDatabase, ["supporters"]);
  addPauseaiEmails(flowDatabase);
  await page.goto(`${BASE}/staff/asks`);
  await frame(page, "The asks");

  story("An ask's page says what they were asked, then what they answered, a column each, then how we asked.");
  await page.getByRole("link", { name: "Edinburgh conference" }).first().click();
  await expect(page.getByText(asksCopy.asks.askedThem("PauseAI", "event"))).toBeVisible();
  await expect(page.getByRole("heading", { name: asksCopy.asks.page.howWeAsked })).toBeVisible();
  await frame(page, "An event's page");

  story("Pressing an answer's column opens those who gave it as a list: the politicians list, filtered to them.");
  await page.getByRole("link", { name: new RegExp(`^${staffVocabulary.statuses.going} \\d`) }).click();
  await expect(page).toHaveURL(/\/staff\/politicians\?ask=edinburgh-conference-2026&answer=going/);
  await expect(page.getByRole("row").filter({ hasText: "Morag Example" })).toBeVisible();
  await frame(page, "Those going, on the politicians list");

  story("An ask staff made can be edited, on its own page.");
  runSql(
    flowDatabase,
    "INSERT INTO asks (slug, title, kind, asked_by) VALUES ('our-letter', 'Our letter', 'letter', '{pauseai}')",
  );
  await page.goto(`${BASE}/staff/asks/our-letter`);
  await expect(page.getByText(asksCopy.asks.page.noWay)).toBeVisible();
  await frame(page, "A letter's page, with nothing yet");
  await page.getByRole("link", { name: asksCopy.asks.edit }).click();
  await expect(page).toHaveURL(`${BASE}/staff/asks/our-letter/edit`);
  await frame(page, "Its form");
});

test("An ask's pages", async ({ page, flowDatabase }) => {
  story(
    "A hundred and fifty politicians have signed, and twelve declined. Each column shows the first few, and leads to them all as a list.",
  );
  runSql(
    flowDatabase,
    `INSERT INTO asks (slug, title, kind, asked_by) VALUES ('our-letter', 'Our letter', 'letter', '{pauseai}');
     WITH people AS (
       INSERT INTO notable_people (kind, airtable_id, name)
       SELECT 'politician', 'recMany' || n, 'Signer ' || lpad(n::text, 3, '0') FROM generate_series(1, 162) n RETURNING id, name
     ), seats AS (
       INSERT INTO politicians (id, house, constituency, party, country)
       SELECT id, 'commons', 'Exampleton ' || right(name, 3), 'Example Party', 'england' FROM people
     )
     INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, updated_by)
     SELECT id, 'our-letter', 'letter', CASE WHEN right(name, 3)::int <= 150 THEN 'signed' ELSE 'declined' END, 'jo@pauseai.uk' FROM people`,
  );
  await logIn(page, flowDatabase, ["supporters"]);
  await page.goto(`${BASE}/staff/asks/our-letter`);
  await frame(page, "The columns of those who signed and declined");

  story("Open all as a list leads to the politicians list, filtered to those who signed.");
  await page.getByRole("link", { name: asksCopy.asks.page.allOf(150) }).click();
  await expect(page).toHaveURL(/\/staff\/politicians\?ask=our-letter&answer=signed$/);
  await expect(page.getByText(staffVocabulary.politicians(150))).toBeVisible();
  await frame(page, "Those who signed, on the politicians list");

  story("One who declined has since retired. Their column says so, and its list includes those out of office.");
  runSql(flowDatabase, "UPDATE notable_people SET status = 'retired' WHERE name = 'Signer 151'");
  await page.goto(`${BASE}/staff/asks/our-letter`);
  await expect(page.getByText(`Example Party · ${staffVocabulary.personStatuses.retired}`)).toBeVisible();
  await frame(page, "One who declined, retired");
  await page.getByRole("link", { name: asksCopy.asks.page.allOf(12) }).click();
  await expect(page).toHaveURL(/\/staff\/politicians\?ask=our-letter&answer=declined&status=any$/);
  await expect(page.getByText(staffVocabulary.politicians(12))).toBeVisible();
  await frame(page, "Those who declined, in office or not");
});

test("Sent emails", async ({ page, flowDatabase }) => {
  story("Sent emails lists every email the site has sent: what it was, who it was to and from, and how it went.");
  await sentLetterId(page, flowDatabase, madeUpAddress("Jane Smith", 42));
  await logIn(page, flowDatabase, ["admin", "supporters"]);
  await page.goto(`${BASE}/staff/sent-emails`);
  await expect(page.getByRole("link", { name: "Jane Smith" }).first()).toBeVisible();
  await frame(page, "The sent emails");

  story("Staff can search by address or subject, and filter by kind.");
  await addFilter(page, oversightCopy.sentEmails.filters.purpose, oversightCopy.sentEmails.purposes.letter);
  await expect(page).toHaveURL(/purpose=letter/);
  await frame(page, "Only letters");

  story("Only admins can open it.");
  await logIn(page, flowDatabase, ["supporters"]);
  await page.goto(`${BASE}/staff/sent-emails`);
  await expect(page).toHaveURL(`${BASE}/staff`);
});

test("A new ask", async ({ page, flowDatabase }) => {
  story("Staff add an ask from the asks page: an event, a winter reception.");
  await logIn(page, flowDatabase);
  const asks = asksCopy.asks;
  await page.goto(`${BASE}/staff/asks`);
  await frame(page, "The asks");
  await page.getByRole("link", { name: asks.newTitle }).click();
  await page.getByRole("radio", { name: asks.kinds.event }).click();
  await page.getByLabel(asks.byKind.event.title).fill("Winter reception");
  await chooseDay(page, asks.byKind.event.date, "2026-12-09");
  await frame(page, "The new ask, filled in");
  await page.getByRole("button", { name: asks.save }).click();
  await expect(page.getByText(asks.notices.added)).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Winter reception" })).toBeVisible();
  await frame(page, "The ask, added");

  story("They edit it to add the event's web address. Its title links there.");
  await page.getByRole("link", { name: "Winter reception" }).click();
  await page.getByRole("link", { name: asks.edit }).click();
  await expect(page.getByText("winter-reception-dec-2026", { exact: true })).toBeVisible();
  await page.getByLabel(asks.byKind.event.url).fill("https://luma.com/winter");
  await page.getByRole("button", { name: asks.save }).click();
  // Back on the list, saying so: the link alone can be there before the list is what's shown.
  await expect(page.getByText(asks.notices.saved)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(asks.title);
  await expect(page.getByRole("link", { name: "Winter reception" })).toHaveAttribute(
    "href",
    "/staff/asks/winter-reception-dec-2026",
  );
  await frame(page, "The ask, changed");
  story("Then they delete it. Delete asks to be pressed a second time.");
  await page.getByRole("link", { name: "Winter reception" }).click();
  await page.getByRole("link", { name: asks.edit }).click();
  await page.getByRole("button", { name: asks.delete }).click();
  await expect(page.getByRole("button", { name: staffVocabulary.deleteIt })).toBeFocused();
  await frame(page, "Delete, pressed once", { window: true });
  await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
  await expect(page.getByText(asks.notices.deleted)).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Winter reception" })).toHaveCount(0);
  await frame(page, "The ask, deleted");
});
