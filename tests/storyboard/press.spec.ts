import type { APIRequestContext, Page } from "@playwright/test";
import { pressPageCopy as copy } from "@/app/(staff)/staff/_components/press/copy";
import { importPath } from "@/lib/import-runs";
import { pressCopy, pressProblems } from "@/lib/press/copy";
import { failService } from "@/lib/server/fixtures/failing-services";
import { FAILING_DIR } from "../checkout.mjs";
import { emailFrame } from "./email-frame";
import { logIn } from "./login-steps";
import { newestEmail } from "./outbox-steps";
import { openBubble, press } from "./settle";
import { TO_NOTIFICATIONS } from "./staff-inboxes";
import { BASE, expect, frame, story, test } from "./fixtures";
import type { Section } from "./report/frames";

export const section: Section = { name: "Press coverage", part: "Staff pages", order: 125 };

// The press survey and the staff Press page: a night's search of the fake
// Google News (lib/server/fixtures/fakes/google-news.ts), adding, editing
// and removing what it found, editing and removing the coverage on /press,
// a piece staff found themselves, and a night the LLM doesn't answer.

/** The night's run of the press survey, as its scheduled function calls it. */
async function surveyNight(request: APIRequestContext) {
  const res = await request.post(`${BASE}/api/cron/import-press`, {
    headers: { Authorization: "Bearer fixture-cron-secret" },
  });
  expect(res.ok()).toBe(true);
}

/** The card of the find, or removed piece, headed `title`. */
const card = (page: Page, title: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("link", { name: title, exact: true }) });

/** The section headed `title`, and what's under it. */
const under = (page: Page, title: string) =>
  page.locator("section, details").filter({ has: page.getByRole("heading", { name: new RegExp(`^${title}`) }) });

test("A night's search for coverage", async ({ page, flowDatabase }) => {
  story(
    "Staff run the press survey by hand. It searches Google News a week at a time since the end of September, and reads each piece it finds. One is on /press already. The LLM says two are ours, and three aren't: one is about PauseAI US, one uses pause AI as a phrase, and one never mentions us.",
  );
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}${importPath("import-press")}`);
  await press(page.getByRole("button", { name: pressCopy.job.importNow }));
  await expect(page.getByText(pressCopy.job.result({ found: 6, read: 5, waiting: 2, left: 0 }))).toBeVisible();
  await frame(page, "The survey's run");

  story("With nothing left to read, the notification inbox is told of the two, with a link to the Press page.");
  const email = newestEmail((one) => one.To === TO_NOTIFICATIONS && one.Subject === pressCopy.waitingEmail.subject(2))!;
  expect(email.TextBody).toContain("The Example Gazette: Protesters march on Whitehall");
  await emailFrame(page, email, "The email to the notification inbox");

  story("On the Press page they wait, each with the LLM's verdict, the passage that names us and why.");
  await page.goto(`${BASE}/staff/press`);
  await expect(under(page, copy.waiting.title).getByRole("listitem")).toHaveCount(2);
  await expect(card(page, "Protesters march on Whitehall")).toContainText(
    "Campaigners from PauseAI UK outside Downing Street",
  );
  await frame(page, "The finds waiting");
});

test("A find goes on /press", async ({ page, request, flowDatabase }) => {
  story("After a night's search, staff add the march on Whitehall to /press.");
  await surveyNight(request);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/press`);
  await press(card(page, "Protesters march on Whitehall").getByRole("button", { name: copy.waiting.add }));
  await expect(card(page, "Protesters march on Whitehall")).toHaveCount(1);
  const shown = under(page, copy.shown.title);
  await expect(shown.getByRole("listitem").first()).toContainText("Protesters march on Whitehall");
  await frame(page, "On /press, newest first");

  story("It's on the public /press page at once, at the top, as the newest piece.");
  await page.goto(`${BASE}/press`);
  await expect(page.locator("#coverage li").first()).toContainText("Protesters march on Whitehall");
  await frame(page, "/press");
});

test("Editing a find before adding it", async ({ page, request, flowDatabase }) => {
  story(
    "Google calls the founder's piece Example Weekly's, but it's the magazine's video. Staff fix its outlet, kind and note before adding it.",
  );
  await surveyNight(request);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/press`);
  const founder = card(page, "Movement founder warns of AI risks");
  const bubble = await openBubble(founder.getByRole("button", { name: copy.shown.edit }));
  await bubble.getByLabel(copy.shown.fields.outlet).fill("Example Weekly Magazine");
  await bubble.getByLabel(copy.shown.fields.medium).selectOption("Video");
  await bubble.getByLabel(copy.shown.fields.note).fill("Quotes Maxime Fournes of PauseAI Global.");
  await frame(page, "The find, being edited");

  story("The card shows what it will go on /press with.");
  await press(bubble.getByRole("button", { name: copy.shown.save }));
  await expect(bubble).not.toBeVisible();
  await expect(founder).toContainText("Example Weekly Magazine · 15 Oct 2026 · Video");
  await expect(founder).toContainText("Quotes Maxime Fournes of PauseAI Global.");
  await frame(page, "The find, edited");

  story("Added, it's on /press as staff set it.");
  await press(founder.getByRole("button", { name: copy.waiting.add }));
  const row = under(page, copy.shown.title).getByRole("listitem").filter({ hasText: "Movement founder" });
  await expect(row).toContainText("Example Weekly Magazine");
  await expect(row).toContainText("Video");
  await frame(page, "On /press");
});

test("Removing a find, and adding it back", async ({ page, request, flowDatabase }) => {
  story("After a night's search, staff remove the march on Whitehall, thinking it isn't ours.");
  await surveyNight(request);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/press`);
  const march = "Protesters march on Whitehall";
  await press(card(page, march).getByRole("button", { name: copy.shown.remove }));
  await expect(under(page, copy.waiting.title).getByRole("listitem")).toHaveCount(1);

  story(
    "It's kept under Removed, folded away with the three the LLM judged not ours, so it's never found again as new. Staff open Removed.",
  );
  await page.getByRole("heading", { name: new RegExp(`^${copy.removed.title}`) }).click();
  await expect(card(page, march)).toBeVisible();
  await card(page, march).scrollIntoViewIfNeeded();
  await frame(page, "Removed, opened");

  story("It was ours after all: Add to /press puts it there from Removed.");
  await press(card(page, march).getByRole("button", { name: copy.waiting.add }));
  const added = under(page, copy.shown.title).getByRole("listitem").filter({ hasText: march });
  await expect(added).toHaveCount(1);
  await added.scrollIntoViewIfNeeded();
  await frame(page, "On /press, newest first");
});

test("Editing and removing a piece on /press", async ({ page, flowDatabase }) => {
  story("Staff correct the Japan Times piece's headline, which the old list had shortened.");
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/press`);
  const shown = under(page, copy.shown.title);
  const japan = shown.getByRole("listitem").filter({ hasText: "Hedging the AI doomsday risk" });
  const bubble = await openBubble(japan.getByRole("button", { name: copy.shown.edit }));
  await bubble.getByLabel(copy.shown.fields.title).fill("Hedging the AI doomsday risk, before it's too late");
  await frame(page, "The piece, being edited");
  await press(bubble.getByRole("button", { name: copy.shown.save }));
  await expect(bubble).not.toBeVisible();
  await expect(japan).toContainText("before it's too late");
  await frame(page, "The piece, saved");

  story("Then they take it off /press. It's kept under Removed, to add back.");
  await press(japan.getByRole("button", { name: copy.shown.remove }));
  await expect(japan).toHaveCount(0);
  await page.getByRole("heading", { name: new RegExp(`^${copy.removed.title}`) }).click();
  const removed = card(page, "Hedging the AI doomsday risk, before it's too late");
  await expect(removed).toBeVisible();
  await removed.scrollIntoViewIfNeeded();
  await frame(page, "Removed");
});

test("Adding a piece staff found themselves", async ({ page, flowDatabase }) => {
  story("Staff heard Joseph on the radio. Add a piece opens the same form as Edit, with the piece's link first.");
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/press`);
  const bubble = await openBubble(page.getByRole("button", { name: copy.shown.addPiece }));
  await bubble.getByLabel(copy.shown.fields.url).fill("https://www.exampleradio.co.uk/joseph-miller");
  await bubble.getByLabel(copy.shown.fields.title).fill("Should we pause AI? Joseph Miller on the morning show");
  await bubble.getByLabel(copy.shown.fields.outlet).fill("Example Radio");
  await bubble.getByLabel(copy.shown.fields.medium).selectOption("Video");
  await bubble.getByLabel(copy.shown.fields.date).fill("2026-10-15");
  await frame(page, "A new piece, being added");

  story("Saved, it's on /press, newest first.");
  await press(bubble.getByRole("button", { name: copy.shown.save }));
  await expect(bubble).not.toBeVisible();
  await expect(under(page, copy.shown.title).getByRole("listitem").first()).toContainText("Example Radio");
  await frame(page, "On /press");

  story("Adding the same link again is refused, as it's on /press already.");
  const again = await openBubble(page.getByRole("button", { name: copy.shown.addPiece }));
  await again.getByLabel(copy.shown.fields.url).fill("https://www.exampleradio.co.uk/joseph-miller");
  await again.getByLabel(copy.shown.fields.title).fill("Joseph Miller on the radio");
  await again.getByLabel(copy.shown.fields.outlet).fill("Example Radio");
  await press(again.getByRole("button", { name: copy.shown.save }));
  await expect(again.getByText(copy.refused.known)).toBeVisible();
  await frame(page, "The same link, refused");
});

test("A night the LLM doesn't answer", async ({ page, request, flowDatabase }) => {
  story(
    "Anthropic's API is down. The survey reads the night's pieces anyway, and its patterns pick which may be ours, so they wait without the LLM's verdict. The run says so.",
  );
  failService(flowDatabase, "api.anthropic.com", FAILING_DIR);
  await surveyNight(request);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}${importPath("import-press")}`);
  await expect(page.getByText(pressProblems.notJudged({ finds: 5 }).what, { exact: false }).first()).toBeVisible();
  await frame(page, "The run, with its problem");

  story("On the Press page, the night's finds say they weren't judged.");
  await page.goto(`${BASE}/staff/press`);
  await expect(card(page, "Protesters march on Whitehall").getByText(copy.waiting.noVerdict)).toBeVisible();
  await frame(page, "The finds waiting, not judged");
});
