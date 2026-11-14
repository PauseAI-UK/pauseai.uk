import { jobTitles, staffCopy } from "@/lib/content/staff-interface";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { runSql } from "@/scripts/fresh-database.mjs";
import { holdNextPage, loadingLine, lockTable, settled } from "./loading-steps";
import { logIn, staffEmail } from "./login-steps";
import { importPoliticians, PM_LETTER } from "./politician-steps";
import { importLuma } from "./supporter-steps";
import { BASE, expect, frame, story, test } from "./fixtures";
import type { Section } from "./report/frames";
import { shellCopy } from "@/app/(staff)/staff/_components/shell/copy";
import { politiciansCopy } from "@/app/(staff)/staff/_components/politicians/copy";
import { asksCopy } from "@/lib/asks/copy";
import { lettersCopy } from "@/app/(staff)/staff/_components/letters/copy";

export const section: Section = { name: "Dashboard and getting around", part: "Staff pages", order: 20 };

// Finding your way round the staff pages: the dashboard's tiles, the sidebar
// folded and followed, a list sorted or searched, a politician's page,
// setting a status that shows on the public campaigns, and the new tag. Each flow on its own
// database.

test("Folding the sidebar", { tag: "@desktop-only" }, async ({ page, flowDatabase }) => {
  story("The sidebar lists the staff pages, each with its icon. A round button on its edge folds it.");
  await logIn(page, flowDatabase, ["supporters", "admin"]);
  await page.goto(`${BASE}/staff/politicians`);
  const nav = page.getByRole("navigation", { name: shellCopy.nav.title });
  await expect(nav.getByRole("link", { name: shellCopy.nav.supporters })).toBeVisible();
  await frame(page, "The sidebar");
  story("Folded, it's a strip of icons, each at the height it was, and the page is wider.");

  // Folding moves the icons sideways only: each stays at the height it was.
  const heights = () =>
    nav.locator("li svg, form svg").evaluateAll((icons) => icons.map((icon) => icon.getBoundingClientRect().top));
  const open = await heights();
  await nav.getByRole("button", { name: shellCopy.nav.fold }).click();
  await expect(nav.getByRole("button", { name: shellCopy.nav.unfold })).toBeVisible();
  await expect(nav.getByRole("heading", { name: shellCopy.nav.sections.admin })).toBeHidden();
  expect(await heights()).toEqual(open);
  await frame(page, "The sidebar, folded");
  story("Tabbing to an icon, or hovering over it, shows the page's name beside it.");

  // Hovered, not tabbed to: Chromium now and then took the focus from the link, natively, a second or so after
  // it was given, with nothing else focused, so a focused link's label was in some pictures and not others.
  const supporters = nav.getByRole("link", { name: shellCopy.nav.supporters });
  await supporters.hover();
  await expect
    .poll(() => supporters.locator("[class*=label]").evaluate((l) => l.getBoundingClientRect().width))
    .toBeGreaterThan(1);
  await frame(page, "A page's name", { hover: supporters });
  story("The next page opens with the sidebar still folded.");

  await nav.getByRole("link", { name: shellCopy.nav.supporters }).click();
  await expect(page).toHaveURL(`${BASE}/staff/supporters`);
  await expect(nav.getByRole("button", { name: shellCopy.nav.unfold })).toBeVisible();
  await frame(page, "The next page");
  story("The same button unfolds it.");

  await nav.getByRole("button", { name: shellCopy.nav.unfold }).click();
  await expect(nav.getByRole("heading", { name: shellCopy.nav.sections.admin })).toBeVisible();
});

test("Sorting and searching", async ({ page, flowDatabase }) => {
  story("Staff look at the test politicians, sorted by name, A to Z.");
  // The line along the top slides while it waits; held still, so each frame of it is the same.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await logIn(page, flowDatabase, ["supporters", "admin"]);
  await page.goto(`${BASE}/staff/politicians?flag=test`);
  await frame(page, "The test politicians");
  story(
    "Clicking Name again turns its arrow at once. The rows stay as they were, with a line along the top, until Z to A arrives.",
  );

  // A sort heading: its arrow turns at once; the rows stay as they were.
  let next = await holdNextPage(page, /sort=name&dir=desc/);
  const name = page.getByRole("table").getByRole("link", { name: staffVocabulary.fields.name });
  await name.click();
  await expect(name).toHaveAttribute("data-pending", "true");
  await expect(name).toContainText("▼");
  await expect.poll(() => loadingLine(page)).toBe(true);
  await frame(page, "Sorting Z to A");
  story("A search shows the same line along the top while it looks.");
  await next.release();
  await expect(page).toHaveURL(/sort=name&dir=desc/);
  await expect.poll(() => loadingLine(page)).toBe(false);

  // A search, sent from its box without leaving the page.
  next = await holdNextPage(page, /q=Testy/);
  await page.getByRole("searchbox").fill("Testy");
  await page.getByRole("button", { name: staffVocabulary.search }).click();
  await expect.poll(() => loadingLine(page)).toBe(true);
  await frame(page, "Searching");
  story("Then what it found.");
  await next.release();
  await expect(page).toHaveURL(/q=Testy/);
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await settled(page);
  await frame(page, "The search's results");
});

test("Following a sidebar link", async ({ page, flowDatabase }) => {
  story(
    "Staff click Asks in the sidebar (on a phone, in the menu). The page is slow to come, so Asks is marked at once, and a line along the top shows it's on its way.",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await logIn(page, flowDatabase, ["supporters", "admin"]);
  await page.goto(`${BASE}/staff/politicians`);
  // In the sidebar; on a phone, behind the bar's menu.
  const asks = page
    .getByRole("navigation", { name: shellCopy.nav.title })
    .getByRole("link", { name: shellCopy.nav.asks });
  if (!(await asks.first().isVisible())) await page.locator("nav details > summary").click();

  // The Asks page waits on its table, as on a slow database.
  const release = await lockTable(flowDatabase, "asks");
  await asks.filter({ visible: true }).click();
  await expect(asks.filter({ visible: true })).toHaveAttribute("data-pending", "true");
  await expect(page.getByRole("heading", { level: 1, name: politiciansCopy.politicians.title })).toBeVisible();
  await expect.poll(() => loadingLine(page)).toBe(true);
  await frame(page, "Asks, on its way");
  story("Then the Asks page arrives.");
  await release();
  await expect(page.getByRole("heading", { level: 1, name: asksCopy.asks.title })).toBeVisible();
  await frame(page, "The Asks page");
});

test("The dashboard's tabs and numbers", async ({ page, flowDatabase }) => {
  story("The dashboard shows the last week. A tab shows the last 30 days instead.");
  await logIn(page, flowDatabase, ["supporters", "admin"]);
  await page.goto(`${BASE}/staff`);
  await frame(page, "The dashboard");
  const tabs = page.getByRole("navigation", { name: staffCopy.home.dashboard.windows });
  await tabs.getByRole("link", { name: staffCopy.home.dashboard.window(30) }).click();
  await expect(tabs.getByRole("link", { name: staffCopy.home.dashboard.window(30) })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await frame(page, "The last 30 days");
  story("The events held tile leads to the events held in those 30 days, as many as it says.");
  await page.locator('a[href="/staff/events?when=past&held=30"]').click();
  await expect(page).toHaveURL(`${BASE}/staff/events?when=past&held=30`);
  await frame(page, "Past events, in those 30 days");
  story("Going back, the dashboard is still on its 30 days.");
  await page.goBack();
  await expect(tabs.getByRole("link", { name: staffCopy.home.dashboard.window(30) })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await frame(page, "Back on the 30 days");
  story("The supporter emails tile leads to those supporters sent in those days.");
  await page.locator('a[href="/staff/emails?type=campaign&sent=30"]').click();
  await expect(page).toHaveURL(`${BASE}/staff/emails?type=campaign&sent=30`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(lettersCopy.allLetters.title);
  await frame(page, "Supporter emails, in those 30 days");
});

test("Pointing at a bar on the dashboard", { tag: "@desktop-only" }, async ({ page, request, flowDatabase }) => {
  story(
    "New supporters' bars split by where they came from. Pointing at the last one says what it holds, a line each, in a box as wide as it needs.",
  );
  await importLuma(request, BASE);
  await logIn(page, flowDatabase, ["supporters"]);
  await page.goto(`${BASE}/staff?days=90`);
  const bars = page.getByRole("img", { name: /by source/ });
  const box = (await bars.boundingBox())!;
  await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2);
  const label = page.getByRole("status");
  await expect(label).toBeVisible();
  expect((await label.boundingBox())!.width).toBeGreaterThan(box.width / 8);
  await frame(page, "A bar pointed at", { window: true, hover: bars.locator(":scope > span").last() });
});

test("The politicians agreed tile", async ({ page, request, flowDatabase }) => {
  story(
    "An admin records that Polly Placeholder signed the Frontier AI letter to the Prime Minister. The dashboard's politicians agreed tile counts her.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase, ["admin"]);
  await page.goto(`${BASE}/staff/politicians`);
  await page.getByRole("link", { name: "Polly Placeholder" }).click();
  await page.getByRole("button", { name: politiciansCopy.politician.otherAsk }).click();
  await page
    .getByRole("list", { name: politiciansCopy.politician.otherAsk })
    .getByRole("button", { name: PM_LETTER })
    .click();
  const letter = page.getByRole("group", { name: PM_LETTER });
  await letter.getByRole("radio", { name: staffVocabulary.statuses.signed }).click();
  await letter.getByLabel(politiciansCopy.politician.note).fill("They emailed");
  await letter.getByRole("button", { name: politiciansCopy.politician.save }).click();
  await expect(letter.locator("[class*=answer]")).toHaveText(new RegExp(`^${staffVocabulary.statuses.signed}`));

  // One signed this week: the tile is their page.
  await page.goto(`${BASE}/staff`);
  const tile = page.getByRole("link").filter({ hasText: staffCopy.home.dashboard.metrics.politiciansAgreed(1) });
  await frame(page, "The dashboard");
  story("With one politician agreed, the tile leads to her page.");
  await tile.click();
  await expect(page.getByRole("heading", { level: 1, name: "Polly Placeholder" })).toBeVisible();
  await frame(page, "Polly Placeholder's page");
  story(
    "Importing ControlAI's letter records another signature. Now the tile leads to the politicians list of everyone who agreed, the latest recorded first.",
  );

  // ControlAI's letter adds several: the tile is everyone who agreed anything, the latest recorded first.
  await page.goto(`${BASE}/staff/scheduled-jobs/controlai`);
  await page.getByRole("button", { name: staffCopy.controlAi.importNow }).click();
  await expect(page.getByText(/6 names/)).toBeVisible();
  await page.goto(`${BASE}/staff`);
  await page
    .getByRole("link")
    .filter({ hasText: staffCopy.home.dashboard.metrics.politiciansAgreed(2) })
    .click();
  await expect(page).toHaveURL(`${BASE}/staff/politicians?agreed=7&status=any&sort=asks`);
  await expect(
    page.getByRole("button", { name: new RegExp(`^${politiciansCopy.politicians.agreedIn}`) }),
  ).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Polly Placeholder" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Testy McTestface MP" })).toHaveCount(0);
  await frame(page, "Everyone who agreed");
});

test("A test MP's page", async ({ page, request, flowDatabase }) => {
  story("Staff open the test MP's page. It's marked as a test MP, says what they are, and has no history yet.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/politicians?flag=test`);
  await page.getByRole("link", { name: "Testy McTestface MP" }).click();
  // Their name, tagged as a test MP, and what they are; nothing in their history yet.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Testy McTestface MP");
  await expect(page.getByText(politiciansCopy.politicians.flags.test, { exact: true })).toBeVisible();
  await expect(
    page.getByText(politiciansCopy.politician.role(politiciansCopy.politician.roles.commons, "Testshire", true)),
  ).toBeVisible();
  await expect(page.getByText(politiciansCopy.politician.sources.test)).toBeVisible();
  await page.getByRole("heading", { name: politiciansCopy.politician.historyTitle }).click();
  await expect(page.getByText(politiciansCopy.politician.noHistory)).toBeVisible();
  await frame(page, "The test MP's page");
  story(
    "The link above their name goes back to the politicians list. Clicking Constituency twice sorts the list by constituency, Z to A.",
  );

  // The trail above the name leads back; then the list sorted by a heading, and reversed.
  await page
    .getByRole("navigation", { name: staffVocabulary.breadcrumb })
    .getByRole("link", { name: shellCopy.nav.politicians })
    .click();
  await expect(page).toHaveURL(`${BASE}/staff/politicians`);
  await page.getByRole("link", { name: staffVocabulary.fields.constituency }).click();
  await expect(page).toHaveURL(/sort=constituency&dir=asc/);
  await page.getByRole("link", { name: staffVocabulary.fields.constituency }).click();
  await expect(page).toHaveURL(/sort=constituency&dir=desc/);
  await frame(page, "The politicians, by constituency");
});

test("An MP signs", async ({ page, request, flowDatabase }) => {
  story("An admin logs in, and lands on the dashboard.");
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase, ["admin"], "/staff");
  // Logging in lands on the home page: the dashboard, with this admin's permission under their address in the sidebar.
  await expect(page).toHaveURL(`${BASE}/staff`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(staffCopy.home.title);
  await expect(page.getByText(staffEmail()).first()).toBeAttached();
  // The sidebar has a heading of the same name, before the dashboard's.
  await expect(page.getByRole("heading", { level: 2, name: shellCopy.nav.sections.politicians }).last()).toBeVisible();
  await frame(page, "The dashboard");
  story("They open Politicians from the sidebar (on a phone, from the menu). The test politicians are left out.");

  // The pages are in the sidebar; on a phone, behind the bar's menu.
  const politicians = page.getByRole("link", { name: shellCopy.nav.politicians, exact: true });
  if (!(await politicians.first().isVisible())) await page.locator("nav details > summary").click();
  await politicians.filter({ visible: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(politiciansCopy.politicians.title);
  // The test politicians are left out until the Marked filter asks for them.
  await expect(page.getByRole("link", { name: "Polly Placeholder" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Testy McTestface MP" })).toHaveCount(0);
  await frame(page, "The politicians list");
  story("Polly Placeholder's page shows the asks she has answered beside her details.");

  // Signed on their page, in the ask's row of the panel beside their details, with a note.
  await page.getByRole("link", { name: "Polly Placeholder" }).click();
  // Her page, not the list still showing while it loads: no card for the letter is true of both.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Polly Placeholder");
  const card = page.getByRole("group", { name: PM_LETTER });
  await expect(card).toHaveCount(0);
  await frame(page, "Polly Placeholder's page");
  story("Add another answer opens a form for the Frontier AI letter. They choose Signed, with a note of how we know.");
  await page.getByRole("button", { name: politiciansCopy.politician.otherAsk }).click();
  await page
    .getByRole("list", { name: politiciansCopy.politician.otherAsk })
    .getByRole("button", { name: PM_LETTER })
    .click();
  await card.getByRole("radio", { name: staffVocabulary.statuses.signed }).click();
  await card.getByLabel(politiciansCopy.politician.note).fill("Told us at the march");
  await frame(page, "The answer's form");
  story("Saved, her page shows she signed, with the note.");
  await card.getByRole("button", { name: politiciansCopy.politician.save }).click();
  await expect(card.locator("[class*=answer]")).toHaveText(new RegExp(`^${staffVocabulary.statuses.signed}`));
  await expect(card.getByText(/Told us at the march/)).toBeVisible();
  await frame(page, "Polly Placeholder, signed");
  story("The politicians list shows it too.");
  await page.getByRole("link", { name: shellCopy.nav.politicians }).first().click();
  const pollyRow = page.getByRole("row").filter({ hasText: "Polly Placeholder" });
  await expect(pollyRow).toContainText(PM_LETTER);
  await expect(pollyRow.getByRole("button")).toHaveCount(0);
  await frame(page, "The politicians list, with her signature");
  story("The campaign page lists her among the signatories.");

  const signed = await (await request.get(`${BASE}/api/signatories`)).json();
  expect(signed).toContainEqual(expect.objectContaining({ name: "Polly Placeholder", house: "commons" }));
  await page.goto(`${BASE}/campaigns`);
  await expect(page.locator("#signatories").getByText("Polly Placeholder")).toBeVisible();
  await frame(page, "/campaigns");
  story("The audit log records the change. Its {} button shows what was logged.");

  await page.goto(`${BASE}/staff/audit-log`);
  await expect(page.getByRole("cell", { name: "set status" }).first()).toBeVisible();
  await frame(page, "The audit log");
  await page.getByRole("button", { name: staffCopy.changes.json }).first().click();
  await expect(page.locator(":popover-open")).toBeVisible();
  await frame(page, "What was logged", { window: true });
  await page.keyboard.press("Escape");

  // The Scheduled jobs page: a card per job; each opens the job's own page.
  story("The Scheduled jobs page has a card for each job.");
  await page.goto(`${BASE}/staff/scheduled-jobs`);
  await frame(page, "The Scheduled jobs page");
  story("ControlAI's import reads the signatures on their letter, which Polly Placeholder has signed.");
  await page.getByRole("link", { name: jobTitles["import-controlai"] }).click();
  await expect(page).toHaveURL(`${BASE}/staff/scheduled-jobs/controlai`);

  // The fixture ControlAI letter is signed by Polly Placeholder MP, so the bill's column says so.
  await page.getByRole("button", { name: staffCopy.controlAi.importNow }).click();
  await expect(page.getByText(/6 names/)).toBeVisible();
  await frame(page, "ControlAI's letter, imported");
  story("The politicians list says she signed ControlAI's letter.");
  await page.goto(`${BASE}/staff/politicians`);
  await expect(page.getByRole("row").filter({ hasText: "Polly Placeholder" })).toContainText(
    "ControlAI's letter to the Prime Minister",
  );
  await frame(page, "The politicians list, with ControlAI's letter");
  story("Parliament's import runs again, and finds nothing has changed since the politicians were imported.");

  await page.goto(`${BASE}/staff/scheduled-jobs/parliament`);
  await page.getByRole("button", { name: politiciansCopy.politicianImports.importNow["import-parliament"] }).click();
  await expect(page.getByText(staffCopy.runs.status.unchanged, { exact: true }).first()).toBeVisible();
  await frame(page, "Parliament's import");
  story("They log out (on a phone, from the menu), and the staff pages ask them to log in again.");

  // On a phone the navigation and Log out are behind the bar's menu.
  const logout = page.getByRole("button", { name: shellCopy.nav.logout });
  if (!(await logout.first().isVisible())) {
    await page.locator("nav details > summary").click();
    await frame(page, "The staff menu");
  }
  await logout.filter({ visible: true }).click();
  await expect(page).toHaveURL(`${BASE}/staff/login`);
  await frame(page, "The login page");
  await page.goto(`${BASE}/staff`);
  await expect(page).toHaveURL(`${BASE}/staff/login`);
});

test("The new tag", { tag: "@desktop-only" }, async ({ page, flowDatabase }) => {
  story("A page someone first saw in the last 3 days is marked new.");
  await logIn(page, flowDatabase, ["admin", "supporters"], "/staff");
  const email = runSql(flowDatabase, "SELECT email FROM staff_sessions ORDER BY created_at DESC LIMIT 1")[0];
  runSql(
    flowDatabase,
    `UPDATE staff_nav_seen SET first_seen_at = now() WHERE email = '${email}' AND page IN ('campaigns', 'sentEmails')`,
  );
  await page.goto(`${BASE}/staff`);
  const nav = page.getByRole("navigation", { name: shellCopy.nav.title }).first();
  await expect(
    nav.getByRole("link", { name: `${shellCopy.nav.campaigns} ${shellCopy.nav.newTag}` }).first(),
  ).toBeVisible();
  await frame(page, "New in the menu");

  story("With the menu folded to a rail of icons, a dot says the same.");
  await nav.getByRole("button", { name: shellCopy.nav.fold }).click();
  await expect(nav.getByRole("button", { name: shellCopy.nav.unfold })).toBeVisible();
  await frame(page, "New on the rail");
  await nav.getByRole("button", { name: shellCopy.nav.unfold }).click();

  story("Three days later, it's gone.");
  runSql(flowDatabase, `UPDATE staff_nav_seen SET first_seen_at = now() - interval '4 days' WHERE email = '${email}'`);
  await page.reload();
  await expect(nav.getByRole("link", { name: shellCopy.nav.campaigns }).first()).not.toContainText(
    shellCopy.nav.newTag,
  );
  await frame(page, "No longer new");
});

test("The new tag on a phone", { tag: "@phone-only" }, async ({ page, flowDatabase }) => {
  story("On a phone, the menu that drops down marks the same pages.");
  await logIn(page, flowDatabase, ["admin", "supporters"], "/staff");
  const email = runSql(flowDatabase, "SELECT email FROM staff_sessions ORDER BY created_at DESC LIMIT 1")[0];
  runSql(
    flowDatabase,
    `UPDATE staff_nav_seen SET first_seen_at = now() WHERE email = '${email}' AND page = 'campaigns'`,
  );
  await page.goto(`${BASE}/staff`);
  await page.getByRole("group").locator("summary").click();
  await expect(page.getByRole("group").getByRole("link", { name: shellCopy.nav.campaigns })).toContainText(
    shellCopy.nav.newTag,
  );
  await frame(page, "New in the phone's menu", { window: true });
});
