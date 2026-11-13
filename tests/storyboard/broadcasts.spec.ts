import type { APIRequestContext, Page } from "@playwright/test";
import { staffCopy } from "@/lib/content/staff-interface";
import { SENDING_DAYS } from "@/lib/broadcast-days";
import { GMAIL_DAILY_LIMIT } from "@/lib/gmail-connect";
import { runSql } from "@/scripts/fresh-database.mjs";
import { addStaffAccount, importCivicrm, importLuma, logInAsStaff, newestEmail } from "../steps";
import { caretInEmpty } from "./editor-steps";
import { BASE, emailFrame, expect, frame, story, test } from "./fixtures";
import { connectGmail } from "./staff-steps";
import type { Section } from "./report/frames";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { messageFrom, postWhatsAppWebhook, statusOf, templateStatus } from "../whatsapp-webhooks";

export const section: Section = { name: "Broadcasts to supporters", part: "Staff pages", order: 45 };

// Broadcasts to supporters: started from the supporters list's Consent filter,
// by email or text; a text on a WhatsApp approved template, or on new words
// sent for approval, which WhatsApp's webhook approves or rejects; who it's to
// changed from the list; the pages of those sent, and each copy's, made in the
// database as scheduling and sending would make them; and a text sent by the
// fake WhatsApp, with what its webhook then brings: delivery, a reply, a stop.

const copy = staffCopy.broadcastPages;
const mailingCopy = staffCopy.mailingPages;
const EMAIL = "contact=email%3Aevents%3Ayes";
const TEXT = "contact=text%3Aevents%3Ayes";
/** How many of the fixture's supporters each filter finds. */
const EMAILABLE = 3;
/** Where an email to supporters is from, whose connected Gmail sends it. */
const HELLO = "hello@pauseai.uk";
const TEXTABLE = 1;
const WORDS =
  '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hi "}, {"type": "field", "attrs": {"field": "firstName"}}, {"type": "text", "text": ", the march meets at 11:00 at Parliament Square."}]}]}';

/** This flow's own staff address: flows run alongside each other, and share the outbox. */
const staffEmail = () => `msg-${test.info().testId.replace(/\W/g, "").slice(-8)}@pauseai.uk`;

async function logIn(page: Page, database: string) {
  addStaffAccount(database, staffEmail(), ["supporters"]);
  return logInAsStaff(page, BASE, staffEmail());
}

/**
 * Makes `change` to the draft, and waits for it to be saved. The pill turns
 * to Saving with the change, perhaps before `change` returns, so it's watched
 * for from before the change, then Saved after it.
 */
async function savedAfter(page: Page, change: () => Promise<unknown>) {
  const saving = page.evaluate(
    (words) =>
      new Promise<void>((done) => {
        const now = () => document.querySelector('[role="status"]')?.textContent === words;
        const watch = new MutationObserver(() => {
          if (!now()) return;
          watch.disconnect();
          done();
        });
        watch.observe(document.body, { subtree: true, childList: true, characterData: true });
      }),
    mailingCopy.savePill.saving,
  );
  await change();
  await saving;
  await expect(page.getByRole("status").first()).toHaveText(mailingCopy.savePill.saved);
}

/** Starts a broadcast from the supporters list, with these filters, and opens the writer. */
async function startFromList(page: Page, filters: string, n: number) {
  await page.goto(`${BASE}/staff/supporters?${filters}`);
  await page.getByRole("button", { name: copy.broadcastButton(n) }).click();
  await expect(page).toHaveURL(/\/staff\/broadcasts\/\d+$/);
}

/**
 * Templates WhatsApp has approved, each with its own words, named as they
 * will be: most by staff, and one made in WhatsApp Manager, named as Meta
 * names them.
 */
function addTemplates(database: string) {
  runSql(
    database,
    `INSERT INTO whatsapp_templates (name, body, status, created_by, approved_at)
     SELECT name, jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph',
         'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Hi '),
           jsonb_build_object('type', 'field', 'attrs', jsonb_build_object('field', 'firstName')),
           jsonb_build_object('type', 'text', 'text', ', ' || words))))),
       'approved', by, '2026-10-01T10:00:00Z'::timestamptz - n * interval '1 day'
     FROM (VALUES
       ('The march meets at 11:00 at Parliament Square.', 'the march meets at 11:00 at Parliament Square. Look for the orange flags.', 'jo@pauseai.uk', 1),
       ('PauseCon room change', 'PauseCon has moved to the Main Hall. Doors still open at 09:30.', 'sam@pauseai.uk', 2),
       ('Our next event is on Saturday.', 'our next event is on Saturday. Hope to see you there.', 'jo@pauseai.uk', 3),
       ('Local group meetup', 'your local group meets on Thursday. Everyone is welcome.', 'jo@pauseai.uk', 4),
       ('write_to_your_mp', 'the AI bill has its second reading next week. Could you write to your MP?', NULL, 5),
       ('Thank you for coming.', 'thank you for coming. Here is what happens next.', 'sam@pauseai.uk', 6)
     ) t (name, words, by, n)`,
  );
}

/**
 * A broadcast that went, as sending leaves one: to everyone who said yes, the
 * first delivered and read and answered, the next failed, the next skipped as
 * they'd stopped. Returns its ID and the first's copy.
 */
function addSent(database: string, channel: "email" | "text", title: string): { id: string; copy: string } {
  const contact = channel === "email" ? "email:events:yes" : "text:events:yes";
  const [id] = runSql(
    database,
    `INSERT INTO mailings (title, subject, audience, channel, topic, filter, body, created_by, sent_from, from_name, due_at, state)
     VALUES ('${title}', '${channel === "email" ? title : ""}', 'supporters', '${channel}', 'events',
       '{"list": "supporters", "params": {"contact": "${contact}"}}', '${WORDS}', 'jo@pauseai.uk',
       '${channel === "email" ? "hello@pauseai.uk" : "+447700900000"}', 'PauseAI UK', '2026-10-15T08:18:00Z', 'sent')
     RETURNING id`,
  );
  const [first] = runSql(
    database,
    `WITH people AS (
       SELECT s.id, row_number() OVER (ORDER BY s.id) AS n FROM supporters s),
     c AS (
       INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, skip_reason, merge_values, sent_at)
       SELECT ${id}, p.id, 'person' || p.n || '${channel === "email" ? "@example.com" : ""}',
         (ARRAY['delivered', 'failed', 'skipped'])[least(p.n, 3)],
         CASE WHEN p.n >= 3 THEN 'unsubscribed' END,
         json_build_object('name', 'Person ' || p.n, 'place', 'Leeds', 'values', json_build_object('firstName', 'Person'), 'meets', '[]'::json),
         CASE WHEN p.n < 3 THEN '2026-10-15T08:18:00Z'::timestamptz END
       FROM people p WHERE p.n <= 4 RETURNING id, status)
     SELECT min(id) FROM c`,
  );
  runSql(
    database,
    `INSERT INTO broadcast_message_events (message_id, kind, at) VALUES
       (${first}, 'delivered', '2026-10-15T08:19:00Z'), (${first}, 'read', '2026-10-15T09:00:00Z')`,
  );
  return { id, copy: first };
}

test("New broadcast, from the Broadcasts page", async ({ page, request, flowDatabase }) => {
  story("Staff open the Broadcasts page. New broadcast, at its top right, starts one.");
  await importLuma(request, BASE);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/broadcasts`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.title);
  await frame(page, "The Broadcasts page, with New broadcast");
  story(
    "It opens the writer, asking first which Consent it goes under: by email or by text, then what about. The rest is there, greyed, till one's chosen.",
  );
  await page.getByRole("link", { name: copy.newBroadcast }).click();
  await expect(page).toHaveURL(`${BASE}/staff/broadcasts/new`);
  const channel = page.getByRole("radiogroup", { name: copy.consentChannel });
  const saidYes = page.getByRole("group", { name: copy.facts.saidYes });
  await expect(saidYes).toHaveCount(0);
  await frame(page, "New broadcast, email or text to choose");
  story("Text shows the Consents someone can have said yes to by text, and the greyed writer below becomes a text's.");
  await channel.getByRole("radio", { name: copy.channels.text }).click();
  await expect(saidYes.getByRole("radio")).toHaveCount(3);
  await frame(page, "The Consents by text, and a text's writer");
  story("Email does the same by email.");
  await channel.getByRole("radio", { name: copy.channels.email }).click();
  await expect(saidYes.getByRole("radio")).toHaveCount(3);
  await frame(page, "The Consents by email, and an email's writer");
  story("Choosing one makes the draft, to everyone who said yes. Change who can narrow them, but needn't.");
  await saidYes.getByRole("radio", { name: staffCopy.supporters.subscriptions.consents["email:events"] }).click();
  await expect(page).toHaveURL(/\/staff\/broadcasts\/\d+$/);
  await expect(page.getByText(copy.everyoneWhoSaidYes)).toBeVisible();
  await expect(page.getByText(copy.willGet(EMAILABLE, "email"))).toBeVisible();
  await frame(page, "The new email, to everyone who said yes");
  story(
    "With nothing written yet, Text shows a text's form instead, greyed till a Consent by text is chosen. Email goes back to the draft as it was.",
  );
  await channel.getByRole("radio", { name: copy.channels.text }).click();
  await expect(page.getByText(copy.problems["no-consent"])).toBeVisible();
  await frame(page, "The draft switched to Text, greyed till a Consent is chosen");
  await channel.getByRole("radio", { name: copy.channels.email }).click();
  await expect(page.getByText(copy.problems["no-consent"])).toHaveCount(0);
  story(
    "Its Consent can change while it's a draft, but, once it has words, only by email. Another topic takes the place of the one it had.",
  );
  await saidYes.getByRole("radio", { name: staffCopy.supporters.subscriptions.consents["email:newsletter"] }).click();
  await expect(
    saidYes.getByRole("radio", { name: staffCopy.supporters.subscriptions.consents["email:newsletter"] }),
  ).toHaveAttribute("aria-checked", "true");
  await frame(page, "Under the newsletter in place of events");
});

test("A broadcast by email", async ({ page, request, flowDatabase }) => {
  story(
    "A broadcast can start from the supporters list too. With the Consent filter on those who can be emailed, answered yes, there's a button, counting who it finds.",
  );
  await importLuma(request, BASE);
  connectGmail(flowDatabase, HELLO);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/supporters?${EMAIL}`);
  await expect(page.getByRole("button", { name: copy.broadcastButton(EMAILABLE) })).toBeVisible();
  await frame(page, "The list, ready to broadcast");
  story(
    "It makes a draft to them and opens the writer: by email, from hello@, sent by its Gmail. Postmark can't be chosen yet. Under that, how many more emails hello@ can send today.",
  );
  await page.getByRole("button", { name: copy.broadcastButton(EMAILABLE) }).click();
  await expect(page).toHaveURL(/\/staff\/broadcasts\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.newTitle.email);
  await frame(page, "The new email");
  story("They write a subject and a line, and the preview shows it as one supporter will get it.");
  await page.getByLabel(copy.subject).fill("Events near you this month");
  const words = page.getByRole("textbox", { name: copy.emailLabel });
  // On the empty line under the greeting, above the signature.
  await caretInEmpty(words, 1);
  await savedAfter(page, () => page.keyboard.type("See you at the march."));
  const preview = page.getByRole("region", { name: copy.sections.preview });
  await expect(preview.getByText("See you at the march.")).toBeVisible();
  await preview.getByRole("button", { name: copy.sendTest }).scrollIntoViewIfNeeded();
  await frame(page, "The email and its preview", { window: true });
  story("The preview is of someone made up. A case button shows them without a first name, so with the fallback.");
  const noName = preview.getByRole("button", { name: copy.previewCases["has:firstName"] });
  await expect(noName).toHaveAttribute("aria-pressed", "true");
  await noName.click();
  await expect(noName).toHaveAttribute("aria-pressed", "false");
  // A save still under way shows in the pill: it's back at Saved before the picture.
  await expect(page.getByRole("status").first()).toHaveText(mailingCopy.savePill.saved);
  await frame(page, "The preview, for someone with no first name", { window: true });
  await noName.click();
  story("Send test sends them a copy, by hello@'s Gmail too, as that supporter would get it.");
  await preview.getByRole("button", { name: copy.sendTest }).click();
  await expect(preview.getByText(copy.testSent(staffEmail()))).toBeVisible();
  const email = newestEmail((one) => one.To.includes(`<${staffEmail()}>`))!;
  expect(email.Subject).toBe("Events near you this month");
  await emailFrame(page, email, "The test copy");
  story("They pick 14:03, and see what it'll send and cost, then schedule it.");
  await savedAfter(page, () => page.getByLabel(mailingCopy.hour, { exact: false }).selectOption("14"));
  const send = page.getByRole("region", { name: copy.sections.send });
  await send.scrollIntoViewIfNeeded();
  await frame(page, "What will go, and what it costs", { window: true });
  await send.getByRole("button", { name: copy.schedule(EMAILABLE, "email") }).click();
  await expect(page.getByRole("button", { name: mailingCopy.unschedule })).toBeVisible();
  await frame(page, "The email, scheduled");
  story("It's in the list of broadcasts, under Coming up.");
  await page.goto(`${BASE}/staff/broadcasts`);
  await expect(page.getByRole("link", { name: "Events near you this month" })).toBeVisible();
  await frame(page, "The list of broadcasts");
  story("Unschedule makes it a draft again.");
  await page.getByRole("link", { name: "Events near you this month" }).click();
  await page.getByRole("button", { name: mailingCopy.unschedule }).click();
  await expect(page.getByLabel(copy.subject)).toHaveValue("Events near you this month");
  await frame(page, "A draft again");
});

test("A text on an approved template", async ({ page, request, flowDatabase }) => {
  story(
    "Staff broadcast to those who can be texted. A text has no subject or files: its words are a template WhatsApp has approved.",
  );
  await importLuma(request, BASE);
  addTemplates(flowDatabase);
  await logIn(page, flowDatabase);
  await startFromList(page, TEXT, TEXTABLE);
  const words = page.getByLabel(copy.templateLabel).first();
  await expect(words).toHaveValue("");
  await frame(page, "The new text, its templates to choose from");
  story(
    "Choosing one from the dropdown names the text after it. Its words show once, in the preview, as a bubble with its Stop button, and can't be changed.",
  );
  await savedAfter(page, () => words.selectOption({ label: "PauseCon room change" }));
  await expect(page.getByRole("heading", { name: "PauseCon room change", level: 1 })).toBeVisible();
  await frame(page, "A template chosen");
  story("They choose the time.");
  await savedAfter(page, () => page.getByLabel(mailingCopy.hour, { exact: false }).selectOption("14"));
  const send = page.getByRole("region", { name: copy.sections.send });
  await send.scrollIntoViewIfNeeded();
  await frame(page, "When, and what it costs", { window: true });
  await send.getByRole("button", { name: copy.schedule(TEXTABLE, "text") }).click();
  await expect(page.getByRole("button", { name: mailingCopy.unschedule })).toBeVisible();
  await frame(page, "The text, scheduled");
});

test("A text on new words", async ({ page, request, flowDatabase }) => {
  story(
    "No template says it, so staff choose New template, the dropdown's last choice, and name it. There are fields, but no parts for only some, as WhatsApp's words are the same for everyone.",
  );
  await importLuma(request, BASE);
  addTemplates(flowDatabase);
  await logIn(page, flowDatabase);
  await startFromList(page, TEXT, TEXTABLE);
  await page.getByLabel(copy.templateLabel).first().selectOption({ label: copy.newTemplate });
  const words = page.getByRole("textbox", { name: copy.templateWords });
  await words.click();
  await page.keyboard.type("The march meets at 11:00 at Parliament Square.");
  await savedAfter(page, () => page.getByLabel(copy.templateName).fill("March day: where to meet"));
  await savedAfter(page, () => page.getByLabel(mailingCopy.hour, { exact: false }).selectOption("14"));
  const send = page.getByRole("region", { name: copy.sections.send });
  await send.scrollIntoViewIfNeeded();
  await expect(send.getByText(copy.problems["not-approved"])).toBeVisible();
  await frame(page, "New words: WhatsApp approves them before they can be scheduled", { window: true });
  story(
    "The button to send them to WhatsApp is at the foot, apart from the words, in Schedule's place, as they can't be scheduled till WhatsApp approves them.",
  );
  const draftPage = page.url();
  const id = new URL(draftPage).pathname.split("/").at(-1);
  await send.getByRole("button", { name: copy.submitTemplate }).click();
  story(
    "Sent, it's back to the list of broadcasts, where the draft says it's waiting for WhatsApp, its row tinted to find it.",
  );
  await page.waitForURL(`${BASE}/staff/broadcasts?submitted=${id}`);
  await expect(page.getByText(copy.waitingTag)).toBeVisible();
  await frame(page, "Back on the list, the draft waiting for WhatsApp");
  story("Whoever sent them, and the notification inbox, get the words by email.");
  const sent = newestEmail((one) => one.Cc === staffEmail())!;
  expect(sent.Subject).toBe(staffCopy.notifications.templateSubmitted.subject("March day: where to meet"));
  await emailFrame(page, sent, "The email saying they've gone for approval");
  story("On the draft, a strip at the top says they've gone, and the words are locked till WhatsApp decides.");
  await page.goto(draftPage);
  await expect(page.getByRole("button", { name: copy.withdrawTemplate })).toBeVisible();
  await frame(page, "The draft, sent for approval");
  await page.getByLabel(copy.templateLabel).first().scrollIntoViewIfNeeded();
  await frame(page, "Its words locked", { window: true });
  story(
    "WhatsApp rejects them, and its webhook tells the site why, as a code. The draft says what it means in plain words, and the words can be changed and sent again.",
  );
  const [name] = runSql(flowDatabase, "SELECT meta_name FROM whatsapp_templates WHERE status = 'pending'");
  await postWhatsAppWebhook(request, BASE, templateStatus(name, "REJECTED", "INVALID_FORMAT"));
  await page.goto(`${BASE}/staff/broadcasts/${id}`);
  await expect(page.getByText(staffCopy.notifications.templateRejectedWhy.reasons.INVALID_FORMAT)).toBeVisible();
  await frame(page, "Rejected, and what to do");
  story("The list says so too, until the words go for approval again or a template is chosen.");
  await page.goto(`${BASE}/staff/broadcasts`);
  await expect(page.getByText(copy.rejectedTag)).toBeVisible();
  await frame(page, "The list, the draft WhatsApp rejected");
});

test("WhatsApp approves new words", async ({ page, request, flowDatabase }) => {
  story("Staff send a text's new words to WhatsApp for approval, as in the flow before.");
  await importLuma(request, BASE);
  await logIn(page, flowDatabase);
  await startFromList(page, TEXT, TEXTABLE);
  const id = new URL(page.url()).pathname.split("/").at(-1);
  await page.getByLabel(copy.templateLabel).first().selectOption({ label: copy.newTemplate });
  await page.getByRole("textbox", { name: copy.templateWords }).click();
  await page.keyboard.type("Doors open at 09:30 for PauseCon.");
  await savedAfter(page, () => page.getByLabel(copy.templateName).fill("PauseCon doors"));
  await savedAfter(page, () => page.getByLabel(mailingCopy.hour, { exact: false }).selectOption("14"));
  await page.getByRole("button", { name: copy.submitTemplate }).click();
  await page.waitForURL(`${BASE}/staff/broadcasts?submitted=${id}`);
  story(
    "WhatsApp approves them, and its webhook tells the site. Whoever sent them, and the notification inbox, are emailed, with a link to the text.",
  );
  const [name] = runSql(flowDatabase, "SELECT meta_name FROM whatsapp_templates WHERE status = 'pending'");
  await postWhatsAppWebhook(request, BASE, templateStatus(name, "APPROVED"));
  const told = newestEmail(
    (one) => one.Subject === staffCopy.notifications.templateApproved.subject("PauseCon doors"),
  )!;
  await emailFrame(page, told, "The email saying WhatsApp approved them");
  story("The text can be scheduled now.");
  await page.goto(`${BASE}/staff/broadcasts/${id}`);
  const send = page.getByRole("region", { name: copy.sections.send });
  await expect(send.getByRole("button", { name: copy.schedule(TEXTABLE, "text") })).toBeEnabled();
  await send.scrollIntoViewIfNeeded();
  await frame(page, "Approved, ready to schedule", { window: true });
});

/**
 * A text to those who can be texted, on an approved template, scheduled for
 * an hour ago by `scheduledBy`, as scheduling leaves one; its ID.
 */
function addDueText(database: string, title: string, scheduledBy: string): string {
  const [template] = runSql(
    database,
    `INSERT INTO whatsapp_templates (name, body, status, created_by, approved_at, meta_name, category)
     VALUES ('${title}', '${WORDS}', 'approved', 'jo@pauseai.uk', now() - interval '1 day', 'flow_text_1', 'MARKETING')
     RETURNING id`,
  );
  const [id] = runSql(
    database,
    `INSERT INTO mailings (title, subject, audience, channel, topic, filter, body, created_by, sent_from, from_name, due_at,
       state, template_id)
     VALUES ('${title}', '', 'supporters', 'text', 'events', '{"list": "supporters", "params": {"contact": "text:events:yes"}}',
       '${WORDS}', 'jo@pauseai.uk', '+447700900000', 'PauseAI UK', now() - interval '1 hour', 'scheduled', ${template})
     RETURNING id`,
  );
  runSql(
    database,
    `INSERT INTO audit_log (actor, action, details) VALUES ('${scheduledBy}', 'schedule broadcast', '{"id": ${id}, "recipients": ${TEXTABLE}}')`,
  );
  return id;
}

/** A text sent by WhatsApp: its ID, and its copy's ID, number (digits alone) and WhatsApp's ID for it. */
async function textSent(request: APIRequestContext, database: string) {
  await importLuma(request, BASE);
  await importCivicrm(request, BASE);
  const id = addDueText(database, "PauseCon doors", staffEmail());
  await runSending(request);
  const [copy, number, wamid] = runSql(
    database,
    `SELECT id || '|' || substr(address, 2) || '|' || provider_message_id FROM broadcast_messages WHERE mailing_id = ${id}`,
  )[0].split("|");
  return { id, copy, number, wamid };
}

test("A text goes by WhatsApp", async ({ page, request, flowDatabase }) => {
  story(
    "A text's time has come. The sending checks each number with PauseAI Global's records first, then sends each copy by WhatsApp: the template, its first name filled in.",
  );
  const sent = await textSent(request, flowDatabase);
  story("WhatsApp's webhook says it was delivered, then read.");
  await postWhatsAppWebhook(request, BASE, statusOf(sent.wamid, sent.number, "delivered"));
  await postWhatsAppWebhook(request, BASE, statusOf(sent.wamid, sent.number, "read", 20));
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/broadcasts/${sent.id}`);
  await expect(page.getByRole("heading", { name: copy.recipientsTitle })).toBeVisible();
  await frame(page, "The text, sent and read");
  await page.goto(`${BASE}/staff/broadcasts/${sent.id}/${sent.copy}`);
  await expect(page.getByText(/the march meets at 11:00/)).toBeVisible();
  await frame(page, "Their copy, with what WhatsApp reported");
});

test("A reply to a text", async ({ page, request, flowDatabase }) => {
  story(
    "A supporter answers a text in WhatsApp. Its webhook brings the reply to the site, on the text's page, under the copy it answers.",
  );
  const sent = await textSent(request, flowDatabase);
  await postWhatsAppWebhook(
    request,
    BASE,
    messageFrom(sent.number, "wamid.flow-reply", sent.wamid, { text: "Is there step-free access?" }),
  );
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/broadcasts/${sent.id}/${sent.copy}`);
  await expect(page.getByText("Is there step-free access?")).toBeVisible();
  await frame(page, "The reply, as a bubble");
  story(
    "Within a day of their message WhatsApp takes words of ours, so staff answer it here. It goes by WhatsApp, and shows in the thread.",
  );
  await page.getByRole("button", { name: copy.replies.reply }).click();
  const editor = page.getByRole("textbox", { name: copy.replies.answerLabel });
  await expect(editor).toBeFocused();
  await editor.pressSequentially("Yes, there's a lift by the main doors.");
  await frame(page, "Writing an answer", { window: true });
  await page.getByRole("button", { name: copy.replies.send }).click();
  await expect(page.getByText(copy.replies.sentBy(staffEmail()))).toBeVisible();
  await frame(page, "The answer, sent");
});

test("Stop, pressed in WhatsApp", async ({ page, request, flowDatabase }) => {
  story(
    "A supporter presses Stop on a text. WhatsApp's webhook tells the site, which stops every text to their number, and tells PauseAI Global's records too.",
  );
  const sent = await textSent(request, flowDatabase);
  await postWhatsAppWebhook(
    request,
    BASE,
    messageFrom(sent.number, "wamid.flow-stop", sent.wamid, { button: emailSettingsCopy.stopButton }),
  );
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/broadcasts/${sent.id}/${sent.copy}`);
  await expect(page.getByText(copy.events["opted-out"]).first()).toBeVisible();
  await frame(page, "Their copy, stopped");
  story("Their page shows the stop of every text, and that it came from WhatsApp.");
  const [supporter] = runSql(flowDatabase, `SELECT supporter_id FROM broadcast_messages WHERE id = ${sent.copy}`);
  await page.goto(`${BASE}/staff/supporters/${supporter}`);
  await expect(page.getByText(staffCopy.supporters.detail.permissions.sources.whatsapp).first()).toBeVisible();
  await frame(page, "Their page, texts stopped");
});

test("Changing who a broadcast goes to", async ({ page, request, flowDatabase }) => {
  story(
    "On a draft to everyone who said yes, Narrow down opens the supporters list choosing for it: the dark strip at the top naming the draft, and the dark bar at the foot.",
  );
  await importLuma(request, BASE);
  await logIn(page, flowDatabase);
  await startFromList(page, EMAIL, EMAILABLE);
  await savedAfter(page, () => page.getByLabel(copy.subject).fill("Change me"));
  const draft = page.url();
  await page.getByRole("link", { name: copy.narrowDown }).click();
  await expect(page.getByText(copy.choosing("Change me"))).toBeVisible();
  const bar = page.getByRole("region", { name: copy.choosingLabel });
  await expect(bar).toBeVisible();
  await expect(page.getByRole("button", { name: copy.broadcastButton(EMAILABLE) })).toHaveCount(0);
  await frame(page, "The list, choosing for the draft", { window: true });
  story("There are no ticks: they narrow the filters, here to one search, and the bar counts who that finds.");
  const url = new URL(page.url());
  url.searchParams.set("q", "fixture");
  await page.goto(url.toString());
  await expect(bar.getByRole("button", { name: copy.useThese(EMAILABLE) })).toBeVisible();
  await frame(page, "Narrowed", { window: true });
  story(
    "The Consent is the broadcast's own: its chip has a padlock and doesn't open, as it's changed in the broadcast.",
  );
  await expect(page.locator(`[title="${copy.consentLocked}"]`).first()).toBeVisible();
  await page.locator(`[title="${copy.consentLocked}"]`).first().hover();
  await frame(page, "The Consent, locked", { window: true });
  story("The orange button keeps them for the draft.");
  await bar.getByRole("button", { name: copy.useThese(EMAILABLE) }).click();
  await expect(page).toHaveURL(draft);
  await expect(page.getByRole("list", { name: staffCopy.mailingPages.whoLabel })).toContainText("fixture");
  await frame(page, "The draft, to those found");
  story("Narrowed, the button is Change who. Cancel at the top goes back and changes nothing.");
  await page.getByRole("link", { name: mailingCopy.changeWho }).click();
  await page.getByRole("link", { name: copy.choosingCancel }).click();
  await expect(page).toHaveURL(draft);
});

test("An email sent", async ({ page, request, flowDatabase }) => {
  story(
    "An email has gone. The list says how it went, and its page has the counts, the email and everyone it went to.",
  );
  await importLuma(request, BASE);
  const sent = addSent(flowDatabase, "email", "Thank you for marching");
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/broadcasts`);
  await frame(page, "The list, one sent");
  await page.getByRole("link", { name: "Thank you for marching" }).first().click();
  await expect(page.getByRole("heading", { name: copy.recipientsTitle })).toBeVisible();
  await frame(page, "The email's page");
  story("A count shows those it counts.");
  await page.getByRole("link", { name: new RegExp(copy.counts.stopped) }).click();
  await expect(page.getByRole("heading", { name: copy.tabs.stopped })).toBeVisible();
  await frame(page, "Those who stopped");
  story("Each recipient leads to their copy: the email as they got it, when it was sent, delivered and read.");
  await page.goto(`${BASE}/staff/broadcasts/${sent.id}/${sent.copy}`);
  await expect(page.getByRole("heading", { name: copy.threadTitle })).toBeVisible();
  await frame(page, "The thread");
  story("The supporter's page lists the broadcast.");
  const [supporter] = runSql(flowDatabase, `SELECT supporter_id FROM broadcast_messages WHERE id = ${sent.copy}`);
  await page.goto(`${BASE}/staff/supporters/${supporter}`);
  // The heading near the window's top, so the list under it shows.
  await page.getByRole("heading", { name: copy.supporterTitle }).evaluate((heading) => {
    heading.scrollIntoView({ block: "start", behavior: "instant" });
    window.scrollBy({ top: -24, behavior: "instant" });
  });
  await frame(page, "On the supporter's page", { window: true });
});

test("A text sent", async ({ page, request, flowDatabase }) => {
  story("A text has gone. Its page shows the bubble where an email's shows the email, and how many read it.");
  await importLuma(request, BASE);
  const sent = addSent(flowDatabase, "text", "March day: where to meet");
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/broadcasts/${sent.id}`);
  await expect(page.getByText(copy.textTitle)).toBeVisible();
  await frame(page, "The text's page");
  story("Each recipient's copy shows the text as it reached them on WhatsApp.");
  await page.goto(`${BASE}/staff/broadcasts/${sent.id}/${sent.copy}`);
  await expect(page.getByText(/the march meets at 11:00/)).toBeVisible();
  await frame(page, "The text as they got it");
});

/** An email to those who follow the calendar, scheduled for an hour ago, as scheduling leaves one; its ID. */
function addDue(database: string, title: string, scheduledBy: string): string {
  const [id] = runSql(
    database,
    `INSERT INTO mailings (title, subject, audience, channel, topic, filter, body, created_by, sent_from, from_name, due_at, state)
     VALUES ('${title}', '${title}', 'supporters', 'email', 'events', '{"list": "supporters", "params": {"contact": "email:events:yes"}}',
       '${WORDS}', 'jo@pauseai.uk', 'hello@pauseai.uk', 'PauseAI UK', now() - interval '1 hour', 'scheduled')
     RETURNING id`,
  );
  runSql(
    database,
    `INSERT INTO audit_log (actor, action, details) VALUES ('${scheduledBy}', 'schedule broadcast', '{"id": ${id}, "recipients": ${EMAILABLE}}')`,
  );
  return id;
}

/** The hourly sending, as its schedule runs it. */
async function runSending(request: APIRequestContext) {
  const res = await request.post(`${BASE}/api/cron/send-mailings`, {
    headers: { Authorization: "Bearer fixture-cron-secret" },
  });
  if (!res.ok()) throw new Error(`Sending failed: ${res.status()} ${await res.text()}`);
}

test("An email broadcast goes", async ({ page, request, flowDatabase }) => {
  story(
    "An email's time has come. The hourly sending checks each address with PauseAI Global's records first, then sends each copy by hello@'s Gmail, with its own unsubscribe link at the foot and in its headers.",
  );
  await importLuma(request, BASE);
  await importCivicrm(request, BASE);
  connectGmail(flowDatabase, HELLO);
  const id = addDue(flowDatabase, "Stall on Saturday", staffEmail());
  await runSending(request);
  const email = newestEmail((one) => one.Subject === "Stall on Saturday" && one.To.includes("@example.com"))!;
  await emailFrame(page, email, "A supporter's copy");
  story("Its page counts what was delivered, failed and stopped, and the replies.");
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/broadcasts/${id}`);
  await expect(page.getByRole("heading", { name: copy.recipientsTitle })).toBeVisible();
  await frame(page, "The email, sent");
});

test("An email that takes more than a day", async ({ page, request, flowDatabase }) => {
  story(
    "hello@'s Gmail sends up to 1,800 emails a day, and today it has room for two more. So the hourly sending sends two copies of this email, and the rest wait for tomorrow.",
  );
  await importLuma(request, BASE);
  await importCivicrm(request, BASE);
  connectGmail(flowDatabase, HELLO);
  runSql(
    flowDatabase,
    `INSERT INTO email_sends (purpose, address, outcome, message_id, backend, sender)
     SELECT 'broadcast', 'earlier-' || i || '@example.com', 'sent', 'earlier-' || i, 'gmail', '${HELLO}'
     FROM generate_series(1, ${GMAIL_DAILY_LIMIT - 2}) i`,
  );
  const id = addDue(flowDatabase, "Stall on Saturday", staffEmail());
  await runSending(request);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/broadcasts/${id}`);
  await expect(page.getByText(copy.moreTomorrow)).toBeVisible();
  await frame(page, "Two sent, the rest tomorrow");
  story(
    "A week after its time it still hasn't all gone, so it stops, and whoever scheduled it is told how many it didn't reach.",
  );
  runSql(flowDatabase, `UPDATE mailings SET due_at = due_at - interval '${SENDING_DAYS} days' WHERE id = ${id}`);
  await runSending(request);
  const told = newestEmail(
    (one) => one.Subject === staffCopy.notifications.broadcastGaveUp.subject("Stall on Saturday", "limit"),
  )!;
  await emailFrame(page, told, "The email saying it stopped");
  await page.goto(`${BASE}/staff/broadcasts/${id}`);
  await expect(page.getByText(copy.gaveUpLimit)).toBeVisible();
  await frame(page, "Stopped");
  story("Resume sending sets it going again, to the one it didn't reach, with its days again to go in.");
  await page.getByRole("button", { name: copy.resume }).click();
  await expect(page.getByText(copy.gaveUpLimit)).toHaveCount(0);
  await expect(page.getByRole("button", { name: mailingCopy.stopSending })).toBeVisible();
  await frame(page, "Sending again");
});

test("A broadcast waiting for CiviCRM", async ({ page, request, flowDatabase }) => {
  story(
    "No import from CiviCRM has finished in the last day, so nobody can be checked against PauseAI Global's records, and nothing goes unchecked. The email waits, and whoever scheduled it is told, once.",
  );
  await importLuma(request, BASE);
  const id = addDue(flowDatabase, "Social on Friday", staffEmail());
  await runSending(request);
  const told = newestEmail(
    (one) => one.Subject === staffCopy.notifications.broadcastWaiting.subject("Social on Friday"),
  )!;
  await emailFrame(page, told, "The email saying it waits");
  story("Its page says why it waits, and the day it will give up if it still can't go.");
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/broadcasts/${id}`);
  await expect(page.getByText(/^Waiting for an import from CiviCRM/)).toBeVisible();
  await frame(page, "Waiting for CiviCRM");
});

test("A reply that asks us to stop", async ({ page, request, flowDatabase }) => {
  story(
    "A supporter replied to an email. The reply came to hello@'s inbox, which the site reads, so it's on the email's page, counted in amber until someone looks at it.",
  );
  await importLuma(request, BASE);
  const sent = addSent(flowDatabase, "email", "Thank you for marching");
  runSql(
    flowDatabase,
    `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, account, gmail_message_id,
       gmail_thread_id, blob_key, automatic)
     VALUES (${sent.copy}, '2026-10-15T10:00:00Z', 'person1@example.com', 'Re: Thank you for marching', 'hello@pauseai.uk',
       'flow-reply', 'flow-reply', 'fixture/broadcast-reply-stop.eml.gz', false)`,
  );
  runSql(flowDatabase, `UPDATE broadcast_messages SET topics = '{events}' WHERE mailing_id = ${sent.id}`);
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/broadcasts/${sent.id}`);
  await expect(page.getByText(copy.lookTag)).toBeVisible();
  await frame(page, "A reply to look at");
  story(
    "The thread shows the reply under our email. It asks to stop, so they record it as an opt-out of all bulk email.",
  );
  await page.goto(`${BASE}/staff/broadcasts/${sent.id}/${sent.copy}`);
  await expect(page.getByText(/could you please stop sending me these/)).toBeVisible();
  await page.getByRole("button", { name: copy.replies.reply }).scrollIntoViewIfNeeded();
  await frame(page, "The reply, with its buttons", { window: true });
  story("Unsubscribe them opens the form a supporter's page has, but needn't ask how they told us: by replying.");
  const words = staffCopy.supporters.detail.permissions.recordOptOut;
  await page.getByRole("button", { name: words.open }).click();
  await page.getByRole("button", { name: `${words.what}: ${words.choose}` }).click();
  await page.getByRole("button", { name: copy.replies.bulk }).click();
  await frame(page, "Unsubscribe them, all bulk email chosen", { window: true });
  await page.getByRole("button", { name: words.record }).click();
  await expect(page.getByText(/Recorded as an opt-out/).first()).toBeVisible();
  await frame(page, "Recorded as an opt-out");
});

test("Answering a reply", async ({ page, request, flowDatabase }) => {
  story(
    "A supporter replied to an email to say thanks. Staff answer it on the email's page, rather than in hello@'s Gmail, at the foot of the thread.",
  );
  await importLuma(request, BASE);
  const sent = addSent(flowDatabase, "email", "Thank you for marching");
  connectGmail(flowDatabase, "hello@pauseai.uk");
  runSql(
    flowDatabase,
    `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, account, gmail_message_id,
       gmail_thread_id, rfc_message_id, blob_key, automatic)
     VALUES (${sent.copy}, '2026-10-15T10:00:00Z', 'person1@example.com', 'Re: Thank you for marching', 'hello@pauseai.uk',
       'flow-thanks', 'flow-thanks', 'fixture-broadcast-reply-thanks@example.com',
       'fixture/broadcast-reply-thanks.eml.gz', false)`,
  );
  await logIn(page, flowDatabase);
  await page.goto(`${BASE}/staff/broadcasts/${sent.id}/${sent.copy}`);
  await expect(page.getByText(/See you at the next one/)).toBeVisible();
  await page.getByRole("button", { name: copy.replies.reply }).click();
  const editor = page.getByRole("textbox", { name: copy.replies.answerLabel });
  await expect(editor).toBeFocused();
  await editor.pressSequentially("Thank you for coming! The next march is on 6 December.");
  await page.getByRole("button", { name: copy.replies.discard }).scrollIntoViewIfNeeded();
  await frame(page, "Writing a reply", { window: true });
  story(
    "Send reply sends it by Gmail from hello@, in the same conversation as their reply. It's in the thread, the reply is settled, and the History says who answered.",
  );
  await page.getByRole("button", { name: copy.replies.send }).click();
  await expect(page.getByText(copy.replies.sentBy(staffEmail()))).toBeVisible();
  await expect(page.getByRole("button", { name: copy.replies.nothing })).toHaveCount(0);
  await frame(page, "The reply, answered");
  story("The email they get, from hello@, as an answer to theirs.");
  // To them by name, as they're a supporter.
  const answer = () =>
    newestEmail((one) => one.To.endsWith("<person1@example.com>") && one.Subject === "Re: Thank you for marching");
  await expect.poll(answer).toBeTruthy();
  await emailFrame(page, answer()!, "The answer they get");
});

test("To more than one topic's yeses", async ({ page, request, flowDatabase }) => {
  story(
    "An invitation to an event suits those who said yes to the newsletter as well as those who said yes to events. + Add lets Said yes to take more than one topic, “or” between: a yes to any one is enough.",
  );
  await importLuma(request, BASE);
  await logIn(page, flowDatabase);
  await startFromList(page, EMAIL, EMAILABLE);
  const saidYes = page.getByRole("group", { name: copy.facts.saidYes });
  await saidYes.getByRole("button", { name: staffCopy.filters.addChoice }).click();
  const newsletter = saidYes.getByRole("button", {
    name: staffCopy.supporters.subscriptions.consents["email:newsletter"],
  });
  await newsletter.click();
  await expect(newsletter).toHaveAttribute("aria-pressed", "true");
  await expect(
    saidYes.getByRole("button", { name: staffCopy.supporters.subscriptions.consents["email:events"] }),
  ).toHaveAttribute("aria-pressed", "true");
  await frame(page, "Newsletter or events");
});
