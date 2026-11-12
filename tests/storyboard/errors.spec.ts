import { copy } from "@/lib/content/email-your-mp";
import { staffCopy } from "@/lib/content/staff-interface";
import { failService } from "@/lib/server/fixtures/failing-services";
import { runSql } from "@/scripts/fresh-database.mjs";
import { FAILING_DIR } from "../checkout.mjs";
import { fakeTurnstile, fillLetter, lookUpTestMp, newestEmail } from "../steps";
import { BASE, emailFrame, expect, frame, madeUpAddress, story, test } from "./fixtures";
import { logIn, NOTIFICATION_INBOX, settled } from "./staff-steps";
import type { Section } from "./report/frames";

export const section: Section = { name: "Errors", part: "Staff pages", order: 135 };

// What happens when something goes wrong outside an import: what the person
// sees, the email to the notification inbox, and the admins' list of errors.
// The flows on both viewports share the outbox, and an error's email is the
// same on each, so a flow reads its error's row from its own database to
// know its email has gone.

const errors = staffCopy.errorsSeen;

/** The email to the notification inbox with this subject, once it's there. */
async function notified(subject: string) {
  const sent = () => newestEmail((email) => email.To === NOTIFICATION_INBOX && email.Subject === subject);
  await expect.poll(sent).toBeTruthy();
  return sent()!;
}

/** The flow's error of a kind: how often it's happened, and whether an email was due for it. */
function kept(database: string, kind: string): { count: number; alerted: boolean } | undefined {
  const [row] = runSql(
    database,
    `SELECT count || ' ' || (alerted_at IS NOT NULL) FROM errors_seen WHERE kind = '${kind}' AND key NOT LIKE 'seed-%'`,
  );
  if (!row) return undefined;
  const [count, alerted] = row.split(" ");
  return { count: Number(count), alerted: alerted === "true" };
}

/** The heading of Next's own error page, which the site shows in place of any page that threw (app/global-error.tsx). */
const COULDNT_LOAD = "This page couldn’t load";

test("A staff page breaks", async ({ page, flowDatabase }) => {
  story(
    "A bug stops a politician's page from loading: here, a table it reads has gone. Staff see Next's own error page in its place.",
  );
  await logIn(page, flowDatabase, ["admin"]);
  runSql(flowDatabase, "ALTER TABLE notes RENAME TO notes_gone");
  await page.goto(`${BASE}/staff/politicians/1`);
  const heading = page.getByRole("heading", { level: 1, name: COULDNT_LOAD });
  await expect(heading).toBeVisible();
  // Just the message: the error number under it is Next's digest of the
  // error, whose stack names the build's files, so it differs every build.
  await frame(page, "The page in place of the politician's", { of: heading.locator("..") });

  story(
    "The notification inbox is emailed, as it's an error that hasn't been seen before. The email gives the error without its numbers and names, and a link to it.",
  );
  const words = "relation <text> does not exist";
  const email = await notified(errors.email.server.subject(words));
  expect(email.TextBody).toContain(`${errors.kinds.render} /staff/politicians/[id]`);
  await emailFrame(page, email, "The email to the notification inbox");

  story("They press Reload, and it fails again. That's counted, and no second email goes.");
  await page.getByRole("button", { name: "Reload" }).click();
  await expect.poll(() => kept(flowDatabase, "render")).toEqual({ count: 2, alerted: true });
  expect((await notified(errors.email.server.subject(words))).MessageId).toBe(email.MessageId);

  story("An admin opens Errors. The error is first, as it's the one seen most recently.");
  await page.goto(`${BASE}/staff/errors`);
  await expect(page.getByRole("heading", { level: 1, name: staffCopy.nav.errors })).toBeVisible();
  await settled(page);
  const row = page.getByRole("row").filter({ hasText: words });
  await expect(row.getByRole("cell").last()).toHaveText("2");
  await frame(page, "The errors");

  // Not pictured: a stack trace names the build's files, which change with every build.
  story("Its own page has the latest as it was thrown, with its stack trace.");
  await row.getByRole("link", { name: words }).click();
  await expect(page.getByRole("heading", { level: 1, name: words })).toBeVisible();
  await expect(page.getByText('relation "notes" does not exist', { exact: true })).toBeVisible();
  await expect(page.getByText(/^error: relation "notes" does not exist\n\s+at /)).toBeVisible();
});

test("A page breaks in someone's browser", async ({ page, flowDatabase }) => {
  story(
    "A bug in a page's own script loses a visitor the page, after it has loaded. They see Next's own error page in its place, and their browser tells the site.",
  );
  await page.goto(`${BASE}/broken`);
  await page.getByRole("button", { name: "Break while rendering" }).click();
  await expect(page.getByRole("heading", { level: 1, name: COULDNT_LOAD })).toBeVisible();
  await frame(page, "The page in place of the one that broke");

  story(
    "The notification inbox is emailed. The email says which page, but quotes nothing of the error, as anyone can post one.",
  );
  const email = await notified(errors.email.browser.subject("/broken"));
  expect(email.TextBody).toContain(`${errors.kinds["browser-page"]} /broken`);
  expect(email.TextBody).not.toContain("Asked to break");
  await emailFrame(page, email, "The email to the notification inbox");

  story(
    "Another bug throws from a button's click. The page stays as it was, so nobody is emailed, but the error is kept.",
  );
  await page.goto(`${BASE}/broken`);
  await page.getByRole("button", { name: "Break from a click" }).click();
  await expect.poll(() => kept(flowDatabase, "browser-other")).toEqual({ count: 1, alerted: false });

  story("An admin sees both on Errors, each with the page it was on.");
  await logIn(page, flowDatabase, ["admin"]);
  await page.goto(`${BASE}/staff/errors`);
  const lost = page.getByRole("row").filter({ hasText: "Asked to break, while rendering, on try <n>" });
  await expect(lost).toContainText(errors.kinds["browser-page"]);
  await expect(page.getByRole("row").filter({ hasText: "Asked to break, from a click, on try <n>" })).toBeVisible();
  await frame(page, "The errors");
});

test("An error marked done", async ({ page, flowDatabase }) => {
  story("An admin opens Errors. Those still to do are listed; one marked done before is under Done.");
  await logIn(page, flowDatabase, ["admin"]);
  await page.goto(`${BASE}/staff/errors`);
  await settled(page);
  const words = "Turnstile couldn't be reached";
  await frame(page, "The errors to do");

  story("They open one that's been fixed. Its page has a button to mark it done.");
  await page.getByRole("link", { name: words }).click();
  await expect(page.getByRole("heading", { level: 1, name: words })).toBeVisible();
  await frame(page, "The error's own page");

  story("They mark it done. The page says who did, and when, and that it comes back if it happens again.");
  await page.getByRole("button", { name: errors.one.markDone }).click();
  await expect(page.getByRole("button", { name: errors.one.undo })).toBeVisible();
  await frame(page, "Marked done");

  story("It's gone from the errors to do, and is under Done, with the one marked done before.");
  await page.getByRole("link", { name: errors.one.back }).click();
  await expect(page.getByRole("link", { name: words })).toHaveCount(0);
  await page.getByRole("link", { name: errors.tabs.done }).click();
  await expect(page.getByRole("link", { name: words })).toBeVisible();
  await settled(page);
  await frame(page, "The errors done");
});

test("An error done happens again", async ({ page, flowDatabase }) => {
  story("A button on a page throws when it's clicked. The page carries on, and the error is kept.");
  await page.goto(`${BASE}/broken`);
  await page.getByRole("button", { name: "Break from a click" }).click();
  await expect.poll(() => kept(flowDatabase, "browser-other")).toEqual({ count: 1, alerted: false });

  story("An admin marks it done, thinking it fixed.");
  await logIn(page, flowDatabase, ["admin"]);
  await page.goto(`${BASE}/staff/errors`);
  const words = "Asked to break, from a click, on try <n>";
  await page.getByRole("link", { name: words }).click();
  await page.getByRole("button", { name: errors.one.markDone }).click();
  await expect(page.getByRole("button", { name: errors.one.undo })).toBeVisible();

  story("Someone clicks the button again, and it throws again. The error is back with those to do, counted twice.");
  await page.goto(`${BASE}/broken`);
  await page.getByRole("button", { name: "Break from a click" }).click();
  await expect.poll(() => kept(flowDatabase, "browser-other")).toEqual({ count: 2, alerted: false });
  await page.goto(`${BASE}/staff/errors`);
  const row = page.getByRole("row").filter({ hasText: words });
  await expect(row.getByRole("cell").last()).toHaveText("2");
  await settled(page);
  await frame(page, "The errors to do");
});

test("The spam check can't be reached", async ({ page, flowDatabase }) => {
  story(
    "Cloudflare's spam check is down when Jane sends her letter. She's told so, and her letter doesn't go. Nothing was thrown, but the failure is kept as an error.",
  );
  failService(flowDatabase, "challenges.cloudflare.com", FAILING_DIR);
  await fakeTurnstile(page);
  await lookUpTestMp(page, BASE);
  await fillLetter(page, madeUpAddress("Jane Smith", 44));
  await page.getByRole("button", { name: copy.preview.send }).click();
  await expect(page.getByText(copy.errors.spamUnreachable)).toBeVisible();
  await frame(page, "What Jane is told");

  story("The notification inbox is emailed about it, once.");
  const words = staffCopy.problems.logs.turnstileDown;
  const email = await notified(errors.email.server.subject(words));
  await emailFrame(page, email, "The email to the notification inbox");

  story("An admin opens it from Errors: what went wrong in our words, then the error behind it.");
  await logIn(page, flowDatabase, ["admin"]);
  await page.goto(`${BASE}/staff/errors`);
  await page.getByRole("link", { name: words }).click();
  await expect(page.getByRole("heading", { level: 1, name: words })).toBeVisible();
  await expect(page.getByText(errors.one.noStack)).toBeVisible();
  await frame(page, "The error's own page");
});
