import type { Page } from "@playwright/test";
import { emailSettingsCopy as copy } from "@/lib/content/email-settings";
import { marchSignupCopy } from "@/lib/content/march-signup";
import { runSql } from "@/scripts/fresh-database.mjs";
import { fakeTurnstile, importCivicrm, importLuma, newestEmail } from "../steps";
import { BASE, emailFrame, expect, frame, story, test } from "./fixtures";
import { hydrated } from "./settle";
import type { Section } from "./report/frames";

export const section: Section = { name: "Contact preferences", part: "Public site", order: 55 };

// The contact preferences page (/contact-preferences), on the fixture CiviCRM's UK
// chapter contacts and the fixture Luma calendar, each flow on its own
// database: asking for a link; changing what you get; Stop everything and
// Restart; an email's unsubscribe link, fresh and old; "No bulk emails",
// lifted; "Do not email", "Do not SMS" and "Do not phone"; a blocked
// address; and the email
// to someone with "No bulk emails" who just ticked a box. A link is made in the
// flow's database with a token the flow knows, as an email would carry it.

const JANE = "jane.fixture@example.com";
const RHEA = "rhea.member@example.com";
const OWEN = "owen.member@example.com";
const KIT = "kit.member@example.com";
const SASHA = "sasha.chapter@example.com";
const TOM = "tom.seed@example.com";
const CASEY = "casey.chapter@example.com";

/** A link to `address`'s settings, made `daysAgo`, with this flow's own token; its path. */
function link(database: string, address: string, daysAgo = 0): string {
  const token = `flow-${test.info().testId.replace(/\W/g, "").slice(-10)}-${address.split("@")[0].replace(/\W/g, "")}`;
  runSql(
    database,
    `INSERT INTO preference_links (token_hash, address, created_at, expires_at)
     VALUES (encode(sha256('${token}'::bytea), 'hex'), '${address}', now() - interval '${daysAgo} days',
       now() - interval '${daysAgo} days' + interval '7 days')`,
  );
  return `/contact-preferences/${token}`;
}

/** A copy of an events broadcast to `address`, sent `daysAgo`, under `topics`; its unsubscribe link's path. */
function copyLink(database: string, address: string, topics: string, daysAgo: number): string {
  const token = `flow-copy-${test.info().testId.replace(/\W/g, "").slice(-10)}`;
  runSql(
    database,
    `WITH m AS (
       INSERT INTO mailings (title, subject, audience, channel, topic, filter, body, created_by, sent_from, from_name, due_at, state)
       VALUES ('Events this month', 'Events this month', 'supporters', 'email', 'newsletter', '{"list": "supporters", "params": {}}',
         '{"type": "doc", "content": []}', 'jo@pauseai.uk', 'hello@pauseai.uk', 'PauseAI UK', now() - interval '${daysAgo} days', 'sent')
       RETURNING id)
     INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, link_token_hash, topics, sent_at)
     SELECT m.id, (SELECT supporter_id FROM supporter_links WHERE matched_value = '${address}' LIMIT 1), '${address}',
       'delivered', encode(sha256(convert_to('${token}', 'UTF8')), 'hex'), '{${topics}}', now() - interval '${daysAgo} days' FROM m`,
  );
  return `/contact-preferences/m/${token}`;
}

/** Opens a settings page, settled. */
async function open(page: Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await hydrated(page);
}

const topicCard = (page: Page, topic: "newsletter" | "events" | "volunteering") =>
  page.getByRole("group", { name: copy.topics[topic], exact: false });

/** Whether the flow runs on the phone, where the page folds why and PauseAI Global's emails. */
const onPhone = () => test.info().project.name === "phone";

test("Asking for a link to your contact preferences", { tag: "@phone" }, async ({ page, request }) => {
  story(
    "Someone wants to change what PauseAI UK emails them. They open Contact preferences, give their address, and pass the spam check.",
  );
  await importCivicrm(request, BASE);
  await fakeTurnstile(page);
  await open(page, "/contact-preferences");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.start.title);
  await frame(page, "Asking for a link");
  // Kit, as no other flow emails Kit a link, so the newest such email is this flow's.
  await page.getByRole("textbox", { name: copy.start.label }).fill(KIT);
  await expect(page.getByRole("button", { name: copy.start.button })).toBeEnabled();
  await page.getByRole("button", { name: copy.start.button }).click();
  story("The page says a link is on its way if we have the address, without saying whether we do.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.sent.title);
  await frame(page, "The link is on its way");
  story("We have it, so the email comes, with the link.");
  // It goes after the page has answered, so it may not be there yet.
  const linkEmail = () => newestEmail((one) => one.To === KIT && one.Subject === copy.linkEmail.subject);
  await expect.poll(linkEmail).toBeTruthy();
  const email = linkEmail()!;
  await emailFrame(page, email, "The email with the link");
  story("The link opens their settings.");
  const path = new URL(/https?:\/\/\S+\/contact-preferences\/[\w-]+/.exec(email.TextBody)![0]).pathname;
  await open(page, path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.settings.title);
  await frame(page, "Their contact preferences");
});

test("Changing what you get", async ({ page, request, flowDatabase }) => {
  story(
    "Jane opens her settings. She gets the newsletter by email, as she's on the UK list with PauseAI Global, and events, as she follows our Luma calendar. Her number from Luma means she can choose texts too.",
  );
  await importCivicrm(request, BASE);
  await importLuma(request, BASE);
  await open(page, link(flowDatabase, JANE));
  await expect(topicCard(page, "newsletter").getByRole("checkbox", { name: copy.ways.email })).toBeChecked();
  await frame(page, "Jane's settings");
  if (onPhone()) {
    story("Each topic says why she gets it. On a phone, that's behind the “?” beside its name.");
    await topicCard(page, "newsletter").getByRole("button", { name: copy.why.ask }).click();
    await expect(topicCard(page, "newsletter").getByText(copy.why.reasons.subscribed!("")).first()).toBeVisible();
    await frame(page, "Why she gets the newsletter");
    await page.keyboard.press("Escape");
  }
  story("She turns the newsletter off by email, and volunteering on by text. Each saves as she changes it.");
  await topicCard(page, "newsletter").getByRole("checkbox", { name: copy.ways.email }).uncheck();
  await expect(topicCard(page, "newsletter").getByText(copy.settings.saved)).toBeVisible();
  await topicCard(page, "volunteering").getByRole("checkbox", { name: copy.ways.text }).check();
  await expect(topicCard(page, "volunteering").getByText(copy.settings.saved)).toBeVisible();
  await frame(page, "Saved");
  if (onPhone()) {
    story("At the foot, what PauseAI Global sends, folded on a phone till opened, and how to stop everything.");
    await page.getByRole("heading", { name: copy.global.title }).click();
  } else {
    story("At the foot, what PauseAI Global sends, and how to stop everything.");
  }
  // The page has it twice, one for each width, only one shown.
  await expect(page.getByText(copy.global.intro).filter({ visible: true })).toBeVisible();
  // Global's box at the window's top, just below the site's sticky header.
  await page.getByRole("heading", { name: copy.global.title }).evaluate((heading) => {
    heading.closest("section, details")!.scrollIntoView({ block: "start", behavior: "instant" });
    window.scrollBy({
      top: -(document.querySelector("header")!.getBoundingClientRect().bottom + 16),
      behavior: "instant",
    });
  });
  await frame(page, "PauseAI Global's emails, and Stop everything", { window: true });
});

test("Stopping everything, and restarting", async ({ page, request, flowDatabase }) => {
  story(
    "Sasha wants nothing more from PauseAI. Stop everything stops our newsletters, events and volunteering, by email, text and phone, and PauseAI Global's bulk email too, which goes to PauseAI Global.",
  );
  await importCivicrm(request, BASE);
  // Joined before the fixture clock's today, as anyone pressing Stop everything has: the latest answer is what holds.
  runSql(flowDatabase, `UPDATE civicrm_contacts SET joined_date = '2026-10-01' WHERE email = '${SASHA}'`);
  await open(page, link(flowDatabase, SASHA));
  await frame(page, "Sasha's settings");
  await page.getByRole("button", { name: copy.stopAll.button }).click();
  await expect(page.getByRole("heading", { name: copy.stopped.title })).toBeVisible();
  await frame(page, "Everything stopped");
  story("She changes her mind. Restarting undoes all that Stop everything did, texts and calls too.");
  await page.getByRole("button", { name: copy.stopped.button }).click();
  await expect(page.getByRole("heading", { name: copy.stopped.title })).toHaveCount(0);
  await frame(page, "Restarted");
});

test("“Do not SMS” and “Do not phone”", async ({ page, request, flowDatabase }) => {
  story(
    "Tom asked PauseAI Global never to text or phone his number. His text and call boxes are locked, and the page says only PauseAI Global can change that.",
  );
  await importCivicrm(request, BASE);
  runSql(flowDatabase, `UPDATE civicrm_contacts SET do_not_sms = true WHERE email = '${TOM}'`);
  await open(page, link(flowDatabase, TOM));
  await expect(page.getByRole("heading", { name: copy.doNotTextOrCall.title })).toBeVisible();
  await frame(page, "Texts and calls locked");
});

test("An address we can't email", async ({ page, request, flowDatabase }) => {
  story("CiviCRM has Casey's address on hold, as emails to it bounced. We send it nothing more, and the page says so.");
  await importCivicrm(request, BASE);
  await open(page, link(flowDatabase, CASEY));
  await expect(page.getByRole("heading", { name: copy.blocked.title })).toBeVisible();
  await frame(page, "Emails to it blocked");
});

test("An email's unsubscribe link", { tag: "@phone" }, async ({ page, request, flowDatabase }) => {
  story(
    "Jane presses Unsubscribe at the foot of yesterday's newsletter. The page opens with one button: following a link changes nothing, as mail scanners follow links nobody clicked.",
  );
  await importCivicrm(request, BASE);
  await importLuma(request, BASE);
  await open(page, copyLink(flowDatabase, JANE, "newsletter", 1));
  await expect(page.getByRole("heading", { name: copy.unsubscribe.title(copy.inSentence.newsletter) })).toBeVisible();
  await frame(page, "One button");
  story("She presses it. The page says what stopped, and what she still gets and why.");
  await page.getByRole("button", { name: copy.unsubscribe.button }).click();
  await expect(page.getByRole("heading", { name: copy.unsubscribe.done(copy.inSentence.newsletter) })).toBeVisible();
  await frame(page, "Unsubscribed");
});

test("An old email's unsubscribe link", async ({ page, request, flowDatabase }) => {
  story(
    "An email from two months ago: its button still unsubscribes, but the rest of the page needs a fresh link, emailed to the address.",
  );
  await importCivicrm(request, BASE);
  await open(page, copyLink(flowDatabase, JANE, "newsletter", 60));
  await expect(page.getByRole("heading", { name: copy.pageExpired })).toBeVisible();
  await frame(page, "The button, and an offer of a fresh link");
  await page.getByRole("button", { name: copy.expired.button }).click();
  await expect(page.getByText(copy.expired.sent)).toBeVisible();
  await frame(page, "A fresh link sent");
});

test("A link that's run out", async ({ page, request, flowDatabase }) => {
  story("A link asked for ten days ago has run out. The page offers a new one.");
  await importCivicrm(request, BASE);
  await open(page, link(flowDatabase, OWEN, 10));
  await expect(page.getByRole("heading", { name: copy.expired.title })).toBeVisible();
  await frame(page, "A link run out");
  story("They ask for a new one, which goes to the address the old link was for.");
  await page.getByRole("button", { name: copy.expired.button }).click();
  await expect(page.getByText(copy.expired.sent)).toBeVisible();
  await frame(page, "A new link on its way");
});

test("“No bulk emails”, lifted", { tag: "@phone" }, async ({ page, request, flowDatabase }) => {
  story(
    "Rhea set “No bulk emails” with PauseAI Global, so none of our newsletters or event emails reach her. Her page says so, and how to lift it, which turns PauseAI Global's back on too.",
  );
  await importCivicrm(request, BASE);
  await open(page, link(flowDatabase, RHEA));
  await expect(page.getByRole("heading", { name: copy.noBulk.title })).toBeVisible();
  await frame(page, "“No bulk emails”");
  story("She lifts it. The page shows her choices, with nothing on yet but what she said yes to before.");
  await page.getByRole("button", { name: copy.noBulk.button }).click();
  await expect(page.getByRole("heading", { name: copy.noBulk.title })).toHaveCount(0);
  await frame(page, "Lifted");
});

test("“Do not email”", async ({ page, request, flowDatabase }) => {
  story("Owen asked PauseAI never to email him. Only PauseAI Global can change that, and the page says so.");
  await importCivicrm(request, BASE);
  runSql(flowDatabase, `UPDATE civicrm_contacts SET do_not_email = true WHERE email = '${OWEN}'`);
  await open(page, link(flowDatabase, OWEN));
  await expect(page.getByRole("heading", { name: copy.doNotEmail.title })).toBeVisible();
  await frame(page, "“Do not email”");
});

test("Signing up with “No bulk emails”", { tag: "@phone" }, async ({ page, request }) => {
  story(
    "Rhea, who has “No bulk emails”, signs up for the march and ticks the box to hear from us. That box can't get past “No bulk emails”, so we email her once, saying what happened and how to settle it.",
  );
  await importCivicrm(request, BASE);
  await page.goto(`${BASE}/protests/march-against-ai-extinction-nov-26`);
  await hydrated(page);
  await page.getByRole("link", { name: "Register now" }).click();
  await page.getByLabel(marchSignupCopy.form.name).fill("Rhea Member");
  await page.getByLabel(marchSignupCopy.form.email).fill(RHEA);
  await page.getByLabel(marchSignupCopy.form.consent).check();
  await page.getByRole("button", { name: marchSignupCopy.form.submit, exact: true }).click();
  await expect(page.getByText(RHEA)).toBeVisible();
  const email = newestEmail((one) => one.To === RHEA && one.Subject === copy.bulkNotice.subject)!;
  await emailFrame(page, email, "The email to Rhea");
});
