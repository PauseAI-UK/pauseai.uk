import type { Page } from "@playwright/test";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { runSql } from "@/scripts/fresh-database.mjs";
import { addFilter, changeFilter } from "./list-steps";
import { lockTable } from "./loading-steps";
import { logIn, staffEmail } from "./login-steps";
import { importPoliticians } from "./politician-steps";
import { importLuma } from "./supporter-steps";
import { BASE, expect, frame, story, test } from "./fixtures";
import { openBubble } from "./settle";
import type { Section } from "./report/frames";
import { politiciansCopy } from "@/app/(staff)/staff/_components/politicians/copy";
import { mailingsCopy } from "@/app/(staff)/staff/_components/mailings/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

export const section: Section = { name: "Saved filters", part: "Staff pages", order: 60 };

// Saved filters on the staff lists: saving what's on, loading it, editing it,
// finding one, and what happens when part of one has gone.

const copy = staffVocabulary.filters.saved;

const POLITICIANS = `${BASE}/staff/politicians`;

/** Adds a saved filter, as a colleague made it, and returns its ID. */
function addSaved(database: string, list: string, name: string, params: object, by = "sam.jones@pauseai.uk"): string {
  const [id] = runSql(
    database,
    `INSERT INTO saved_filters (list, name, params, created_by) VALUES ('${list}', '${name}', '${JSON.stringify(params)}', '${by}') RETURNING id`,
  );
  return id;
}

/** Opens the list of saved filters, a menu, as every flow opens one (openBubble). */
const openList = (page: Page) => openBubble(page.getByRole("button", { name: copy.chip, exact: true }));
const save = (page: Page) => page.getByRole("button", { name: copy.save, exact: true });
/** What the page says at its top of a filter that's gone: an alert, as Next's own announcer of the page's title is. */
const gone = (page: Page) => page.getByRole("alert").filter({ hasText: copy.refused.gone });

test("Saving a filter", { tag: "@phone" }, async ({ page, request, flowDatabase }) => {
  story("Nothing's on the politicians list, so there's nothing to save: the chip is only the way to saved filters.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(POLITICIANS);
  await expect(save(page)).toHaveCount(0);
  await frame(page, "Nothing on");

  story("With no saved filters yet, its list says how to start.");
  await openList(page);
  await expect(page.getByText(copy.none)).toBeVisible();
  await frame(page, "None saved");
  await page.keyboard.press("Escape");

  story("Staff choose a party. Save appears as the chip's second half.");
  await addFilter(page, staffVocabulary.fields.party, "Labour");
  await expect(save(page)).toBeVisible();
  await frame(page, "A filter on, and Save");

  story("Save opens a small form, with a name filled in from the filters, ready to type over.");
  const form = await openBubble(save(page));
  const name = form.getByRole("textbox", { name: copy.name });
  await expect(name).toHaveValue(`${staffVocabulary.fields.party}: Labour`);
  await frame(page, "Naming it");

  story("Saving loads it, and the chip is named for it, with nothing left to save.");
  await name.fill("Labour MPs");
  const saving = await lockTable(flowDatabase, "saved_filters");
  const saveIt = form.getByRole("button", { name: copy.save, exact: true });
  await saveIt.click();
  await expect(saveIt).toHaveAttribute("aria-busy", "true");
  await frame(page, "Saving, the form still up", { window: true });
  await saving();
  await expect(page).toHaveURL(/saved=\d+/);
  await expect(page.getByRole("button", { name: "Labour MPs" })).toBeVisible();
  await expect(save(page)).toHaveCount(0);
  await frame(page, "Saved and loaded");

  story("Clear filters takes away the filter and unloads it.");
  await page.getByRole("link", { name: staffVocabulary.resetFilters }).click();
  await expect(page).toHaveURL(POLITICIANS);
  await expect(page.getByRole("button", { name: copy.chip, exact: true })).toBeVisible();
  await frame(page, "Cleared");
});

test("Loading a saved filter, then editing it", { tag: "@phone" }, async ({ page, request, flowDatabase }) => {
  story("A colleague saved Labour MPs. It's in the list, with what it filters by, who made it and when.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  addSaved(flowDatabase, "politicians", "Labour MPs", { party: "Labour", house: "commons" });
  await page.goto(POLITICIANS);
  await openList(page);
  await frame(page, "The list");

  story("Loading it is a link. The chips and the tab are as they were saved.");
  await page.getByRole("link", { name: /Labour MPs/ }).click();
  await expect(page.getByRole("button", { name: "Labour MPs" })).toBeVisible();
  await expect(page.getByRole("button", { name: `${staffVocabulary.fields.party}: Labour` })).toBeVisible();
  await frame(page, "Loaded, unchanged");

  story("Staff add a filter. The chip says it's edited, and Save comes back, now a menu.");
  await addFilter(page, politiciansCopy.politician.country, staffVocabulary.countries.scotland);
  await expect(page.getByRole("button", { name: "Labour MPs" })).toContainText(copy.edited);
  await save(page).click();
  await expect(page.getByRole("button", { name: copy.update })).toBeVisible();
  await frame(page, "Edited, and its three choices");

  story("Undo my changes is a link back to the filter as it's stored.");
  await page.getByRole("link", { name: copy.undo }).click();
  await expect(page.getByRole("button", { name: "Labour MPs" })).not.toContainText(copy.edited);
  await frame(page, "Undone");

  story(
    "Staff add the filter again and update it for everyone. It's no longer edited, and loads with that filter from now on.",
  );
  await addFilter(page, politiciansCopy.politician.country, staffVocabulary.countries.scotland);
  await save(page).click();
  const updating = await lockTable(flowDatabase, "saved_filters");
  const update = page.getByRole("button", { name: copy.update });
  await update.click();
  await expect(update).toHaveAttribute("aria-busy", "true");
  await frame(page, "Updating, the menu still up", { window: true });
  story("The menu goes when that's done.");
  await updating();
  await expect(page.getByRole("button", { name: "Labour MPs" })).not.toContainText(copy.edited);
  await expect(save(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: `${politiciansCopy.politician.country}: ${staffVocabulary.countries.scotland}` }),
  ).toBeVisible();
  await frame(page, "Updated for everyone");

  story("Editing again, Save as new opens the same form, and loads the new one, leaving the first as it was.");
  await changeFilter(page, `${politiciansCopy.politician.country}: ${staffVocabulary.countries.scotland}`);
  await save(page).click();
  const asNew = await openBubble(page.getByRole("button", { name: copy.saveAsNew }));
  await asNew.getByRole("textbox", { name: copy.name }).fill("Labour MPs everywhere");
  await frame(page, "Saving as new");
  await asNew.getByRole("button", { name: copy.save, exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Labour MPs everywhere" })).toBeVisible();
  await frame(page, "The new one, loaded");
});

test("Finding a saved filter by name", async ({ page, request, flowDatabase }) => {
  story("There are several saved filters. Typing in the box over the list narrows them by name as it's typed.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  addSaved(flowDatabase, "politicians", "Conservatives who replied", { party: "Conservative" });
  addSaved(
    flowDatabase,
    "politicians",
    "Scottish MPs",
    { nation: "scotland", house: "commons" },
    "jo.brown@pauseai.uk",
  );
  addSaved(flowDatabase, "politicians", "Peers", { house: "lords" });
  await page.goto(POLITICIANS);
  await openList(page);
  await expect(page.getByText(copy.count(3))).toBeVisible();
  await frame(page, "All of them");
  await page.getByRole("searchbox", { name: copy.find }).fill("scot");
  await expect(page.getByRole("link", { name: /Scottish MPs/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Peers/ })).toBeHidden();
  await frame(page, "Narrowed by name");
});

test("Renaming and deleting a saved filter", async ({ page, request, flowDatabase }) => {
  story("A row's menu works on a saved filter without loading it.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  addSaved(flowDatabase, "politicians", "Peers", { house: "lords" });
  addSaved(flowDatabase, "politicians", "Scottish MPs", { nation: "scotland" });
  await page.goto(POLITICIANS);
  await openList(page);
  await page.getByRole("button", { name: copy.rowMenu("Peers") }).click();
  await expect(page.getByRole("button", { name: copy.deleteForEveryone })).toBeVisible();
  await frame(page, "A row's menu");

  story("Rename opens the name's form, filled in. Saving it changes the name for everyone, and stays on the page.");
  const rename = await openBubble(page.getByRole("button", { name: copy.rename, exact: true }));
  await rename.getByRole("textbox", { name: copy.name }).fill("Everyone in the Lords");
  await frame(page, "Renaming it");
  await rename.getByRole("button", { name: copy.save, exact: true }).last().click();
  await expect(page).toHaveURL(POLITICIANS);
  await expect(page.getByRole("searchbox", { name: copy.find })).toBeHidden();
  await openList(page);
  await expect(page.getByRole("link", { name: /Everyone in the Lords/ })).toBeVisible();
  await frame(page, "Renamed");

  story("Delete for everyone asks for a second press, as every delete does. It goes from the list.");
  await page.getByRole("button", { name: copy.rowMenu("Everyone in the Lords") }).click();
  await page.getByRole("button", { name: copy.deleteForEveryone }).click();
  await frame(page, "Asking again");
  const deleting = await lockTable(flowDatabase, "saved_filters");
  const deleteIt = page.getByRole("button", { name: staffVocabulary.deleteIt });
  await deleteIt.click();
  await expect(deleteIt).toHaveAttribute("aria-busy", "true");
  await frame(page, "Deleting, the menu still up", { window: true });
  await deleting();
  await expect(page.getByRole("link", { name: /Everyone in the Lords/ })).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: copy.find })).toBeHidden();
  await openList(page);
  await expect(page.getByText(copy.count(1))).toBeVisible();
  await frame(page, "Deleted");
});

test("A saved filter's name that's only spaces", async ({ page, request, flowDatabase }) => {
  story("Staff choose a party and save it, but clear the name and type only spaces. The form says it needs a name.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(POLITICIANS);
  await addFilter(page, staffVocabulary.fields.party, "Labour");
  const form = await openBubble(save(page));
  const name = form.getByRole("textbox", { name: copy.name });
  await name.fill("   ");
  const saveIt = form.getByRole("button", { name: copy.save, exact: true });
  await saveIt.click();
  await expect(form.getByRole("alert")).toHaveText(copy.refused.blank);
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await frame(page, "No name", { window: true });

  story("With a name, it saves and loads as ever.");
  await name.fill("Labour MPs");
  await saveIt.click();
  await expect(page).toHaveURL(/saved=\d+/);
  await expect(page.getByRole("button", { name: "Labour MPs" })).toBeVisible();
  await frame(page, "Saved and loaded");

  story("Renaming it to nothing but spaces is refused the same way, and its name stays.");
  await page.getByRole("button", { name: "Labour MPs" }).click();
  await page.getByRole("button", { name: copy.rowMenu("Labour MPs") }).click();
  const rename = await openBubble(page.getByRole("button", { name: copy.rename, exact: true }));
  await rename.getByRole("textbox", { name: copy.name }).fill("  ");
  await rename.getByRole("button", { name: copy.save, exact: true }).last().click();
  await expect(rename.getByRole("alert")).toHaveText(copy.refused.blank);
  await frame(page, "No new name", { window: true });
});

test("A saved filter a colleague deletes meanwhile", async ({ page, request, flowDatabase }) => {
  story("Staff load a colleague's filter, Labour MPs, and add to it. Before they save, the colleague deletes it.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  const labour = addSaved(flowDatabase, "politicians", "Labour MPs", { party: "Labour", house: "commons" });
  addSaved(flowDatabase, "politicians", "Peers", { house: "lords" });
  await page.goto(POLITICIANS);
  await openList(page);
  await page.getByRole("link", { name: /Labour MPs/ }).click();
  await expect(page.getByRole("button", { name: `${staffVocabulary.fields.party}: Labour` })).toBeVisible();
  await addFilter(page, politiciansCopy.politician.country, staffVocabulary.countries.scotland);
  await expect(page.getByRole("button", { name: "Labour MPs" })).toContainText(copy.edited);
  await save(page).click();
  await expect(page.getByRole("button", { name: copy.update })).toBeVisible();
  runSql(flowDatabase, `DELETE FROM saved_filters WHERE id = ${labour}`);

  story("Update for all can't, and the page says why at its top. Their filters are still on, to save as a new one.");
  await page.getByRole("button", { name: copy.update }).click();
  await expect(gone(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Labour MPs" })).toHaveCount(0);
  await expect(save(page)).toBeVisible();
  await frame(page, "Gone, said at the top");

  story("The same happens renaming one that's gone: the colleague deletes Peers while its name's form is open.");
  await openList(page);
  await page.getByRole("button", { name: copy.rowMenu("Peers") }).click();
  const rename = await openBubble(page.getByRole("button", { name: copy.rename, exact: true }));
  await rename.getByRole("textbox", { name: copy.name }).fill("Everyone in the Lords");
  runSql(flowDatabase, "DELETE FROM saved_filters");
  await expect(gone(page)).toBeVisible();
  await rename.getByRole("button", { name: copy.save, exact: true }).last().click();
  await expect(page.getByRole("searchbox", { name: copy.find })).toBeHidden();
  await expect(gone(page)).toBeVisible();
  await openList(page);
  await expect(page.getByText(copy.none)).toBeVisible();
  await frame(page, "Gone, and the list without it");
});

test("A saved filter naming something that has gone", async ({ page, request, flowDatabase }) => {
  story(
    "A saved filter names a party no politician belongs to any more. Loading it leaves that out, and says so over the list, which may be longer than it was.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  const id = addSaved(flowDatabase, "politicians", "Reform Group and important", {
    party: ["Reform Group"],
    flag: "important",
  });
  await page.goto(`${POLITICIANS}?party=Reform+Group&flag=important&saved=${id}`);
  await expect(page.getByText(copy.gone(`${staffVocabulary.fields.party}: Reform Group`))).toBeVisible();
  await expect(page.getByRole("button", { name: `${staffVocabulary.fields.party}: Reform Group` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reform Group and important" })).not.toContainText(copy.edited);
  await frame(page, "What has gone, said");
});

test("Who can see saved filters", async ({ page, request, flowDatabase }) => {
  story(
    "Saved filters on Supporters are for those who can open it. Someone with the permission sees one, with the search and Near filter it saved.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase, ["supporters"]);
  const id = addSaved(flowDatabase, "supporters", "Near Manchester", { near: "Manchester", within: "25", q: "jane" });
  await page.goto(`${BASE}/staff/supporters?near=Manchester&within=25&q=jane&saved=${id}`);
  await expect(page.getByRole("button", { name: "Near Manchester" })).toBeVisible();
  await frame(page, "With the permission, on Supporters");

  story("The same link on Politicians loads nothing: a saved filter belongs to its own list.");
  await page.goto(`${POLITICIANS}?saved=${id}`);
  await expect(page.getByRole("button", { name: copy.chip, exact: true })).toBeVisible();
  await openList(page);
  await expect(page.getByText(copy.none)).toBeVisible();
  await frame(page, "Not on another list");

  story("Staff without the permission are turned away from Supporters, as ever, link or no link.");
  runSql(flowDatabase, `UPDATE staff_accounts SET permissions = '{}' WHERE email = '${staffEmail()}'`);
  await page.goto(`${BASE}/staff/supporters?saved=${id}`);
  await expect(page).toHaveURL(`${BASE}/staff`);
  await frame(page, "Without the permission");
});

test("A saved filter on Events", async ({ page, flowDatabase }) => {
  story("Events has saved filters too, kept with their tab. Saving what's on the Past tab keeps it there.");
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/events?when=past&q=talk`);
  const form = await openBubble(save(page));
  await form.getByRole("textbox", { name: copy.name }).fill("Past talks");
  await frame(page, "Saving it");
  await form.getByRole("button", { name: copy.save, exact: true }).click();
  await expect(page.getByRole("button", { name: "Past talks" })).toBeVisible();
  await expect(page).toHaveURL(/when=past/);
  await frame(page, "Loaded, on its tab");
});

test("Loading a saved filter while choosing who a mailing goes to", async ({ page, request, flowDatabase }) => {
  story(
    "Staff start a new mailing, and from its draft press Choose who: the list is choosing who it's for. A saved filter loads as usual.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  addSaved(flowDatabase, "politicians", "Labour MPs", { party: "Labour", house: "commons" });
  await page.goto(POLITICIANS);
  await page.getByRole("button", { name: /New mailing/ }).click();
  await page.getByRole("link", { name: mailingsCopy.mailingPages.chooseWho }).click();
  await expect(page.getByText(politiciansCopy.choosing.choosingNew)).toBeVisible();
  await openList(page);
  await frame(page, "Choosing, with the list open");

  story("Loading it keeps the mailing: the list is still choosing for it, with its boxes to tick.");
  await page.getByRole("link", { name: /Labour MPs/ }).click();
  await expect(page).toHaveURL(/mailing=\d+.*saved=\d+/);
  await expect(page.getByText(politiciansCopy.choosing.choosingNew)).toBeVisible();
  await expect(page.getByRole("button", { name: "Labour MPs" })).toBeVisible();
  await frame(page, "Still choosing, the filter loaded");

  story("On the tab of those ticked, the filters aren't what's chosen, so the bar and the chip are gone.");
  await page.getByRole("link", { name: politiciansCopy.choosing.pickedTab }).first().click();
  await expect(page.getByRole("button", { name: "Labour MPs" })).toHaveCount(0);
  await frame(page, "The ticked tab");
});

test("Loading a saved filter while choosing who a broadcast goes to", async ({ page, request, flowDatabase }) => {
  story("Staff write an email to supporters, then Narrow down: the supporters list is choosing who it's for.");
  const broadcasts = broadcastsCopy.broadcastPages;
  await importLuma(request, BASE);
  await logIn(page, flowDatabase, ["supporters"]);
  addSaved(flowDatabase, "supporters", "Fixture emails", { contact: "email:events:yes", q: "fixture" });
  await page.goto(`${BASE}/staff/supporters?contact=email%3Aevents%3Ayes`);
  await page.getByRole("button", { name: broadcasts.broadcastButton(3) }).click();
  await expect(page).toHaveURL(/\/staff\/broadcasts\/\d+$/);
  await page.getByLabel(broadcasts.subject).fill("Saved for later");
  await expect(page.getByRole("status").first()).toHaveText(mailingsCopy.mailingPages.savePill.saved);
  await page.getByRole("link", { name: broadcasts.narrowDown }).click();
  await expect(page.getByText(broadcasts.choosing("Saved for later"))).toBeVisible();
  await openList(page);
  await frame(page, "Choosing, with the list open", { window: true });

  story("Loading one keeps the message: the list is still choosing for it, and the bar counts who the filter finds.");
  await page.getByRole("link", { name: /Fixture emails/ }).click();
  await expect(page).toHaveURL(/broadcast=\d+.*saved=\d+/);
  await expect(page.getByText(broadcasts.choosing("Saved for later"))).toBeVisible();
  await expect(page.getByRole("button", { name: "Fixture emails" })).toBeVisible();
  const bar = page.getByRole("region", { name: broadcasts.choosingLabel });
  await expect(bar.getByRole("button", { name: broadcasts.useThese(3) })).toBeVisible();
  await frame(page, "Still choosing, the filter loaded", { window: true });

  story("Using them takes the draft those the filter found.");
  await bar.getByRole("button", { name: broadcasts.useThese(3) }).click();
  await expect(page).toHaveURL(/\/staff\/broadcasts\/\d+$/);
  await expect(page.getByRole("list", { name: mailingsCopy.mailingPages.whoLabel })).toContainText("fixture");
  await frame(page, "The draft, to those found");
});
