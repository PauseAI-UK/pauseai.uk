import { exampleCivicrmResult, exampleLumaResult } from "../../app/(staff)/staff/_components/jobs/RunList.examples";
import { jobTitles, staffCopy } from "@/lib/content/staff-interface";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { type ImportJob, importPath } from "@/lib/import-runs";
import { staffDate } from "@/lib/staff-time";
import { runSql } from "@/scripts/fresh-database.mjs";
import { FIXTURE_NOW, LETTERS_INBOX } from "@/lib/server/fixtures/fixture-env.mjs";
import { FAILING_DIR } from "../checkout.mjs";
import { failService } from "@/lib/server/fixtures/failing-services";
import { connectPolicyMailboxes } from "./gmail-steps";
import { addStaffAccount, logIn, logInAsStaff, staffEmail } from "./login-steps";
import { newestEmail } from "./outbox-steps";
import { importPoliticians } from "./politician-steps";
import { TO_NOTIFICATIONS } from "./staff-inboxes";
import { emailFrame } from "./email-frame";
import { BASE, expect, frame, story, test } from "./fixtures";
import type { Section } from "./report/frames";
import { accountsCopy } from "@/app/(staff)/staff/_components/accounts/copy";
import { politiciansCopy } from "@/app/(staff)/staff/_components/politicians/copy";
import { lettersCopy } from "@/app/(staff)/staff/_components/letters/copy";
import { supportersCopy } from "@/app/(staff)/staff/_components/supporters/copy";
import { jobsCopy } from "@/app/(staff)/staff/_components/jobs/copy";

export const section: Section = { name: "Imports", part: "Staff pages", order: 130 };

// The imports staff run and watch: Luma's, the members', CiviCRM's and Gmail's, each import's
// own page of its runs, an import failing, a Gmail Google disconnects, and a
// politician import held for a person to decide. Each flow on its own database.

/** The newest email to the notification inbox with `subject`. */
const notified = (subject: string) =>
  newestEmail((email) => email.To === TO_NOTIFICATIONS && email.Subject === subject);

test("The Luma import", async ({ page, flowDatabase }) => {
  story(
    "Staff run the Luma import by hand. The first run copies every event on our Luma calendar, who registered for each, the hosts and the calendar's contacts, and adds them as supporters.",
  );
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/scheduled-jobs/luma`);
  await page.getByRole("button", { name: jobsCopy.luma.importNow }).click();
  // The fixture calendar: nine public events and a private one, five guests each over two pages, each event's hosts,
  // one of them no guest, three contacts.
  const first = {
    events: 9,
    eventsSynced: 9,
    eventsLeft: 0,
    guestsChanged: 45,
    people: 6,
    contacts: 3,
    supportersAdded: 7,
    linked: 7,
    requests: 30,
  };
  await expect(page.getByText(jobsCopy.luma.result(first))).toBeVisible();
  await page.getByRole("heading", { name: jobsCopy.luma.title }).scrollIntoViewIfNeeded();
  await frame(page, "The first run");

  story("Run again within the hour, it finds nothing new.");
  // Within the hour, no event is due again: one page of events, unchanged, and the next pass over the contacts' two pages.
  await page.getByRole("button", { name: jobsCopy.luma.importNow }).click();
  const again = {
    ...first,
    events: 0,
    eventsSynced: 0,
    guestsChanged: 0,
    people: 0,
    contacts: 0,
    supportersAdded: 0,
    linked: 0,
    requests: 3,
  };
  await expect(page.getByText(jobsCopy.luma.result(again))).toBeVisible();
  await expect(page.getByText(jobsCopy.runs.status.unchanged)).toBeVisible();
  await page.getByRole("heading", { name: jobsCopy.luma.title }).scrollIntoViewIfNeeded();
  await frame(page, "The second run");
});

test("The CiviCRM import", async ({ page, flowDatabase }) => {
  story(
    "Staff run the CiviCRM import, which copies everyone Global's CRM has in the UK chapter, the members: their details, lists and stops. Every contact is copied but one, who was erased.",
  );
  runSql(flowDatabase, "INSERT INTO civicrm_erased (contact_id) VALUES (199)");
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}${importPath("import-civicrm")}`);
  await page.getByRole("button", { name: jobsCopy.civicrm.importNow }).click();
  // The fixture's eleven contacts, one erased; Kit's unsubscribe, and Casey's hold. With nobody here yet, each
  // contact is a new supporter.
  const first = {
    contacts: 11,
    added: 10,
    changed: 0,
    gone: 0,
    optOuts: 1,
    blocked: 1,
    supportersAdded: 10,
    linked: 10,
  };
  await expect(page.getByText(jobsCopy.civicrm.result(first))).toBeVisible();
  await page.getByRole("heading", { name: jobsCopy.civicrm.title }).scrollIntoViewIfNeeded();
  await frame(page, "The first run");

  story("Run again, it finds nothing new.");
  await page.getByRole("button", { name: jobsCopy.civicrm.importNow }).click();
  await expect(
    page.getByText(jobsCopy.civicrm.result({ ...first, added: 0, optOuts: 0, blocked: 0, linked: 0 })),
  ).toBeVisible();
  await expect(page.getByText(jobsCopy.runs.status.unchanged)).toBeVisible();
  await page.getByRole("heading", { name: jobsCopy.civicrm.title }).scrollIntoViewIfNeeded();
  await frame(page, "The second run");
});

test("Reading Gmail", async ({ page, flowDatabase }) => {
  story(
    "A staff member connects their Gmail from their account page. The Gmail import's page says it hasn't been read yet.",
  );
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/me`);
  await page.getByRole("link", { name: accountsCopy.gmail.connect }).click();
  await expect(page.getByText(accountsCopy.gmail.outcomes.connected)).toBeVisible();
  await page.goto(`${BASE}/staff/scheduled-jobs/gmail`);
  await expect(page.getByText(jobsCopy.gmailReading.never)).toBeVisible();
  await frame(page, "The Gmail import's page");

  story("They read it now. It reads their account for replies and bounces, and finds nothing new.");
  await page.getByRole("button", { name: jobsCopy.gmailReading.readNow }).click();
  // The fixture mailbox has nothing new in it.
  const read = { account: staffEmail(), replies: 0, autoReplies: 0, bounces: 0 };
  await expect(page.getByText(jobsCopy.gmailReading.account(read))).toBeVisible();
  await expect(page.getByText(jobsCopy.runs.status.unchanged)).toBeVisible();
  await page.getByRole("heading", { name: jobsCopy.gmailReading.title }).scrollIntoViewIfNeeded();
  await frame(page, "Gmail, read");

  story(
    "They read it again while the scheduled read is going. Only one reads at a time, so theirs doesn't go, and the page says the scheduled one is reading.",
  );
  // The scheduled read, as far as the press can tell: the job marked running on its schedule's behalf.
  runSql(flowDatabase, "INSERT INTO job_presses (job, started_by) VALUES ('read-gmail', 'nightly')");
  await page.getByRole("button", { name: jobsCopy.gmailReading.readNow }).click();
  // The words either side of the time it started.
  const [before, after] = jobsCopy.import.runningScheduled("\n").split("\n");
  await expect(page.getByText(before, { exact: false })).toContainText(after);
  expect(runSql(flowDatabase, "SELECT count(*) FROM import_runs WHERE job = 'read-gmail'")).toEqual(["1"]);
  await frame(page, "A read that didn't go, as the scheduled one is going");
});

/** `count` of the job's runs on its schedule, `minutes` apart, the newest `from` before now. */
const scheduled = (
  database: string,
  job: ImportJob,
  count: number,
  from: string,
  result: object,
  status = "ok",
  minutes = 5,
  problems: object[] = [],
) =>
  runSql(
    database,
    `INSERT INTO import_runs (job, started_by, status, result, problems, at)
     SELECT '${job}', 'nightly', '${status}', '${JSON.stringify(result).replaceAll("'", "''")}', '${JSON.stringify(problems).replaceAll("'", "''")}', now() - interval '${from}' - n * interval '${minutes} minutes'
     FROM generate_series(0, ${count - 1}) n`,
  );

test("The Luma import's log", async ({ page, flowDatabase }) => {
  story(
    "Luma is copied every 5 minutes, and each day is one table. The newest run is a green row. Runs that found nothing gather into a row, those that did are a row each, and one that stopped short is amber, its words under its counts.",
  );
  await logIn(page, flowDatabase);
  scheduled(flowDatabase, "import-luma", 1, "0 minutes", exampleLumaResult);
  scheduled(flowDatabase, "import-luma", 9, "5 minutes", exampleLumaResult, "unchanged");
  scheduled(flowDatabase, "import-luma", 2, "50 minutes", exampleLumaResult);
  scheduled(flowDatabase, "import-luma", 1, "60 minutes", { ...exampleLumaResult, stoppedBy: "rate-limit" });
  scheduled(flowDatabase, "import-luma", 30, "65 minutes", exampleLumaResult, "unchanged");
  scheduled(flowDatabase, "import-luma", 16, "215 minutes", exampleLumaResult);
  await page.goto(`${BASE}${importPath("import-luma")}`);
  await expect(page.getByText(/nothing new/).first()).toBeVisible();
  await frame(page, "Its log");
  await page
    .locator("summary", { hasText: /no problems/ })
    .first()
    .click();
  await frame(page, "An older stretch, opened");
});

test("The Gmail reading's log", async ({ page, flowDatabase }) => {
  story(
    "Gmail is read every 5 minutes too, its counts over every account it read. A mailbox that couldn't be read is an amber row, saying which under its counts.",
  );
  await logIn(page, flowDatabase);
  const account = (email: string, extra = {}) => ({ account: email, replies: 0, autoReplies: 0, bounces: 0, ...extra });
  const quiet = { accounts: [account("joseph@pauseai.uk"), account("policy@pauseai.uk")] };
  const replied = {
    accounts: [account("joseph@pauseai.uk", { replies: 1 }), account("policy@pauseai.uk", { oneOffs: 1 })],
  };
  const refusal = "Gmail answered 403 for /settings/sendAs: User-rate limit exceeded";
  const refused = {
    accounts: [account("joseph@pauseai.uk", { error: refusal }), account("policy@pauseai.uk")],
  };
  scheduled(flowDatabase, "read-gmail", 1, "0 minutes", replied);
  scheduled(flowDatabase, "read-gmail", 6, "5 minutes", quiet, "unchanged");
  scheduled(flowDatabase, "read-gmail", 1, "35 minutes", refused, "ok", 5, [
    { what: jobsCopy.problems.couldntRead("joseph@pauseai.uk"), error: refusal },
  ]);
  scheduled(flowDatabase, "read-gmail", 8, "40 minutes", quiet, "unchanged");
  scheduled(flowDatabase, "read-gmail", 3, "80 minutes", replied);
  scheduled(flowDatabase, "read-gmail", 40, "95 minutes", quiet, "unchanged");
  await page.goto(`${BASE}${importPath("read-gmail")}`);
  await expect(page.getByText(/nothing new/).first()).toBeVisible();
  await frame(page, "Its log");
});

test("The CiviCRM import's log", async ({ page, flowDatabase }) => {
  story(
    "Members are copied from CiviCRM hourly. Hours with nothing new gather into a row; one with new members is a row of its own words.",
  );
  await logIn(page, flowDatabase);
  scheduled(flowDatabase, "import-civicrm", 1, "0 minutes", exampleCivicrmResult);
  scheduled(flowDatabase, "import-civicrm", 3, "1 hour", exampleCivicrmResult, "unchanged", 60);
  scheduled(flowDatabase, "import-civicrm", 1, "4 hours", exampleCivicrmResult);
  scheduled(flowDatabase, "import-civicrm", 5, "5 hours", exampleCivicrmResult, "unchanged", 60);
  await page.goto(`${BASE}${importPath("import-civicrm")}`);
  await expect(page.getByText(/nothing new/).first()).toBeVisible();
  await frame(page, "Its log");
});

test("Google disconnects a Gmail", async ({ page, request, flowDatabase }) => {
  story(
    "A staff member has connected their Gmail. Then Google stops letting us use it, as it does when someone removes our access or their password changes.",
  );
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/me`);
  await page.getByRole("link", { name: accountsCopy.gmail.connect }).click();
  await expect(page.getByText(accountsCopy.gmail.outcomes.connected)).toBeVisible();
  // Theirs alone: the letters inbox, which every flow has connected, isn't.
  runSql(
    flowDatabase,
    `UPDATE staff_accounts SET gmail_token = NULL, gmail_connected_at = NULL, gmail_history_id = NULL, gmail_name = NULL
     WHERE email = '${LETTERS_INBOX}'`,
  );
  failService(flowDatabase, "oauth2.googleapis.com", FAILING_DIR);

  story(
    "The next hourly read of Gmail finds out. The site disconnects the account, and the notification inbox gets an email saying who must connect it again.",
  );
  const res = await request.post(`${BASE}/api/cron/read-gmail`, {
    headers: { Authorization: "Bearer fixture-cron-secret" },
  });
  expect(res.ok()).toBe(true);
  const words = staffCopy.notifications.gmailDisconnected;
  await emailFrame(page, notified(words.subject(staffEmail()))!, "The email to the notification inbox");

  story("The Gmail import's page shows that run failed, and why.");
  await page.goto(`${BASE}/staff/scheduled-jobs/gmail`);
  await expect(page.getByText(jobsCopy.gmailReading.disconnected)).toBeVisible();
  await frame(page, "The Gmail import's page");

  story("Their account page offers to connect their Gmail again.");
  await page.goto(`${BASE}/staff/me`);
  await expect(page.getByRole("link", { name: accountsCopy.gmail.connect })).toBeVisible();
  await frame(page, "Their account page");
});

test("The letters inbox connects", async ({ page }) => {
  story(
    "Staff log in as the letters inbox and connect its Gmail. Back from Google, the page says supporters' letters to MPs go from it now, not mailings, and replies are relayed through it.",
  );
  await logInAsStaff(page, BASE, LETTERS_INBOX);
  await page.goto(`${BASE}/staff/me?gmail=connected`);
  await expect(page.getByRole("status")).toHaveText(accountsCopy.gmail.outcomes.connectedLettersInbox);
  await frame(page, "The letters inbox's account page");
});

test("An import's runs", async ({ page, request, flowDatabase }) => {
  story(
    "Staff run Parliament's import twice. Its page lists both runs, under the day's heading, and none of the other imports' runs.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  await logIn(page, flowDatabase);
  // The import, twice: its page lists both runs, under the day's heading, and none of the other bodies'.
  await page.goto(`${BASE}/staff/scheduled-jobs/parliament`);
  const run = page.getByRole("button", { name: politiciansCopy.politicianImports.importNow["import-parliament"] });
  const unchanged = page.getByText(jobsCopy.runs.status.unchanged, { exact: true });
  await run.click();
  await expect(unchanged).toHaveCount(1);
  await run.click();
  await expect(unchanged).toHaveCount(2);
  // One day's heading over every run: the fixture clock's day.
  const day = page.getByRole("heading", { level: 2, name: staffDate(new Date(FIXTURE_NOW)) });
  await expect(day).toHaveCount(1);
  // Where the second run leaves the window depends on when its result arrives, so the frame starts at the day.
  await day.evaluate((heading) => heading.scrollIntoView({ block: "start" }));
  await frame(page, "Parliament's import's page");

  story(
    "The Scheduled jobs page has a card for each job, showing its newest run. Parliament's import is done, and ControlAI's letter hasn't been read yet. The copy from Airtable runs only when someone presses it, so it's last.",
  );
  await page
    .getByRole("navigation", { name: staffVocabulary.breadcrumb })
    .getByRole("link", { name: jobsCopy.import.pageTitle })
    .click();
  await expect(page).toHaveURL(`${BASE}/staff/scheduled-jobs`);
  const card = (job: ImportJob) =>
    page.locator("section").filter({ has: page.getByRole("link", { name: jobTitles[job] }) });
  await expect(card("import-parliament").getByText(jobsCopy.runs.status.unchanged)).toBeVisible();
  await expect(card("import-controlai").getByText(jobsCopy.controlAi.never)).toBeVisible();
  await frame(page, "The Scheduled jobs page");
});

test("An import fails", async ({ page, request, flowDatabase }) => {
  story(
    "Luma is down. The hourly Luma import fails, and the notification inbox gets an email with the error and a link to the import's runs.",
  );
  failService(flowDatabase, "public-api.luma.com", FAILING_DIR);
  const luma = () =>
    request.post(`${BASE}/api/cron/import-luma`, { headers: { Authorization: "Bearer fixture-cron-secret" } });
  expect((await luma()).ok()).toBe(false);
  const words = staffCopy.notifications.importFailed;
  const email = notified(words.subject(jobTitles["import-luma"]))!;
  await emailFrame(page, email, "The email to the notification inbox");

  story("An hour later it fails again. No second email: there's one until the import has worked.");
  expect((await luma()).ok()).toBe(false);
  expect(notified(words.subject(jobTitles["import-luma"]))!.MessageId).toBe(email.MessageId);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/scheduled-jobs/luma`);
  await expect(page.getByText(jobsCopy.runs.status.failed, { exact: true })).toHaveCount(2);
  await frame(page, "The Luma import's runs");
});

test("An import has problems", async ({ page, request, flowDatabase }) => {
  story(
    "postcodes.io is down. The Luma import still runs, but can't place the new supporters, so it says so under its line, and the notification inbox gets an email saying what went wrong.",
  );
  failService(flowDatabase, "api.postcodes.io", FAILING_DIR);
  const luma = () =>
    request.post(`${BASE}/api/cron/import-luma`, { headers: { Authorization: "Bearer fixture-cron-secret" } });
  expect((await luma()).ok()).toBe(true);
  const words = staffCopy.notifications.importProblems;
  const email = notified(words.subject(jobTitles["import-luma"]))!;
  expect(email.TextBody).toContain(supportersCopy.problems.placesFailed);
  await emailFrame(page, email, "The email to the notification inbox");

  story("The next run has the same problem. No second email: there's one until the problem has gone.");
  expect((await luma()).ok()).toBe(true);
  expect(notified(words.subject(jobTitles["import-luma"]))!.MessageId).toBe(email.MessageId);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/scheduled-jobs/luma`);
  await expect(page.getByText(jobsCopy.runs.status.problems, { exact: true })).toHaveCount(2);
  await expect(page.getByText(supportersCopy.problems.placesFailed, { exact: false }).first()).toBeVisible();
  await frame(page, "The Luma import's runs, with the problem under each");
});

test("A held politician import", async ({ page, request, flowDatabase }) => {
  story(
    "21 MPs we have are no longer in Parliament's list. An import that would mark that many as having left changes too much to go ahead alone, so it's held for a person to check.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  // Twenty-one MPs with IDs Parliament no longer lists: the next import would
  // mark them all as having left, more than it may without a person checking.
  runSql(
    flowDatabase,
    `WITH people AS (
       INSERT INTO notable_people (kind, name)
       SELECT 'politician', 'Gone McTestface ' || n || ' MP' FROM generate_series(1, 21) n RETURNING id, name
     )
     INSERT INTO politicians (id, house, constituency, official_id)
     SELECT id, 'commons', replace(replace(name, ' MP', ''), 'McTestface ', ''), 70000 + id FROM people`,
  );
  const inOffice = () =>
    Number(
      runSql(flowDatabase, "SELECT count(*) FROM notable_people WHERE name LIKE 'Gone %' AND status = 'in_office'")[0],
    );
  const parliament = () =>
    request.post(`${BASE}/api/cron/import-parliament`, { headers: { Authorization: "Bearer fixture-cron-secret" } });

  // The nightly import, which holds it.
  expect((await parliament()).ok()).toBe(true);
  story("The notification inbox gets an email about it, once.");
  const title = jobTitles["import-parliament"];
  await emailFrame(
    page,
    notified(staffCopy.notifications.importHeld.subject(title, 21))!,
    "The email to the notification inbox",
  );

  story("The import's page shows the run held, with what it would change.");
  await logIn(page, flowDatabase, ["admin"]);
  await page.goto(`${BASE}/staff/scheduled-jobs/parliament`);
  const words = politiciansCopy.politicianImports;
  await expect(page.getByRole("button", { name: words.apply })).toBeVisible();
  await expect(page.getByText(`${words.left} (21)`).first()).toBeVisible();
  await expect(page.getByText("Gone 1: Gone McTestface 1 MP")).toBeAttached();
  expect(inOffice()).toBe(21);
  await frame(page, "The import, held");

  story("The staff dashboard says so first, with a button back to the decision.");
  await page.goto(`${BASE}/staff`);
  await expect(page.getByText(staffCopy.home.dashboard.actions.heldImport(title, 21))).toBeVisible();
  await frame(page, "The dashboard");
  await page.getByRole("link", { name: staffCopy.home.dashboard.actions.decide }).click();
  await expect(page).toHaveURL(`${BASE}/staff/scheduled-jobs/parliament`);

  story("An admin discards it. Nothing changes: all 21 are still in office here.");
  await page.getByRole("button", { name: words.discard }).click();
  await expect(page.getByRole("button", { name: words.apply })).toHaveCount(0);
  await expect(page.getByText(jobsCopy.runs.status.discarded).first()).toBeVisible();
  expect(inOffice()).toBe(21);
  // From the top, where the newest run says how it ended; the button left the page scrolled down its list.
  await page.evaluate(() => window.scrollTo(0, 0));
  await frame(page, "The import, discarded");

  story(
    "They run the import again, and it's held again. This time they apply it. The 21 are marked as having retired, as Parliament says, and kept, and the run says who decided.",
  );
  await page.getByRole("button", { name: words.importNow["import-parliament"] }).click();
  await page.getByRole("button", { name: words.apply }).click();
  await expect(page.getByRole("button", { name: words.apply })).toHaveCount(0);
  await expect(page.getByText(jobsCopy.runs.decidedBy(staffEmail())).first()).toBeVisible();
  expect(inOffice()).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await frame(page, "The import, applied");

  story("The audit log records who discarded it and who applied it.");
  await page.goto(`${BASE}/staff/audit-log`);
  await expect(page.getByRole("cell", { name: "apply held politician import" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "discard held politician import" })).toBeVisible();
  await frame(page, "The audit log");
});

test("A held rename", async ({ page, request, flowDatabase }) => {
  story(
    "Someone here named Penny Previous has the ID Parliament gives Polly Placeholder. That may be the same person, or a mistake in matching, so the import is held, showing the old name and the new.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  runSql(flowDatabase, "UPDATE notable_people SET name = 'Penny Previous' WHERE name = 'Polly Placeholder'");
  await logIn(page, flowDatabase, ["admin"]);
  await page.goto(`${BASE}/staff/scheduled-jobs/parliament`);
  await page.getByRole("button", { name: politiciansCopy.politicianImports.importNow["import-parliament"] }).click();
  await expect(page.getByRole("button", { name: politiciansCopy.politicianImports.apply })).toBeVisible();
  await expect(page.getByText("Penny Previous → Polly Placeholder")).toBeVisible();
  await frame(page, "The import, held");
});

test("Keeping Joseph's threads", async ({ page, flowDatabase }) => {
  story(
    "Threads with politicians are kept from policy@ and Joseph's mailboxes. His own page says so, once it's connected.",
  );
  addStaffAccount(flowDatabase, "joseph@pauseai.uk");
  await logInAsStaff(page, BASE, "joseph@pauseai.uk");
  await page.goto(`${BASE}/staff/me`);
  await page.getByRole("link", { name: accountsCopy.gmail.connect }).click();
  await expect(page.getByText(accountsCopy.gmail.kept.before)).toBeVisible();
  await frame(page, "Kept");
});

test("Mail that matches nothing", async ({ page, request, flowDatabase }) => {
  story(
    "Mail in policy@ that isn't about a politician isn't kept, but staff get a list of it, once a day, by sender and subject, each with a link to it in policy@'s Gmail.",
  );
  await importPoliticians(request, BASE, flowDatabase);
  connectPolicyMailboxes(flowDatabase);
  await logIn(page, flowDatabase, ["supporters", "admin"]);
  runSql(flowDatabase, "INSERT INTO unmatched_mail (account, gmail_message_id) VALUES ('policy@pauseai.uk', '0b02')");
  await page.goto(`${BASE}${importPath("read-gmail")}`);
  await page.getByRole("button", { name: jobsCopy.gmailReading.readNow }).click();
  const subject = lettersCopy.oneOff.unmatchedAlert.subject(1);
  await expect.poll(() => newestEmail((email) => email.Subject === subject)).toBeTruthy();
  const report = newestEmail((email) => email.Subject === subject)!;
  expect(report.TextBody).toContain("Are you hiring?");
  expect(report.TextBody).toContain("https://mail.google.com/mail/?authuser=policy%40pauseai.uk#all/0b02");
  await emailFrame(page, report, "The email staff get");
});
