import type { Page } from "@playwright/test";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { runSql } from "@/scripts/fresh-database.mjs";
import { runQueue } from "./letters-inbox-steps";
import { stayOnPage } from "./loading-steps";
import { addStaffAccount, logInAsStaff } from "./login-steps";
import { connectGmail } from "./gmail-steps";
import { newestEmail } from "./outbox-steps";
import { addPauseaiEmails, importPoliticians, recordAnswers } from "./politician-steps";
import { WEBHOOK_AUTH } from "./postmark-steps";
import { TO_NOTIFICATIONS } from "./staff-inboxes";
import { caretAtEnd, caretInLink } from "./editor-steps";
import { emailFrame } from "./email-frame";
import { BASE, expect, frame, story, test } from "./fixtures";
import { openBubble, reload, scrollSettled } from "./settle";
import type { Section } from "./report/frames";
import { emailCopy } from "@/app/(staff)/staff/_components/email/copy";
import { politiciansCopy } from "@/app/(staff)/staff/_components/politicians/copy";
import { mailingsCopy } from "@/app/(staff)/staff/_components/mailings/copy";
import { lettersCopy } from "@/app/(staff)/staff/_components/letters/copy";
import { dashboardCopy } from "@/app/(staff)/staff/_components/dashboard/copy";

export const section: Section = { name: "Mailings", part: "Staff pages", order: 40 };

// Mailings to politicians written on the site: started from New mailing,
// who it's for ticked on the politicians list, written, previewed and sent
// to yourself as a test; one started from the list's filter, who it's to
// changed from the list, and deleted; names pasted to tick; one sent
// from your Gmail, connected from the page, scheduled and sent by the
// hourly job; and the pages of mailings scheduled, sending and sent, made in
// the database as scheduling would make them; one whose run stopped while
// sending, finished by the next with its letter uncertain; letters of one
// bouncing; and a politician's reply to check, answered from the page, or
// marked as needing nothing by someone who can't answer from its mailbox.
// Then what the pages say when a mailing has changed under them: one a
// colleague unschedules, schedules, deletes or changes meanwhile, a time
// that has passed, a recipient who's no longer one, and a reply someone
// else dealt with first.

const copy = mailingsCopy.mailingPages;
const refusals = mailingsCopy.refusals;
const choosing = politiciansCopy.choosing;
const stateWords = lettersCopy.copyStates;

/** This flow's own staff address: flows run alongside each other, and share the outbox. */
const staffEmail = () => `mail-${test.info().testId.replace(/\W/g, "").slice(-8)}@pauseai.uk`;

async function logIn(page: Page, database: string) {
  addStaffAccount(database, staffEmail());
  return logInAsStaff(page, BASE, staffEmail());
}

/**
 * Starts a mailing from the politicians list at `filters`, with everyone
 * they find, `n`, ticked, and goes on to write it.
 */
async function startFromList(page: Page, filters: string, n: number) {
  await page.goto(`${BASE}/staff/politicians?${filters}`);
  await page.getByRole("button", { name: choosing.mailThese(n) }).click();
  await expect(page.getByText(choosing.choosingNew)).toBeVisible();
  const bar = page.getByRole("region", { name: choosing.choosingCount(n) });
  await bar.getByRole("link", { name: choosing.writeToThese(n) }).click();
  await expect(page).toHaveURL(/\/staff\/mailings\/\d+$/);
}

/**
 * A mailing written here, in `state`, from Jo, to every politician with
 * an address, as scheduling makes one: a PauseAI letter each, in `statuses`
 * by name, or with `everyone`, to those with no address too. A status
 * "skipped" is skipped as the address was blocked; "skipped:left-office"
 * says why. Returns its ID.
 */
function addMailing(database: string, title: string, state: string, statuses: string[], everyone = false): string {
  const letter =
    '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Dear "}, {"type": "field", "attrs": {"field": "salutation"}}, {"type": "text", "text": ", will you come?"}]}]}';
  const [id] = runSql(
    database,
    `INSERT INTO mailings (title, subject, audience, channel, filter, body, created_by, sent_from, from_name, due_at, state, ask)
     VALUES ('${title}', '${title}', 'politicians', 'email', '{"list": "politicians", "params": {}}', '${letter}',
       'jo@pauseai.uk', 'jo@pauseai.uk', 'Jo Example', '2026-10-20T08:00:00Z', '${state}', 'edinburgh-conference-2026')
     RETURNING id`,
  );
  runSql(
    database,
    `WITH given AS (
       SELECT n.id, (ARRAY[${statuses.map((s) => `'${s}'`).join(", ")}])[row_number() OVER (ORDER BY n.name)] AS given
       FROM notable_people n JOIN politicians p USING (id) WHERE ${everyone ? "true" : "n.email IS NOT NULL"} AND NOT p.is_test),
     r AS (SELECT id, split_part(given, ':', 1) AS status, nullif(split_part(given, ':', 2), '') AS reason FROM given),
     l AS (
       INSERT INTO letters (kind, notable_person_id, status, sent_at, replied_at)
       SELECT 'pauseai', r.id, r.status, CASE WHEN r.status IN ('sent', 'bounced') THEN '2026-10-20T08:00:00Z'::timestamptz END,
         CASE WHEN r.status = 'sent' AND r.id = (SELECT min(id) FROM r) THEN '2026-10-21T10:00:00Z'::timestamptz END
       FROM r WHERE r.status IS NOT NULL RETURNING id, notable_person_id, status)
     INSERT INTO letters_from_pauseai (id, mailing_id, skip_reason)
     SELECT l.id, ${id}, CASE WHEN l.status = 'skipped' THEN coalesce(r.reason, 'blocked') END
     FROM l JOIN r ON r.id = l.notable_person_id`,
  );
  return id;
}

/** What the page says at its top, in `words`. */
const saidAtTop = (page: Page, words: string) => page.getByRole("alert").filter({ hasText: words });

/**
 * Makes draft `id` scheduled for 30 October, from Jo, with a letter for
 * every politician with an address, as a colleague's Schedule would from
 * their own computer.
 */
function scheduleElsewhere(database: string, id: string) {
  runSql(
    database,
    `WITH l AS (
       INSERT INTO letters (kind, notable_person_id, status)
       SELECT 'pauseai', n.id, 'scheduled' FROM notable_people n JOIN politicians p USING (id)
       WHERE n.email IS NOT NULL AND NOT p.is_test RETURNING id)
     INSERT INTO letters_from_pauseai (id, mailing_id) SELECT l.id, ${id} FROM l;
     UPDATE mailings SET state = 'scheduled', sent_from = 'jo@pauseai.uk', from_name = 'Jo Example',
       due_at = '2026-10-30T09:00:00Z', version = version + 1 WHERE id = ${id}`,
  );
}

/** Makes scheduled mailing `id` a draft again, its letters let go, as a colleague's Unschedule would. */
function unscheduleElsewhere(database: string, id: string) {
  runSql(
    database,
    `DELETE FROM letters WHERE id IN (SELECT id FROM letters_from_pauseai WHERE mailing_id = ${id});
     UPDATE mailings SET state = 'draft', version = version + 1 WHERE id = ${id}`,
  );
}

/** Puts the window at the page's top, where the page says what it has to, once a draft's title bar has gone. */
async function toTheTop(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(page.locator("[data-shown]")).toHaveCount(0);
}

test("A new mailing", async ({ page, request, flowDatabase }) => {
  story("Staff connect their Gmail on their account page, so there's one to send from, then open the mailings page.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  // Your Gmail connected, on your account page, so there's one to send from.
  await page.goto(`${BASE}/staff/me`);
  await page.getByRole("link", { name: emailCopy.gmail.connect }).click();
  await expect(page.getByText(emailCopy.gmail.outcomes.connected)).toBeVisible();
  await page.goto(`${BASE}/staff/mailings`);
  await frame(page, "The mailings page");
  story(
    "New mailing makes a draft and opens it at its first section, the ask, as what it asks shapes who it's to. They choose the Edinburgh conference.",
  );

  await page.getByRole("button", { name: choosing.newTitle }).click();
  await expect(page).toHaveURL(/\/staff\/mailings\/\d+$/);
  await page.getByLabel(copy.ask, { exact: true }).selectOption({ label: "Edinburgh conference" });
  await expect(page.getByRole("status").first()).toHaveText(copy.savePill.saved);
  await frame(page, "The new draft, its ask chosen");
  story(
    "Choose who opens the politicians list on those yet to answer the conference: not yet replied, or never asked. A box on each row ticks them. Down the list, what they're doing stays at the top of the window, and the way on at the foot.",
  );
  await page.getByRole("link", { name: copy.chooseWho }).click();
  await expect(page).toHaveURL(
    /ask=edinburgh-conference-2026&answer=edinburgh-conference-2026\.invited&answer=edinburgh-conference-2026\.never/,
  );
  await expect(page.getByText(choosing.noneTicked)).toBeVisible();
  // It opens at the top, as a page does, though the strip is held there.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  // Down the list, what's being done stays at the top, and the way on at the foot.
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await frame(page, "Those yet to answer, scrolled down", {
    window: true,
  });
  story(
    "They choose the Scottish Parliament and tick Morag Example. The bar at the foot says how many are ticked, with Write to this one.",
  );
  await page.getByRole("link", { name: staffVocabulary.houses["scottish-parliament"] }).click();
  await expect(page).toHaveURL(/house=scottish-parliament/);
  await page.getByRole("checkbox", { name: choosing.tick("Morag Example") }).check();
  const bar = page.getByRole("region", { name: choosing.choosingCount(1) });
  await expect(bar).toBeVisible();
  await frame(page, "The politicians list, one ticked", {
    window: true,
  });
  story("Write to this one opens the draft, to Morag Example, ready to write.");

  await bar.getByRole("link", { name: choosing.writeToThese(1) }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(choosing.newTitle);
  await expect(page.getByRole("list", { name: copy.whoLabel })).toHaveText("Morag Example");
  await frame(page, "The new mailing");
  story(
    "They write a subject, and a line under the greeting. The mailing is saved as a draft, and the preview shows the email as Morag Example will get it.",
  );

  await page.getByLabel(copy.subject).fill("Edinburgh: one week to go");
  // The letter starts with its greeting; the rest is written under it.
  const letter = page.getByRole("textbox", { name: copy.letter });
  await expect(letter).toContainText(`${copy.greeting} ${mailingsCopy.mailingEditor.fields.salutation},`);
  await caretAtEnd(letter);
  await page.keyboard.type("We hope to see you there.");
  await expect(page.getByRole("status").first()).toHaveText(copy.savePill.saved);
  await expect(page).toHaveURL(/\/staff\/mailings\/\d+$/);
  const preview = page.getByRole("region", { name: copy.sections.preview });
  await expect(preview.getByText("We hope to see you there.")).toBeVisible();
  await expect(preview.getByText("Dear Ms Example,")).toBeVisible();
  await preview.getByRole("button", { name: copy.sendTest }).scrollIntoViewIfNeeded();
  await frame(page, "The draft and its preview", {
    window: true,
  });
  story("Send test sends them a copy, as Morag would get it.");

  await preview.getByRole("button", { name: copy.sendTest }).click();
  await expect(preview.getByText(copy.testSent(staffEmail()))).toBeVisible();
  const email = newestEmail((one) => one.To === `"Morag Example" <${staffEmail()}>`)!;
  expect(email.Subject).toBe("Edinburgh: one week to go");
  expect(email.TextBody).toBe("Dear Ms Example,\n\nWe hope to see you there.");
  await emailFrame(page, email, "The test copy");
  story("Reloaded, the draft is as they left it, to go from their Gmail.");

  // Reopened, it's the draft as it was.
  await reload(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Edinburgh: one week to go");
  await expect(page.getByLabel(copy.fromLegend, { exact: false })).toHaveValue(staffEmail());
});

test("A new mailing from the whole list", async ({ page, request, flowDatabase }) => {
  story("On the politicians list with no filter, the button is New mailing.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/politicians`);
  await frame(page, "The politicians list");
  story("It makes an empty draft, with no one ticked, rather than one to everyone, and opens it at its ask.");
  await page.getByRole("button", { name: choosing.newTitle }).click();
  await expect(page).toHaveURL(/\/staff\/mailings\/\d+$/);
  await expect(page.getByRole("link", { name: copy.chooseWho })).toBeVisible();
  await frame(page, "The new draft, no one ticked");
});

test("A link, and a part made for everyone", async ({ page, request, flowDatabase }) => {
  story("Staff mail the Lords, and write a line with a link to the march's page in it.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  await startFromList(page, "house=lords", 1);
  await page.getByLabel(copy.subject).fill("The march");
  const letter = page.getByRole("textbox", { name: copy.letter });
  const words = mailingsCopy.mailingEditor;
  // Each change is saved a moment after it's made, so a frame after one waits for that.
  const saved = () => expect(page.getByRole("status").first()).toHaveText(copy.savePill.saved);
  await caretAtEnd(letter);
  await page.keyboard.type("Join us at the march: ");
  // With nothing selected, the address goes in as a link to itself.
  await page.keyboard.press("Control+k");
  await page.getByRole("textbox", { name: words.linkBar.address }).fill("pauseai.uk/march");
  await page.keyboard.press("Enter");
  story("With the cursor in the link, where it goes shows under it.");

  await caretInLink(letter, letter.getByRole("link", { name: "pauseai.uk/march" }));
  const peek = page.getByRole("button", { name: "https://pauseai.uk/march" });
  await expect(peek).toBeVisible();
  await saved();
  await frame(page, "Where a link goes, under it", { window: true });
  story("Pressing it opens the link bar, to change where it goes.");

  await peek.click();
  await expect(page.getByRole("textbox", { name: words.linkBar.address })).toHaveValue("https://pauseai.uk/march");
  await frame(page, "The link bar, from where the link goes", { window: true });
  story(
    "On a line of its own, they write a thank-you, and make it only for some. The part has a × at its corner, and Only those in the toolbar is orange.",
  );

  await page.getByRole("button", { name: words.linkBar.cancel }).click();
  await caretAtEnd(letter);
  await page.keyboard.press("Enter");
  await page.keyboard.type("Thank you for your answer.");
  const menu = await openBubble(page.getByRole("button", { name: words.addOnlyFor }));
  await menu.getByRole("menuitem").first().click();
  await menu.getByRole("menuitem").first().click();
  const cross = letter.getByRole("button", { name: words.forEveryone });
  await expect(cross).toBeVisible();
  await saved();
  await frame(page, "A part only for some", { window: true });
  story("Selecting a whole line in it shows Remove only those under it too.");

  await letter.getByText("Thank you for your answer.").click({ clickCount: 3 });
  await expect(page.getByRole("menuitem", { name: words.remove.onlyFor })).toBeVisible();
  await frame(page, "A line selected in the part", { window: true });
  story("The × takes the part away, and keeps its words, for everyone.");

  await cross.click();
  await expect(cross).toHaveCount(0);
  await expect(letter).toContainText("Thank you for your answer.");
  await saved();
  await frame(page, "The part made for everyone", { window: true });
});

test("Changing and deleting a draft", async ({ page, request, flowDatabase }) => {
  story(
    "On the politicians list, staff choose the Lords and press Mail these: everyone the list finds is ticked for it.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/politicians?house=lords`);
  await frame(page, "The Lords");
  story(
    "They write the draft's subject, then press Change who. The draft is saved, and the button waits while the politicians list comes.",
  );
  await startFromList(page, "house=lords", 1);
  await page.getByLabel(copy.subject).fill("Lords only");
  await expect(page.getByRole("status").first()).toHaveText(copy.savePill.saved);
  // The list kept from coming, so the button can be seen waiting for it.
  const list = await stayOnPage(page, /\/staff\/politicians/);
  const changeWho = page.getByRole("link", { name: copy.changeWho });
  // From the top, where the button shows on a phone too, rather than wherever filling in the subject scrolled.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await changeWho.click();
  await expect(changeWho.locator("[aria-hidden]")).toBeVisible();
  await frame(page, "Change who, waiting", {
    window: true,
  });
  story("The list opens on the tab of those ticked, the draft named at the top.");
  await page.goto(await list.asked());
  await expect(page).toHaveURL(/mailing=\d+&tab=ticked/);
  await expect(page.getByText(choosing.choosingDraft("Lords only"))).toBeVisible();
  await expect(page.getByRole("checkbox", { name: choosing.tick("Lord Seedling of Example") })).toBeChecked();
  await frame(page, "The ticked tab", {
    window: true,
  });
  story("They search for Polly and tick her too: two ticked.");

  await page.getByRole("link", { name: politiciansCopy.politicians.allHouses }).click();
  await page.getByRole("searchbox").fill("Polly");
  await page.getByRole("button", { name: staffVocabulary.search }).click();
  await expect(page).toHaveURL(/q=Polly/);
  await page.getByRole("checkbox", { name: choosing.tick("Polly Placeholder") }).check();
  const two = page.getByRole("region", { name: choosing.choosingCount(2) });
  await expect(two.getByRole("link", { name: choosing.useThese(2) })).toBeVisible();
  await frame(page, "Polly ticked", { window: true });
  story("They change their minds: Clear all ticks starts again, with no one ticked.");

  await two.getByRole("button", { name: choosing.untickAll }).click();
  await expect(page.getByText(choosing.noneTicked)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: choosing.tick("Polly Placeholder") })).not.toBeChecked();
  await frame(page, "No one ticked", { window: true });
  story("They tick Polly alone, and the bar's button goes back to the draft, which now names her.");
  await page.getByRole("checkbox", { name: choosing.tick("Polly Placeholder") }).check();
  await page
    .getByRole("region", { name: choosing.choosingCount(1) })
    .getByRole("link", { name: choosing.useThese(1) })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lords only");
  await expect(page.getByRole("list", { name: copy.whoLabel })).toHaveText("Polly Placeholder");
  await frame(page, "The draft");
  story("Delete draft asks to be pressed again.");

  await page.getByRole("button", { name: copy.deleteDraft }).click();
  await expect(page.getByRole("button", { name: staffVocabulary.deleteIt })).toBeFocused();
  await frame(page, "Delete draft, pressed once", { window: true });
  story("Pressed again, the draft is deleted, and gone from the mailings page.");
  await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
  await expect(page).toHaveURL(`${BASE}/staff/mailings`);
  await expect(page.getByRole("link", { name: "Lords only" })).toHaveCount(0);
  await frame(page, "The mailings page");
});

test("Pasting names", async ({ page, request, flowDatabase }) => {
  story("On the Commons, staff press Mail these: all three MPs it finds are ticked, and the box over them too.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/politicians?house=commons`);
  await page.getByRole("button", { name: choosing.mailThese(3) }).click();
  await expect(page.getByText(choosing.choosingNew)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: choosing.tickAll(3) })).toBeChecked();
  await frame(page, "The Commons, all ticked", { window: true });
  story(
    "Paste names, in the bar, opens a box above it. They paste a row copied from the list, a constituency, and a name with a typo.",
  );

  await openBubble(page.getByRole("button", { name: choosing.pasteNames }));
  // Typed into at once.
  await expect(page.getByRole("textbox", { name: choosing.pasteLabel })).toBeFocused();
  await page
    .getByRole("textbox", { name: choosing.pasteLabel })
    .fill(
      [
        "Polly Placeholder\tHouse of Commons\tCities of London and Westminster\tLabour (Co-op)",
        "Exampleshire North",
        "Ms Dora Dumy",
      ].join("\n"),
    );
  await frame(page, "Paste names", { window: true });
  story(
    "Find these opens the Paste names tab: a row for each person found, and why. Polly is found by her name, Morag Example by her constituency, and Dora by the name nearest the typo. Morag isn't ticked yet.",
  );

  await page.getByRole("button", { name: choosing.pasteTick }).click();
  const pasted = page.getByRole("region", { name: choosing.pastedTitle });
  await expect(pasted).toBeVisible();
  await expect(page.getByRole("link", { name: choosing.pastedTab })).toHaveAttribute("aria-current", "page");
  await expect(pasted.getByRole("checkbox", { name: choosing.tick("Morag Example") })).not.toBeChecked();
  await frame(page, "The Paste names tab", { window: true });
  story("Its Download menu downloads just the rows the tab shows, each with why it's there.");

  const menu = await openBubble(pasted.getByRole("button", { name: staffVocabulary.lists.download }));
  const csv = menu.getByRole("link", { name: staffVocabulary.lists.formats.csv });
  const download = await (await page.request.get(`${BASE}${await csv.getAttribute("href")}`)).text();
  expect(download).toContain("Morag Example");
  expect(download).not.toContain("Mo Example");
  await frame(page, "The Paste names tab's downloads", { window: true });
  await page.keyboard.press("Escape");
  story("The box over them ticks everyone found: four ticked.");

  await pasted.getByRole("checkbox", { name: choosing.pastedTickAll(3) }).check();
  await expect(page.getByRole("region", { name: choosing.choosingCount(4) })).toBeVisible();
  await frame(page, "Everyone found ticked", { window: true });
  story("On the Ticked tab, they untick Mo Example: three left.");

  await page.getByRole("link", { name: `${choosing.pickedTab} 4` }).click();
  await page.getByRole("checkbox", { name: choosing.tick("Mo Example") }).uncheck();
  await expect(page.getByRole("region", { name: choosing.choosingCount(3) })).toBeVisible();
  await frame(page, "The ticked tab", { window: true });
  story(
    "Write to these 3 opens the draft. It says who it's to as the Commons, as found on the day, plus Morag Example, except Mo Example.",
  );

  await page.getByRole("link", { name: choosing.writeToThese(3) }).click();
  const who = page.getByRole("list", { name: copy.whoLabel });
  await expect(who).toContainText(copy.pickedFrom("16 Oct 2026", 3));
  await expect(who).toContainText(copy.pickedPlus("Morag Example"));
  await expect(who).toContainText(copy.pickedExcept("Mo Example"));
  await frame(page, "The draft");
});

test("Rescheduling a mailing", async ({ page, request, flowDatabase }) => {
  story("A mailing is scheduled for 30 October. The mailings page shows it under Scheduled, with when it goes.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  const id = addMailing(flowDatabase, "Edinburgh reminder", "scheduled", ["scheduled", "scheduled", "scheduled"]);
  runSql(flowDatabase, `UPDATE mailings SET due_at = '2026-10-30T09:00:00Z' WHERE id = ${id}`);
  await page.goto(`${BASE}/staff/mailings`);
  await expect(page.getByRole("listitem").filter({ hasText: "Edinburgh reminder" })).toContainText(
    copy.states.scheduled,
  );
  await frame(page, "The mailings page");
  story("Its page says when it sends, and to whom.");

  await page.getByRole("link", { name: "Edinburgh reminder" }).click();
  await expect(page.getByText("Fri 30 Oct at 09:03", { exact: true })).toBeVisible();
  await frame(page, "The scheduled mailing");
  story("Change the time opens a calendar to choose another day.");

  // Where the window comes to rest says whether the calendar has room below the field or opens above it.
  await openBubble(page.getByRole("button", { name: copy.changeTime }));
  await page.getByRole("button", { name: copy.day }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await frame(page, "The calendar", { window: true });
  story(
    "They choose Monday 2 November at 14:33, in London's time: the sending runs at 3, 18, 33 and 48 past each hour.",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Monday 2 November 2026/ })
    .click();
  await page.getByLabel(copy.hour, { exact: false }).selectOption("14");
  await page.getByLabel(copy.minutes, { exact: false }).selectOption("33");
  await frame(page, "A new day and time", { window: true });
  story("Change it saves the new time. Then Unschedule makes the mailing a draft again, to change and schedule later.");
  await page.getByRole("button", { name: copy.saveTime }).click();
  await expect(page.getByText("Mon 2 Nov at 14:33", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: copy.unschedule }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Edinburgh reminder");
  await expect(page.getByRole("status").first()).toHaveText(copy.savePill.saved);
  // The draft comes back wherever the click on Unschedule left the window, which isn't the same each time;
  // the frame is of the page as a whole, so from its top.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  // The bar with the title at the top of the window goes once the title is back in view, which
  // the page learns a frame or two after the scroll (MailingWriter's IntersectionObserver).
  await expect(page.locator("[data-shown]")).toHaveCount(0);
  await frame(page, "The draft");
});

test("Copying a mailing", async ({ page, request, flowDatabase }) => {
  story(
    "The invitation to the Edinburgh conference has gone. Copy mailing, at the top right of its page, starts a reminder from it.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  recordAnswers(flowDatabase);
  await logIn(page, flowDatabase);
  const sent = addMailing(flowDatabase, "Edinburgh invitation", "sent", ["sent", "sent", "sent", "sent"]);
  await page.goto(`${BASE}/staff/mailings/${sent}`);
  await expect(page.getByRole("button", { name: copy.copyMailing })).toBeVisible();
  await frame(page, "The sent mailing, Copy mailing at its top right");
  story("Pressed, it opens a new draft to the same people, with the same subject, letter and ask.");
  await page.getByRole("button", { name: copy.copyMailing }).click();
  await expect(page).not.toHaveURL(new RegExp(`/staff/mailings/${sent}$`));
  await expect(page).toHaveURL(/\/staff\/mailings\/\d+$/);
  await expect(page.getByLabel(copy.subject)).toHaveValue("Edinburgh invitation");
  await frame(page, "The copy, a draft");
  story(
    "Some it goes to have already answered the conference: Polly declined and Morag is going. Under Who, an amber strip says so, and Who they are names them, each with their answer.",
  );
  const answered = page.locator("[data-strip]").filter({ hasText: /already given an answer/ });
  await answered.getByRole("button", { name: copy.whoTheyAre }).click();
  await expect(answered.getByRole("link", { name: "Morag Example" })).toBeVisible();
  await answered.evaluate((strip) => strip.scrollIntoView({ block: "center", behavior: "instant" }));
  await frame(page, "Those who already answered, named", { window: true });
  story("Leave them out unticks them. The draft opens again, to the rest, with no warning.");
  const before = await page.getByText(/will be emailed/).innerText();
  await answered.getByRole("button", { name: copy.leaveThemOut }).click();
  await expect(answered).toHaveCount(0);
  await expect(page.getByText(/will be emailed/)).not.toHaveText(before);
  await frame(page, "The draft, without them");
});

test("Sending and sent", async ({ page, request, flowDatabase }) => {
  story("A mailing is part-way through sending. Its page shows how far it's got, with Stop sending.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  const sending = addMailing(flowDatabase, "Going out now", "sending", ["sent", "scheduled", "scheduled"]);
  await page.goto(`${BASE}/staff/mailings/${sending}`);
  await expect(page.getByText(copy.sendingBar(1, 3))).toBeVisible();
  await frame(page, "A mailing sending");
  story(
    "Another mailing has been sent. Of its four letters, two went, one bounced, and one wasn't sent, as the address was blocked. Its counts say so, in two groups.",
  );

  const sent = addMailing(flowDatabase, "Edinburgh follow-up", "sent", ["sent", "bounced", "skipped", "sent"]);
  await page.goto(`${BASE}/staff/mailings/${sent}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Edinburgh follow-up");
  await expect(page.getByRole("link", { name: `1 ${stateWords.counts.unreached}` })).toBeVisible();
  await frame(page, "The sent mailing");
  story("The didn't reach count shows only the one that bounced, and pressed again goes back to everyone.");

  await page.getByRole("link", { name: `1 ${stateWords.counts.unreached}` }).click();
  await expect(page.getByRole("row")).toHaveCount(2);
  await frame(page, "The one that bounced");
  story("Each recipient links to their letter's page, under the mailing's.");

  // Each recipient leads to their letter's own page, under the mailing, back to which it goes.
  await page.getByRole("table").getByRole("link", { name: staffVocabulary.theLetter }).click();
  await expect(page).toHaveURL(new RegExp(`/staff/mailings/${sent}/letters/\\d+$`));
  await expect(page.getByRole("navigation").getByRole("link", { name: "Edinburgh follow-up" })).toBeVisible();
  await frame(page, "The bounced letter's page");
});

test("A run stops while sending", async ({ page, request, flowDatabase }) => {
  story(
    "A mailing is sending when the run sending it stops, after Gmail has taken a letter but before it's marked sent. Two of its three letters went; the third may have gone.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  const id = addMailing(flowDatabase, "Going out now", "sending", ["sent", "sending", "sent"]);
  const [letter] = runSql(
    flowDatabase,
    `UPDATE letters l SET taken_at = now() - interval '1 hour' FROM letters_from_pauseai p
     WHERE p.id = l.id AND p.mailing_id = ${id} AND l.status = 'sending' RETURNING l.id`,
  );
  await page.goto(`${BASE}/staff/mailings/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Going out now");
  await frame(page, "The mailing, still sending");
  story(
    "The next hourly run marks the letter uncertain rather than sending it again, as it may have gone, and the mailing is sent.",
  );

  const run = await request.post(`${BASE}/api/cron/send-mailings`, {
    headers: { Authorization: "Bearer fixture-cron-secret" },
  });
  expect(await run.json()).toMatchObject({ started: [], sent: 0, left: 0 });
  await reload(page);
  await expect(page.getByText(stateWords.tags["error:unfinished"]!)).toBeVisible();
  await frame(page, "The mailing sent, one letter uncertain");
  story("The letter's page says so, and its history says when and to whom it may have gone, for someone to check.");

  await page.goto(`${BASE}/staff/mailings/${id}/letters/${letter}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(lettersCopy.letters.fromPauseai);
  await frame(page, "The uncertain letter's page");
});

test("A mailing's letters bounce", async ({ page, request, flowDatabase }) => {
  story(
    "A mailing has been sent, and two politicians' addresses bounce its letters. Each is blocked, and nobody is emailed yet.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  const sent = addMailing(flowDatabase, "Edinburgh follow-up", "sent", ["sent", "skipped:left-office", "sent"]);
  const letters = runSql(
    flowDatabase,
    `SELECT l.id, n.email, n.name FROM letters_from_pauseai m JOIN letters l USING (id) JOIN notable_people n ON n.id = l.notable_person_id
     WHERE m.mailing_id = ${sent} AND l.status = 'sent' ORDER BY l.id`,
  ).map((row) => row.split("\t"));
  expect(letters).toHaveLength(2);
  for (const [letter, address] of letters) {
    runSql(
      flowDatabase,
      `INSERT INTO email_sends (purpose, letter_id, address, outcome, message_id)
       VALUES ('mailing', ${letter}, lower('${address}'), 'sent', 'mailing-bounce-${letter}')`,
    );
    const bounce = await request.post(`${BASE}/api/postmark/bounce`, {
      headers: { Authorization: WEBHOOK_AUTH },
      data: {
        RecordType: "Bounce",
        Type: "HardBounce",
        TypeCode: 1,
        MessageID: `mailing-bounce-${letter}`,
        Name: "Hard bounce",
        Description: "The server was unable to deliver your message (ex: unknown user, mailbox not found).",
        Email: address,
        BouncedAt: "2026-10-20T09:00:00Z",
        Inactive: true,
        CanActivate: true,
      },
    });
    expect(await bounce.json()).toEqual({ recorded: true });
  }
  const [[, , name]] = letters;
  expect(
    newestEmail((email) => email.To === TO_NOTIFICATIONS && email.Subject === lettersCopy.alert.subject(name)),
  ).toBeUndefined();
  story("The dashboard already shows both, waiting for someone to fix their addresses.");

  await page.goto(`${BASE}/staff`);
  await expect(page.getByText(dashboardCopy.home.dashboard.actions.blockedMp(name))).toBeVisible();
  await frame(page, "The dashboard");
  story(
    "Within the hour, the notification inbox gets the day's report, with each politician, their address and what its server said.",
  );

  await runQueue(request);
  const words = lettersCopy.notifications.mailingBounces;
  const report = newestEmail(
    (email) =>
      email.To === TO_NOTIFICATIONS && email.Subject === words.subject(2) && email.TextBody.includes(`- ${name} (`),
  )!;
  await emailFrame(page, report, "The report to the notification inbox");
});

test("A stopped mailing", async ({ page, request, flowDatabase }) => {
  story(
    "A mailing was stopped part-way through. On the mailings page, its row shows how many of its letters are in each state, the one Gmail refused among them.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  addMailing(
    flowDatabase,
    "Briefing on the bill",
    "cancelled",
    // By name: Gordon, who left office; Lord Seedling, with no address; Mo; Morag; Dora; Polly.
    ["skipped:left-office", "skipped:no-email", "sent", "skipped", "not_sent", "cancelled"],
    true,
  );
  await page.goto(`${BASE}/staff/mailings`);
  const row = page.getByRole("listitem").filter({ hasText: "Briefing on the bill" });
  await expect(row.getByRole("link", { name: `1 ${stateWords.counts.error}` })).toBeVisible();
  await expect(row).not.toContainText(stateWords.andFine(5));
  await row.scrollIntoViewIfNeeded();
  await frame(page, "The stopped mailing, on the mailings page", { window: true });
  story(
    "On its page, the not sent count shows the four that weren't sent, each saying why: one politician left office, one has no address, one address is blocked, and one was never sent as the mailing was stopped first.",
  );

  await row.getByRole("link", { name: "Briefing on the bill", exact: true }).click();
  await page.getByRole("link", { name: `4 ${stateWords.counts["not-sent"]}` }).click();
  await expect(page.getByRole("row")).toHaveCount(5);
  await frame(page, "The four not sent");
  story("The error count shows the one Gmail refused.");

  await page.getByRole("link", { name: `1 ${stateWords.counts.error}` }).click();
  await expect(page.getByRole("row")).toHaveCount(2);
  await frame(page, "The one Gmail refused");
  story("Pressed again, the count is no longer chosen, and everyone shows.");

  // Pressed again, the count shows everyone.
  await page.getByRole("link", { name: `1 ${stateWords.counts.error}` }).click();
  await expect(page).toHaveURL(/\/staff\/mailings\/\d+$/);
  await expect(page.getByRole("row")).toHaveCount(7);
  await frame(page, "Everyone");
  story("The count of those that went shows the one letter that went.");

  await page
    .getByRole("group", { name: `1 ${stateWords.groups.went}` })
    .getByRole("link")
    .click();
  await expect(page.getByRole("row")).toHaveCount(2);
  await frame(page, "The one sent");
});

test("Gmail refuses a letter", async ({ page, request, flowDatabase }) => {
  story("A mailing has been sent, but Gmail refused one of its letters. Its tag says so, in red.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  const id = addMailing(flowDatabase, "Edinburgh follow-up", "sent", ["sent", "not_sent"]);
  const [letter] = runSql(
    flowDatabase,
    `INSERT INTO letter_events (letter_id, status, details)
     SELECT l.id, 'failed', '{"detail": "Invalid To header"}' FROM letters_from_pauseai p JOIN letters l USING (id)
     WHERE p.mailing_id = ${id} AND l.status = 'not_sent' RETURNING letter_id`,
  );
  await page.goto(`${BASE}/staff/mailings/${id}`);
  await expect(page.getByText(stateWords.tags["error:gmail"]!)).toBeVisible();
  await frame(page, "The mailing, one letter refused");
  story("The letter's page says what Gmail said, in its history.");

  await page.goto(`${BASE}/staff/mailings/${id}/letters/${letter}`);
  await expect(page.locator("dd").filter({ hasText: "Invalid To header" })).toBeVisible();
  await frame(page, "The refused letter's page");
});

test("Sending from your Gmail", async ({ page, request, flowDatabase }) => {
  story(
    "Staff start a mailing to a politician in Scotland. No Gmail is connected, so Sent from says nothing can be sent, with a link to add theirs.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  // With no Gmail connected, a mailing can't be sent, and Sent from says where to connect one.
  await startFromList(page, "nation=scotland", 1);
  const from = page.getByRole("region", { name: copy.sections.from });
  await expect(from.getByText(copy.noSenders)).toBeVisible();
  await frame(page, "Sent from, with no Gmail");
  story(
    "They connect their Gmail on their account page, and start the mailing again. It's sent from their Gmail, under its name, and says how many of today's 1,800 emails it has sent.",
  );

  // Connected on your account page, it's the one a new mailing is sent from.
  await from.getByRole("link", { name: copy.connectOne }).click();
  await page.getByRole("link", { name: emailCopy.gmail.connect }).click();
  await expect(page.getByText(emailCopy.gmail.outcomes.connected)).toBeVisible();
  await startFromList(page, "nation=scotland", 1);
  await page.getByLabel(copy.subject).fill("See you in Edinburgh");
  await caretAtEnd(page.getByRole("textbox", { name: copy.letter }));
  await page.keyboard.type("We hope to see you there.");
  await expect(page.getByRole("status").first()).toHaveText(copy.savePill.saved);
  await expect(page).toHaveURL(/\/staff\/mailings\/\d+$/);
  await expect(page.getByLabel(copy.fromLegend, { exact: false })).toHaveValue(staffEmail());
  await expect(from.getByText(emailCopy.gmail.sentToday(0, "1,800"))).toBeVisible();
  // Yours connected, there's no link to connect it, and the name is the Gmail's, filled in.
  await expect(from.getByRole("link", { name: copy.connectOne })).toHaveCount(0);
  await expect(page.getByLabel(copy.fromNameLabel, { exact: false })).not.toHaveValue("");
  // At the top, where Sent from shows whole, the same each run.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await frame(page, "Sent from their Gmail", {
    window: true,
  });
  story("They give it a name of its own in place of the Gmail's. The preview's From line shows it.");

  // A name of its own, in place of the Gmail's, shown in the preview's From line.
  await page.getByLabel(copy.fromNameLabel, { exact: false }).fill("Sam Example, PauseAI UK");
  await expect
    .poll(() => runSql(flowDatabase, "SELECT from_name FROM mailings WHERE title = 'See you in Edinburgh'"))
    .toEqual(["Sam Example, PauseAI UK"]);
  await expect(page.getByRole("status").first()).toHaveText(copy.savePill.saved);
  const preview = page.getByRole("region", { name: copy.sections.preview });
  await expect(preview.getByText(`Sam Example, PauseAI UK <${staffEmail()}>`)).toBeVisible();
  // The same place each run, whatever scroll typing left.
  await from.evaluate((section) => section.scrollIntoView({ block: "center", behavior: "instant" }));
  await scrollSettled(page);
  await frame(page, "Sent from, with a name of its own", { window: true });
  story("They schedule it for 14:03, the hour's first run of the sending.");

  await page.getByLabel(copy.hour, { exact: false }).selectOption("14");
  await page.getByRole("button", { name: copy.schedule(1) }).click();
  // The draft's Send section shows the same day and time before it's scheduled, so the wait is for what only a
  // scheduled mailing's page has.
  await expect(page.getByRole("button", { name: copy.unschedule })).toBeVisible();
  await expect(page.getByText("Fri 16 Oct at 14:03", { exact: true })).toBeVisible();
  await frame(page, "The scheduled mailing");
  story("When its time comes, the sending job sends it from their Gmail.");

  // Its time come, the sending job starts it and sends it.
  const [id] = runSql(flowDatabase, "SELECT id FROM mailings WHERE title = 'See you in Edinburgh'");
  runSql(flowDatabase, `UPDATE mailings SET due_at = '2026-10-16T11:00:00Z' WHERE id = ${id}`);
  const sent = await request.post(`${BASE}/api/cron/send-mailings`, {
    headers: { Authorization: "Bearer fixture-cron-secret" },
  });
  expect(await sent.json()).toMatchObject({ started: [Number(id)], sent: 1, left: 0 });
  const letter = newestEmail((one) => one.To === '"Morag Example" <morag.example.msp@parliament.example>')!;
  expect(letter.From).toBe(`"Sam Example, PauseAI UK" <${staffEmail()}>`);
  await emailFrame(page, letter, "The email Morag gets");
  story("The mailing's page shows it sent, to its one recipient.");

  await reload(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("See you in Edinburgh");
  await expect(page.getByText("Fri 16 Oct at 14:03", { exact: true })).not.toBeVisible();
  await frame(page, "The sent mailing");
  story("Morag's letter's page shows it as it went, with no replies yet.");

  await page
    .getByRole("row", { name: /Morag Example/ })
    .getByRole("link", { name: staffVocabulary.theLetter })
    .click();
  // Her letter's page, not the mailing's still showing while it loads.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    lettersCopy.letters.oneTitle(lettersCopy.letters.fromPauseai, "Morag Example"),
  );
  // Its text is here, so there's no search for it in Gmail.
  await expect(page.getByRole("button", { name: lettersCopy.findInGmail.copy })).toHaveCount(0);
  await frame(page, "Morag's letter");
  story(
    "Morag replies. Within the hour their Gmail is read, and her reply shows under the letter, without the letter she quotes.",
  );

  // Morag answers, and the hourly read of your Gmail keeps her reply (lib/server/fixtures/letter-replies/).
  const letterId = page.url().split("/").at(-1);
  runSql(
    flowDatabase,
    `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, from_address, from_name, subject, at,
       from_us, blob_key, size)
     VALUES (${letterId}, '${staffEmail()}', 'reply-1', 'thread-1', 'morag.example.msp@parliament.example', 'Morag Example',
       'Re: See you in Edinburgh', '2026-10-16T15:00:00Z', false, 'fixture/morag-edinburgh.eml.gz', 512)`,
  );
  await reload(page);
  await expect(page.getByText("I look", { exact: false })).toBeVisible();
  // Her signature, and the letter she quotes, which is above it already, are folded away.
  await expect(page.getByText("Member of the Scottish Parliament for", { exact: false })).toBeHidden();
  await expect(page.getByText("We'd love to see you", { exact: false })).toBeHidden();
  await frame(page, "Morag's reply");
  story(
    "Her signature and the letter she quotes are folded under her reply, for anyone who wants her details or what she was answering.",
  );
  await page.getByText(lettersCopy.letterThread.quoted).click();
  const signature = page.getByText("Member of the Scottish Parliament for", { exact: false });
  await expect(signature).toBeVisible();
  await expect(page.getByText("We'd love to see you", { exact: false }).last()).toBeVisible();
  // The fold opened, in view whatever the window's height.
  await signature.evaluate((line) => line.scrollIntoView({ block: "start", behavior: "instant" }));
  await scrollSettled(page);
  await frame(page, "Her signature and the letter she quotes, unfolded");
});

test("Old mailings", async ({ page, request, flowDatabase }) => {
  story(
    "The mailings page lists every mailing PauseAI has sent politicians, by month, newest first. These were copied from Airtable.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  const mailings = mailingsCopy.mailings;
  addPauseaiEmails(flowDatabase);
  await page.goto(`${BASE}/staff/mailings`);
  const invitation = "Edinburgh Conference Nov 26 Invitation";
  await expect(page.getByRole("listitem").filter({ hasText: invitation })).toContainText(mailings.imported);
  await frame(page, "The mailings");

  story(
    "The Edinburgh conference invitation has no text, as Airtable kept none. Its page lists who it went to. A politician's history links back to it too.",
  );
  // Its title, not its box of counts, whose name says the title too.
  await page.getByRole("link", { name: invitation, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(invitation);
  await expect(page.getByText(mailings.noText)).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Polly Placeholder" })).toContainText(
    lettersCopy.letters.personalised,
  );
  await frame(page, "The invitation's page");

  await page.getByRole("link", { name: "Polly Placeholder" }).click();
  await page.locator("summary", { hasText: politiciansCopy.politician.historyTitle }).click();
  await page
    .getByRole("list", { name: politiciansCopy.politician.historyTitle })
    .getByRole("link", { name: invitation })
    .click();
  await expect(page).toHaveURL(/\/staff\/mailings\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(invitation);
});

/**
 * A sent mailing, Edinburgh follow-up, with one letter, to Polly
 * Placeholder, sent from `mailbox` as PauseAI UK, and her reply to it there
 * the next day, before the flow's now, which nobody has dealt with. Returns
 * the mailing's and the letter's IDs.
 */
function pollyReplied(database: string, mailbox: string): { mailing: string; letter: string } {
  const [mailing] = runSql(
    database,
    `INSERT INTO mailings (title, subject, audience, channel, filter, body, created_by, sent_from, from_name, due_at, state, ask)
     VALUES ('Edinburgh follow-up', 'Edinburgh follow-up', 'politicians', 'email', '{"list": "politicians", "params": {}}',
       '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Will you come and meet us?"}]}]}',
       'jo@pauseai.uk', '${mailbox}', 'PauseAI UK', '2026-10-14T08:00:00Z', 'sent', 'edinburgh-conference-2026')
     RETURNING id`,
  );
  const [letter] = runSql(
    database,
    `INSERT INTO letters (kind, notable_person_id, status, sent_at, replied_at)
     SELECT 'pauseai', id, 'sent', '2026-10-14T08:00:00Z', '2026-10-15T10:00:00Z' FROM notable_people
     WHERE name = 'Polly Placeholder' RETURNING id`,
  );
  runSql(
    database,
    `INSERT INTO letters_from_pauseai (id, mailing_id, merge_values) VALUES (${letter}, ${mailing}, '{}');
     INSERT INTO email_sends (at, purpose, letter_id, address, outcome, message_id, backend, sender, rfc_message_id, gmail_thread_id)
     SELECT '2026-10-14T08:00:00Z', 'mailing', ${letter}, lower(email), 'sent', 'gmail-flow-${letter}', 'gmail', '${mailbox}',
       'fixture-letter-3@pauseai.uk', 'thread-flow-${letter}' FROM notable_people WHERE name = 'Polly Placeholder';
     INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address, from_name,
       subject, at, from_us, blob_key, size)
     SELECT ${letter}, '${mailbox}', 'gmail-flow-reply-${letter}', 'thread-flow-${letter}', 'fixture-polly-thanks@example.org',
       lower(email), name, 'Re: Edinburgh follow-up', '2026-10-15T10:00:00Z', false, 'fixture/polly-thanks.eml.gz', 512
     FROM notable_people WHERE name = 'Polly Placeholder';`,
  );
  return { mailing, letter };
}

test("A politician's reply to check", async ({ page, request, flowDatabase }) => {
  story(
    "Polly Placeholder answered a mailing's letter, which went from your own Gmail. Nobody has dealt with her reply, so the staff home lists it, with how many wait.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  // Their account, with their Gmail connected, as they'd connect it on /staff/me.
  connectGmail(flowDatabase, staffEmail());
  const { mailing, letter } = pollyReplied(flowDatabase, staffEmail());
  await logInAsStaff(page, BASE, staffEmail(), "/staff");
  const strip = page.getByRole("listitem").filter({ hasText: '"Edinburgh follow-up"' });
  await expect(strip).toBeVisible();
  await frame(page, "The staff home, with a reply to check");
  story("See replies opens the mailing's letters with a reply to check. Hers is in blue.");
  await strip.getByRole("link", { name: dashboardCopy.home.dashboard.actions.broadcastRepliesButton }).click();
  await expect(page).toHaveURL(`${BASE}/staff/mailings/${mailing}?tab=look`);
  await expect(page.getByRole("row").filter({ hasText: "Polly Placeholder" })).toBeVisible();
  await frame(page, "The mailing's replies to check");
  story(
    "Her letter's page has Reply and Nothing to do under her reply. Setting her answer to the ask, beside it, would deal with it too.",
  );
  await page.goto(`${BASE}/staff/mailings/${mailing}/letters/${letter}`);
  const answers = mailingsCopy.answers;
  await expect(page.getByRole("button", { name: answers.reply })).toBeVisible();
  await frame(page, "Her reply, waiting");
  story("Reply opens an answer at the foot of the thread, from the mailbox her reply came to, in the mailing's name.");
  await page.getByRole("button", { name: answers.reply }).click();
  const editor = page.getByRole("textbox", { name: answers.answerLabel });
  await expect(editor).toBeFocused();
  await editor.pressSequentially("Dear Ms Placeholder, thank you. Would Tuesday at 2pm suit you?");
  await editor.evaluate((box) => box.scrollIntoView({ block: "end", behavior: "instant" }));
  await frame(page, "Writing an answer", { window: true });
  story("Sent, it's in the thread, saying who sent it, and her letter is no longer to check.");
  await page.getByRole("button", { name: answers.send }).click();
  await expect(page.getByText(answers.sentBy(staffEmail()))).toBeVisible();
  await frame(page, "The answer, sent");
});

test("A reply to someone else's mailbox", async ({ page, request, flowDatabase }) => {
  story(
    "Polly's reply came to Jo's own Gmail, so only Jo can answer it from the site. Anyone else is told so, and can say there's nothing to do.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  const { mailing, letter } = pollyReplied(flowDatabase, "jo@pauseai.uk");
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/mailings/${mailing}/letters/${letter}`);
  const answers = mailingsCopy.answers;
  await expect(page.getByText(answers.answerElsewhere("jo@pauseai.uk"))).toBeVisible();
  await frame(page, "Only Jo can reply");
  story("Nothing to do deals with it, and says who said so.");
  await page.getByRole("button", { name: answers.nothing }).click();
  // Said by this flow's staff member, at whatever time.
  await expect(page.getByText(answers.nothingDone(staffEmail(), ""))).toBeVisible();
  await frame(page, "Nothing to do, said");
});

test("Setting the answer from a reply", async ({ page, request, flowDatabase }) => {
  story(
    "Polly's reply says she'll come to the Edinburgh conference. Set answer, under her reply, opens the ask's form there, so her answer is set without going back up the page.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  const { mailing, letter } = pollyReplied(flowDatabase, "jo@pauseai.uk");
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/mailings/${mailing}/letters/${letter}`);
  const words = politiciansCopy.politician;
  const set = page.getByRole("button", { name: words.setAnswer });
  await expect(set).toBeVisible();
  await set.evaluate((button) => button.scrollIntoView({ block: "center", behavior: "instant" }));
  await frame(page, "Set answer, under her reply", { window: true });
  story("It opens the form, under who asked her what. They pick Going, with a note, and save.");
  await openBubble(set);
  const form = page.locator("#set-answer-edinburgh-conference-2026");
  await form.getByRole("radio", { name: staffVocabulary.statuses.going }).click();
  await form.getByLabel(words.note).fill("Said yes in her reply");
  await frame(page, "The answer's form, under her reply", { window: true });
  story("Saved, the ask says she's going.");
  await form.getByRole("button", { name: words.save }).click();
  // The answer, before the card's own form, which offers it too.
  await expect(
    page.locator("#ask-title").locator("..").getByText(staffVocabulary.statuses.going).first(),
  ).toBeVisible();
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await frame(page, "Her answer, set");
});

test("From a mailing to its ask", async ({ page, request, flowDatabase }) => {
  story("The invitation names its ask. Following it opens the Edinburgh conference's page.");
  await importPoliticians(request, BASE, flowDatabase);
  recordAnswers(flowDatabase);
  await logIn(page, flowDatabase);
  addPauseaiEmails(flowDatabase);
  await page.goto(`${BASE}/staff/mailings`);
  await page
    .getByRole("listitem")
    .filter({ hasText: "Edinburgh Conference Nov 26 Invitation" })
    .getByRole("link", { name: "Edinburgh conference", exact: true })
    .click();
  await expect(page).toHaveURL(`${BASE}/staff/asks/edinburgh-conference-2026`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Edinburgh conference");
  await frame(page, "The conference's page");
  story("On its page, each answer's column heading lists those who gave it. One is going.");
  await page.getByRole("link", { name: new RegExp(`^${staffVocabulary.statuses.going} \\d`) }).click();
  await expect(page).toHaveURL(/answer=going/);
  await expect(page.getByRole("row").filter({ hasText: "Morag Example" })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(2);
  await frame(page, "The politicians going");
});

test("A scheduled mailing a colleague unschedules meanwhile", async ({ page, request, flowDatabase }) => {
  story(
    "Two reminders are scheduled. Staff open the first and choose a new time for it. Before they press Change it, a colleague unschedules the mailing.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  const [first, second] = ["Edinburgh reminder", "Edinburgh last call"].map((title) =>
    addMailing(flowDatabase, title, "scheduled", ["scheduled", "scheduled", "scheduled"]),
  );
  runSql(flowDatabase, `UPDATE mailings SET due_at = '2026-10-30T09:00:00Z' WHERE id IN (${first}, ${second})`);
  await page.goto(`${BASE}/staff/mailings/${first}`);
  await openBubble(page.getByRole("button", { name: copy.changeTime }));
  await page.getByLabel(copy.hour, { exact: false }).selectOption("14");
  unscheduleElsewhere(flowDatabase, first);
  story(
    "Change it can't change the time, and the page says why at its top. Under that is the mailing as it is now, a draft again.",
  );
  await page.getByRole("button", { name: copy.saveTime }).click();
  await expect(saidAtTop(page, refusals.reschedule.gone)).toBeVisible();
  await expect(page.getByRole("status").first()).toHaveText(copy.savePill.saved);
  await frame(page, "No longer scheduled, said at the top");
  story(
    "They open the second, which the colleague unschedules too before they press Unschedule. There was nothing left to stop, and the page says so.",
  );
  await page.goto(`${BASE}/staff/mailings/${second}`);
  await expect(page.getByRole("button", { name: copy.unschedule })).toBeVisible();
  unscheduleElsewhere(flowDatabase, second);
  await page.getByRole("button", { name: copy.unschedule }).click();
  await expect(saidAtTop(page, refusals.stop.gone)).toBeVisible();
  await expect(page.getByRole("status").first()).toHaveText(copy.savePill.saved);
  await frame(page, "Nothing left to stop, said at the top");
});

test("A new time that has passed", async ({ page, request, flowDatabase }) => {
  story(
    "A reminder is scheduled for 17:03 today. Staff open Change the time and choose an earlier one, which has passed by the time they press Change it.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  const id = addMailing(flowDatabase, "Edinburgh reminder", "scheduled", ["scheduled", "scheduled", "scheduled"]);
  runSql(flowDatabase, `UPDATE mailings SET due_at = '2026-10-16T16:00:00Z' WHERE id = ${id}`);
  await page.goto(`${BASE}/staff/mailings/${id}`);
  await openBubble(page.getByRole("button", { name: copy.changeTime }));
  // The form's clock put three hours behind the site's, at 10:00 in London, so it offers 11:03, which the site has
  // as gone. Its hours are drawn again for that clock once one is chosen.
  await page.clock.setFixedTime(new Date("2026-10-16T09:00:00Z"));
  const hour = page.getByLabel(copy.hour, { exact: false });
  await hour.selectOption("18");
  await hour.selectOption("11");
  await page.getByRole("button", { name: copy.saveTime }).click();
  await expect(page.getByRole("alert").filter({ hasText: refusals.reschedule["too-soon"] })).toBeVisible();
  await frame(page, "The time has passed, said under it", { window: true });
  story("The mailing still goes at 17:03.");
  expect(runSql(flowDatabase, `SELECT due_at = '2026-10-16T16:00:00Z' FROM mailings WHERE id = ${id}`)).toEqual(["t"]);
});

test("Choosing who for a mailing a colleague deletes meanwhile", async ({ page, request, flowDatabase }) => {
  story(
    "Staff press Mail these on the Lords, and the list starts choosing who the new mailing is for. A colleague, on the mailings page, deletes the new draft.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  /** Deletes the draft the list is choosing for, as the colleague's Delete draft does. */
  const deleteElsewhere = () =>
    runSql(flowDatabase, `DELETE FROM mailings WHERE id = ${new URL(page.url()).searchParams.get("mailing")}`);
  await page.goto(`${BASE}/staff/politicians?house=lords`);
  await page.getByRole("button", { name: choosing.mailThese(1) }).click();
  await expect(page.getByText(choosing.choosingNew)).toBeVisible();
  await expect(page).toHaveURL(/mailing=\d+/);
  deleteElsewhere();
  story(
    "They untick the one lord it found. The tick can't be saved, and the page says why at its top. The list is no longer choosing.",
  );
  const lord = page.getByRole("checkbox", { name: choosing.tick("Lord Seedling of Example") });
  await lord.click();
  await expect(saidAtTop(page, choosing.gone)).toBeVisible();
  await expect(lord).toHaveCount(0);
  await expect(page.getByText(choosing.choosingNew)).toHaveCount(0);
  await frame(page, "Gone, said at the top");
  story(
    "They start again from the Commons, and paste a name to find. The colleague deletes that draft too, before they press Find these, and the page says the same.",
  );
  await page.goto(`${BASE}/staff/politicians?house=commons`);
  await page.getByRole("button", { name: choosing.mailThese(3) }).click();
  await expect(page.getByText(choosing.choosingNew)).toBeVisible();
  await expect(page).toHaveURL(/mailing=\d+/);
  await openBubble(page.getByRole("button", { name: choosing.pasteNames }));
  await page.getByRole("textbox", { name: choosing.pasteLabel }).fill("Polly Placeholder");
  deleteElsewhere();
  await page.getByRole("button", { name: choosing.pasteTick }).click();
  await expect(saidAtTop(page, choosing.gone)).toBeVisible();
  await expect(page.getByText(choosing.choosingNew)).toHaveCount(0);
  await frame(page, "Gone again, said at the top");
});

test("A draft a colleague schedules meanwhile", async ({ page, request, flowDatabase }) => {
  story(
    "Staff copy the Edinburgh invitation to send a reminder. While they look over the draft, a colleague who has it open too schedules it.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  recordAnswers(flowDatabase);
  await logIn(page, flowDatabase);
  const sent = addMailing(flowDatabase, "Edinburgh invitation", "sent", ["sent", "sent", "sent", "sent"]);
  /** Copies the invitation, and says the draft's ID once its page has come. */
  const copyIt = async (not: string[]) => {
    await page.goto(`${BASE}/staff/mailings/${sent}`);
    await page.getByRole("button", { name: copy.copyMailing }).click();
    await expect(page).not.toHaveURL(new RegExp(`/staff/mailings/(${not.join("|")})$`));
    await expect(page).toHaveURL(/\/staff\/mailings\/\d+$/);
    await expect(page.getByLabel(copy.subject)).toHaveValue("Edinburgh invitation");
    return page.url().split("/").at(-1)!;
  };
  const reminder = await copyIt([sent]);
  scheduleElsewhere(flowDatabase, reminder);
  story(
    "Leave them out, under the warning about those who've already answered, can't change who it's for any more. The page says why at its top, over the mailing as it is now: scheduled.",
  );
  await page
    .locator("[data-strip]")
    .filter({ hasText: /already given an answer/ })
    .getByRole("button", { name: copy.leaveThemOut })
    .click();
  await expect(saidAtTop(page, choosing.gone)).toBeVisible();
  await expect(page.getByRole("button", { name: copy.unschedule })).toBeVisible();
  await frame(page, "Scheduled meanwhile, said at the top");
  story(
    "They copy the invitation again, then think better of it. The colleague schedules that copy too before they press Delete draft twice. It isn't deleted, and the page says what to do first.",
  );
  scheduleElsewhere(flowDatabase, await copyIt([sent, reminder]));
  await page.getByRole("button", { name: copy.deleteDraft }).click();
  await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
  await expect(saidAtTop(page, refusals.deleteDraft["not-draft"])).toBeVisible();
  await expect(page.getByRole("button", { name: copy.unschedule })).toBeVisible();
  await frame(page, "Not deleted, said at the top");
});

test("A test copy for someone who's no longer a recipient", async ({ page, request, flowDatabase }) => {
  story(
    "Staff copy the Edinburgh invitation, and its preview shows the first recipient's email. A colleague takes that politician's email address off their page, so the mailing no longer goes to them.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  const sent = addMailing(flowDatabase, "Edinburgh invitation", "sent", ["sent", "sent", "sent", "sent"]);
  await page.goto(`${BASE}/staff/mailings/${sent}`);
  await page.getByRole("button", { name: copy.copyMailing }).click();
  await expect(page).not.toHaveURL(new RegExp(`/staff/mailings/${sent}$`));
  await expect(page.getByLabel(copy.subject)).toHaveValue("Edinburgh invitation");
  const preview = page.getByRole("region", { name: copy.sections.preview });
  const whose = preview.getByRole("combobox", { name: copy.chooseRecipient });
  const shown = await whose.inputValue();
  runSql(flowDatabase, `UPDATE notable_people SET email = NULL WHERE id = ${shown}`);
  story(
    "Send test can't send their email, and says so under the button. The preview moves on to someone the mailing still goes to.",
  );
  const sendTest = preview.getByRole("button", { name: copy.sendTest });
  await sendTest.click();
  await expect(preview.getByText(refusals.test["not-recipient"])).toBeVisible();
  await expect(whose).not.toHaveValue(shown);
  await sendTest.evaluate((button) => button.scrollIntoView({ block: "center", behavior: "instant" }));
  await scrollSettled(page);
  await frame(page, "Not sent, said under Send test", { window: true });
});

test("A reply a colleague deals with meanwhile", async ({ page, request, flowDatabase }) => {
  story(
    "Polly's reply to a mailing's letter came to Jo's Gmail. Staff open her letter's page. Before they press Nothing to do, Jo says so first.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  const { mailing, letter } = pollyReplied(flowDatabase, "jo@pauseai.uk");
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/mailings/${mailing}/letters/${letter}`);
  const nothing = page.getByRole("button", { name: mailingsCopy.answers.nothing });
  await expect(nothing).toBeVisible();
  runSql(
    flowDatabase,
    `UPDATE letter_replies SET dealt_by = 'jo@pauseai.uk', dealt_at = '2026-10-16T11:30:00Z' WHERE letter_id = ${letter}`,
  );
  story("There's nothing left to mark. The page says so at its top, and under her reply, who dealt with it.");
  await nothing.click();
  await expect(saidAtTop(page, refusals.nothingToDo.gone)).toBeVisible();
  await expect(nothing).toHaveCount(0);
  await frame(page, "Already dealt with, said at the top");
});

test("Scheduling a draft a colleague has changed", async ({ page, request, flowDatabase }) => {
  story(
    "Staff write a mailing to a politician in Scotland, from their Gmail, and choose when it goes. A colleague with the same draft open changes its subject.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  // Their account, with their Gmail connected, as they'd connect it on /staff/me, so the mailing has one to go from.
  connectGmail(flowDatabase, staffEmail());
  await logIn(page, flowDatabase);
  await startFromList(page, "nation=scotland", 1);
  await page.getByLabel(copy.subject).fill("See you in Edinburgh");
  await caretAtEnd(page.getByRole("textbox", { name: copy.letter }));
  await page.keyboard.type("We hope to see you there.");
  await page.getByLabel(copy.hour, { exact: false }).selectOption("14");
  await expect(page.getByRole("status").first()).toHaveText(copy.savePill.saved);
  runSql(
    flowDatabase,
    `UPDATE mailings SET subject = 'See you in Glasgow', title = 'See you in Glasgow', version = version + 1
     WHERE id = ${page.url().split("/").at(-1)}`,
  );
  story(
    "Schedule doesn't schedule it as they see it, which isn't how it is any more. The page says it changed somewhere else, and to reload it.",
  );
  const schedule = page.getByRole("button", { name: copy.schedule(1) });
  await schedule.click();
  await expect(page.getByRole("alert").filter({ hasText: copy.saveStates.conflict })).toBeVisible();
  await expect(schedule).toBeEnabled();
  await toTheTop(page);
  await frame(page, "Changed somewhere else, said over the draft");
});
