import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { query } from "@/lib/server/db";
import { EMPTY_MAILING_DOC, letterFor } from "@/lib/mailing-doc";
import { connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { addFollower, addTemplate, EVENT_WORDS, startSending } from "@/tests/broadcast-fixtures";
import { getWrittenMailing, saveDraft } from "./mailing-drafts";
import {
  approvedTemplates,
  changeBroadcastConsent,
  changeBroadcastFilter,
  createBroadcastDraft,
  getWrittenBroadcast,
  broadcastChangesFrom,
  replyToMessage,
  reviewTemplate,
  saveBroadcastDraft,
  sameTerms,
  scheduleBroadcast,
  sendBroadcastTest,
  stopBroadcast,
  submitTemplate,
  withdrawTemplate,
} from "./broadcast-drafts";
import { supporterAudience } from "./broadcast-recipients";
import { FIELDS_AS_WORDS, TEXT_SENDER_NAME } from "@/lib/broadcasts";
import { toText } from "@/lib/letter-format";
import { staffCopy } from "@/lib/content/staff-interface";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readOutbox } from "@/tests/fixtures/outbox";

const NOTIFICATIONS = "notifications@example.org";

/** Sends the fixture Postmark's emails to an outbox of their own, and gives what's in it, oldest first. */
function outbox() {
  const dir = mkdtempSync(join(tmpdir(), "outbox-"));
  vi.stubEnv("OUTBOX_DIR", dir);
  vi.stubEnv("NOTIFICATION_INBOX", NOTIFICATIONS);
  return () => readOutbox(dir);
}

const JO = "jo@pauseai.uk";
const FUTURE = "2099-01-01T09:18:00.000Z";
/** EVENT_WORDS as an email about a template says them, its fields as words. */
const SAID = toText(letterFor(EVENT_WORDS, FIELDS_AS_WORDS));
const EMAIL_FILTER = { contact: "email:luma-calendar:yes" };
const TEXT_FILTER = { contact: "phone:luma-calendar:yes" };

beforeEach(() => {
  vi.stubEnv("DATA_FIXTURES", "1");
  vi.stubEnv("WHATSAPP_NUMBER", "+447700900000");
});
afterEach(() => vi.unstubAllEnvs());

/** A draft to everyone with `params`, at version 1. */
async function draftOf(params: Record<string, string>): Promise<number> {
  return (await createBroadcastDraft(JO, params))!;
}

/** The draft, written and timed, ready to schedule; returns its version. */
async function readied(id: number, changes: object): Promise<number> {
  const broadcast = (await getWrittenBroadcast(id))!;
  const saved = await saveBroadcastDraft(broadcast, broadcast.version, { dueAt: FUTURE, ...changes });
  if (!saved.saved) throw new Error("not saved");
  return saved.version;
}

it("takes only what a broadcast may change, by its channel", () => {
  expect(broadcastChangesFrom(null, "email")).toBeUndefined();
  expect(broadcastChangesFrom({ ask: "an-ask" }, "email")).toBeUndefined();
  expect(broadcastChangesFrom({ templateId: 1 }, "email")).toBeUndefined();
  expect(broadcastChangesFrom({ subject: "Hello", fromName: "Jo" }, "email")).toEqual({
    subject: "Hello",
    fromName: "Jo",
  });
  expect(broadcastChangesFrom({ subject: "Hello" }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ sentFrom: "jo@pauseai.uk" }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ fromName: "Jo" }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ templateId: "one" }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ dueAt: FUTURE }, "text")).toEqual({ dueAt: FUTURE });
  expect(broadcastChangesFrom({ templateId: 3 }, "text")).toEqual({ templateId: 3 });
  expect(broadcastChangesFrom({ templateId: null }, "text")).toEqual({ templateId: null });
  // A text's title of its own, but not an email's, whose subject is its title.
  expect(broadcastChangesFrom({ title: "March day" }, "text")).toEqual({ title: "March day" });
  expect(broadcastChangesFrom({ title: "March day", templateId: 3 }, "text")).toEqual({
    title: "March day",
    templateId: 3,
  });
  expect(broadcastChangesFrom({ title: 3 }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ title: "March day" }, "email")).toBeUndefined();
});

it("says whether a filter's terms are a broadcast's own", () => {
  const own = { channel: "email" as const, topic: "site-forms" as const };
  expect(sameTerms(own, own)).toBe(true);
  expect(sameTerms({ ...own, topic: "luma-calendar" }, own)).toBe(false);
  expect(sameTerms(undefined, own)).toBe(false);
});

describeWithDatabase("broadcasts to supporters", () => {
  useTestDatabase();

  it("makes a draft only from a Consent filter answered yes, from hello@ for an email and the account for a text", async () => {
    expect(await createBroadcastDraft(JO, { contact: "email:luma-calendar:unsure" })).toBeUndefined();
    const email = (await getWrittenBroadcast(await draftOf({ ...EMAIL_FILTER, near: "M1" })))!;
    expect(email).toMatchObject({
      channel: "email",
      topic: "luma-calendar",
      sentFrom: "hello@pauseai.uk",
      fromName: "PauseAI UK",
      state: "draft",
      template: null,
      filter: { list: "supporters", params: { ...EMAIL_FILTER, near: "M1" } },
    });
    vi.stubEnv("WHATSAPP_NUMBER", "+447700900000");
    expect(await getWrittenBroadcast(await draftOf(TEXT_FILTER))).toMatchObject({
      channel: "text",
      sentFrom: "+447700900000",
      fromName: "PauseAI UK",
    });
    vi.stubEnv("WHATSAPP_NUMBER", "");
    expect(await getWrittenBroadcast(await draftOf(TEXT_FILTER))).toMatchObject({ sentFrom: "" });
  });

  it("isn't found as a mailing to politicians, nor a mailing to politicians as a broadcast", async () => {
    const id = await draftOf(EMAIL_FILTER);
    expect(await getWrittenMailing(id)).toBeUndefined();
    const [{ id: other }] = await query<{ id: number }>(
      `INSERT INTO mailings (title, audience, channel, filter, body, created_by, state)
       VALUES ('', 'politicians', 'email', '{"list": "politicians", "params": {}}', '{"type": "doc", "content": []}', 'jo@pauseai.uk', 'draft')
       RETURNING id::int AS id`,
    );
    expect(await getWrittenBroadcast(other)).toBeUndefined();
  });

  it("opens a draft, which keeps it from being tidied away", async () => {
    const id = await draftOf(EMAIL_FILTER);
    await query("UPDATE mailings SET opened_at = '2020-01-01T00:00:00Z' WHERE id = $1", [id]);
    await getWrittenBroadcast(id, true);
    const [{ recent }] = await query<{ recent: boolean }>(
      "SELECT opened_at > '2021-01-01' AS recent FROM mailings WHERE id = $1",
      [id],
    );
    expect(recent).toBe(true);
  });

  it("keeps a new filter only while it says the same channel and topic", async () => {
    const id = await draftOf(EMAIL_FILTER);
    expect(await changeBroadcastFilter(id, { ...EMAIL_FILTER, near: "LS1" })).toBe(true);
    expect((await getWrittenBroadcast(id))!.filter.params).toEqual({ ...EMAIL_FILTER, near: "LS1" });
    expect(await changeBroadcastFilter(id, { near: "LS1" })).toBe(false);
    expect(await changeBroadcastFilter(id, { contact: "email:site-forms:yes" })).toBe(false);
    expect(await changeBroadcastFilter(id, TEXT_FILTER)).toBe(false);
    expect(await changeBroadcastFilter(999, EMAIL_FILTER)).toBe(false);
  });

  it("saves an email as a mailing is saved, its title its subject", async () => {
    const id = await draftOf(EMAIL_FILTER);
    const broadcast = (await getWrittenBroadcast(id))!;
    expect(await saveBroadcastDraft(broadcast, 1, { subject: "Events" })).toEqual({ saved: true, version: 2 });
    expect((await getWrittenBroadcast(id))!.title).toBe("Events");
    expect(await saveBroadcastDraft(broadcast, 1, { subject: "Late" })).toEqual({ saved: false, reason: "conflict" });
  });

  it("gives a text the words and name of an approved template, and none other", async () => {
    const id = await draftOf(TEXT_FILTER);
    const template = await addTemplate("March day");
    const pending = await addTemplate("Waiting", { status: "pending" });
    const broadcast = (await getWrittenBroadcast(id))!;
    expect(await saveBroadcastDraft(broadcast, 1, { templateId: pending })).toEqual({
      saved: false,
      reason: "conflict",
    });
    expect(await saveBroadcastDraft(broadcast, 1, { templateId: template })).toEqual({ saved: true, version: 2 });
    expect(await getWrittenBroadcast(id)).toMatchObject({
      title: "March day",
      body: EVENT_WORDS,
      template: { id: template, name: "March day", createdBy: JO, lastUsedAt: null, lastUsedTo: 0 },
    });
    // New words, and no template, are named as staff name them, and words alone change no name.
    expect(await saveBroadcastDraft(broadcast, 2, { templateId: null, body: EVENT_WORDS, title: "" })).toEqual({
      saved: true,
      version: 3,
    });
    expect(await getWrittenBroadcast(id)).toMatchObject({ title: "", template: null });
    await saveBroadcastDraft(broadcast, 3, { title: "See you there" });
    await saveBroadcastDraft(broadcast, 4, { body: EVENT_WORDS });
    expect((await getWrittenBroadcast(id))!.title).toBe("See you there");
    // A template with a title given keeps the title.
    await saveBroadcastDraft(broadcast, 5, { templateId: template, title: "March day: London" });
    expect((await getWrittenBroadcast(id))!.title).toBe("March day: London");
  });

  it("schedules an email, leaving who gets it for sending to find", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane Smith");
    const id = await draftOf(EMAIL_FILTER);
    const version = await readied(id, { subject: "Events", body: EVENT_WORDS, fromName: null });
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: true });
    expect(await getWrittenBroadcast(id)).toMatchObject({ state: "scheduled", fromName: "" });
    expect(await query("SELECT id FROM broadcast_messages")).toEqual([]);
    expect(await scheduleBroadcast(id, version + 1, JO)).toEqual({ scheduled: false, reason: "not-draft" });
  });

  it("refuses what isn't there, has been saved since or can't go", async () => {
    expect(await scheduleBroadcast(999, 1, JO)).toEqual({ scheduled: false, reason: "gone" });
    await addFollower("usr-1", "jane@example.com", "Jane");
    const id = await draftOf(EMAIL_FILTER);
    expect(await scheduleBroadcast(id, 7, JO)).toEqual({ scheduled: false, reason: "conflict" });
    expect(await scheduleBroadcast(id, 1, JO)).toEqual({
      scheduled: false,
      problems: ["no-subject", "no-letter", "no-time"],
    });
    // Nothing goes on the live site yet.
    const version = await readied(id, { subject: "Events", body: EVENT_WORDS });
    vi.stubEnv("DATA_FIXTURES", "");
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: false, problems: ["cannot-send"] });
  });

  it("holds an email from a Gmail to its being connected", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    const id = await draftOf(EMAIL_FILTER);
    const version = await readied(id, { subject: "Events", body: EVENT_WORDS, sentFrom: JO });
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: false, problems: ["not-connected"] });
    await connectTestGmail(JO);
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: true });
  });

  it("schedules a text on an approved template, but not on new words till WhatsApp approves them", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const template = await addTemplate("March day");
    const on = await draftOf(TEXT_FILTER);
    expect(await scheduleBroadcast(on, await readied(on, { templateId: template }), JO)).toEqual({ scheduled: true });
    expect((await getWrittenBroadcast(on))!.template).toMatchObject({ id: template, status: "approved" });

    const fresh = await draftOf(TEXT_FILTER);
    expect(
      await scheduleBroadcast(fresh, await readied(fresh, { body: EVENT_WORDS, title: "See you there." }), JO),
    ).toEqual({
      scheduled: false,
      problems: ["not-approved"],
    });
    expect((await getWrittenBroadcast(fresh))!.template).toBeNull();
  });

  it("sends new words for approval, emailing who sent them and the inbox, and locks them till WhatsApp decides", async () => {
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    const sent = outbox();
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(TEXT_FILTER);
    const version = await readied(id, { body: EVENT_WORDS, title: "See you there." });
    expect(await submitTemplate(id, JO)).toBe("submitted");
    const broadcast = (await getWrittenBroadcast(id))!;
    expect(broadcast.template).toMatchObject({
      status: "pending",
      createdBy: JO,
      name: "See you there.",
      body: EVENT_WORDS,
    });
    const words = staffCopy.notifications.templateSubmitted;
    expect(sent()).toEqual([
      expect.objectContaining({
        To: NOTIFICATIONS,
        Cc: JO,
        Subject: words.subject("See you there."),
        TextBody: words.body(JO, SAID, `https://pauseai.uk/staff/broadcasts/${id}`),
      }),
    ]);
    // Once only, and the words stay as sent.
    expect(await submitTemplate(id, JO)).toBe("already");
    expect(await saveBroadcastDraft(broadcast, version, { body: EMPTY_MAILING_DOC })).toEqual({
      saved: false,
      reason: "conflict",
    });
    expect(await saveBroadcastDraft(broadcast, version, { dueAt: FUTURE })).toMatchObject({ saved: true });
    expect(await scheduleBroadcast(id, version + 1, JO)).toEqual({ scheduled: false, problems: ["not-approved"] });
    expect(await query("SELECT action FROM audit_log WHERE action = 'submit broadcast template'")).toHaveLength(1);
  });

  it("sends nothing for approval but a draft text's own words", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const email = await draftOf(EMAIL_FILTER);
    expect(await submitTemplate(email, JO)).toBe("not-text");
    const empty = await draftOf(TEXT_FILTER);
    expect(await submitTemplate(empty, JO)).toBe("no-words");
    // Not while anything but its time would stop it being scheduled, such as no number to send from.
    const unready = await draftOf(TEXT_FILTER);
    await readied(unready, { body: EVENT_WORDS, dueAt: null });
    vi.stubEnv("WHATSAPP_NUMBER", "");
    expect(await submitTemplate(unready, JO)).toBe("not-ready");
    vi.stubEnv("WHATSAPP_NUMBER", "+447700900000");
    const onTemplate = await draftOf(TEXT_FILTER);
    await readied(onTemplate, { templateId: await addTemplate("March day") });
    expect(await submitTemplate(onTemplate, JO)).toBe("already");
    await scheduleBroadcast(onTemplate, (await getWrittenBroadcast(onTemplate))!.version, JO);
    expect(await submitTemplate(onTemplate, JO)).toBe("not-draft");
    expect(await submitTemplate(999, JO)).toBe("gone");
  });

  it("names the template what the text is named, and won't send words with no name", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(TEXT_FILTER);
    await readied(id, { body: EVENT_WORDS, title: " " });
    expect(await submitTemplate(id, JO)).toBe("not-ready");
    await readied(id, { title: " March day " });
    expect(await submitTemplate(id, JO)).toBe("submitted");
    expect(await getWrittenBroadcast(id)).toMatchObject({ title: "March day", template: { name: "March day" } });
  });

  it("sends a rejected text's words for approval again, as a new template", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const rejected = await addTemplate("Old words", { status: "rejected" });
    const id = await draftOf(TEXT_FILTER);
    await readied(id, { body: EVENT_WORDS, templateId: null, title: "See you there." });
    await query("UPDATE mailings SET template_id = $2 WHERE id = $1", [id, rejected]);
    expect((await getWrittenBroadcast(id))!.template).toMatchObject({
      status: "rejected",
      rejectedReason: expect.any(String),
    });
    expect(await submitTemplate(id, JO)).toBe("submitted");
    expect((await getWrittenBroadcast(id))!.template).toMatchObject({ status: "pending" });
  });

  it("takes words back from WhatsApp's review, so they can be changed", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(TEXT_FILTER);
    await readied(id, { body: EVENT_WORDS, title: "See you there." });
    expect(await withdrawTemplate(id, JO)).toBe(false);
    await submitTemplate(id, JO);
    expect(await withdrawTemplate(id, JO)).toBe(true);
    expect(await getWrittenBroadcast(id)).toMatchObject({ template: null, body: EVENT_WORDS });
    expect(await query("SELECT id FROM whatsapp_templates")).toEqual([]);
    expect(await query("SELECT action FROM audit_log WHERE action = 'withdraw broadcast template'")).toHaveLength(1);
  });

  it("records WhatsApp's decision, emailing who sent the words and the inbox, with the texts on them", async () => {
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(TEXT_FILTER);
    const version = await readied(id, { body: EVENT_WORDS, title: "See you there." });
    await submitTemplate(id, JO);
    const template = (await getWrittenBroadcast(id))!.template!.id;
    const sent = outbox();
    const link = `https://pauseai.uk/staff/broadcasts/${id}`;
    const words = staffCopy.notifications;
    expect(await reviewTemplate(template, { approved: true })).toBe(true);
    expect(sent()).toEqual([
      expect.objectContaining({
        Cc: JO,
        Subject: words.templateApproved.subject("See you there."),
        TextBody: words.templateApproved.body(SAID, [link]),
      }),
    ]);
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: true });
    // Decided already: nothing to record.
    expect(await reviewTemplate(template, { approved: false, reason: "Too late." })).toBe(false);

    const other = await addTemplate("Made in WhatsApp Manager", { status: "pending", createdBy: null });
    expect(await reviewTemplate(other, { approved: false, reason: "It's too short." })).toBe(true);
    expect(sent()[1]).toMatchObject({
      Subject: words.templateRejected.subject("Made in WhatsApp Manager"),
      TextBody: words.templateRejected.body("It's too short.", SAID, []),
    });
    expect(sent()[1].Cc).toBeUndefined();
    expect(await query("SELECT status, rejected_reason FROM whatsapp_templates WHERE id = $1", [other])).toEqual([
      { status: "rejected", rejected_reason: "It's too short." },
    ]);
  });

  it("wants a template for a text, and a WhatsApp number for it to come from", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(TEXT_FILTER);
    const version = await readied(id, { body: EMPTY_MAILING_DOC });
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: false, problems: ["no-template"] });
    vi.stubEnv("WHATSAPP_NUMBER", "");
    expect(await scheduleBroadcast(id, version, JO)).toEqual({
      scheduled: false,
      problems: ["no-template", "no-number"],
    });
  });

  it("lists approved templates, most recently used first", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const unused = await addTemplate("Unused", { createdBy: null });
    const used = await addTemplate("Used");
    await addTemplate("Rejected", { status: "rejected" });
    const id = await draftOf(TEXT_FILTER);
    await scheduleBroadcast(id, await readied(id, { templateId: used }), JO);
    await startSending(id, "sent");
    expect(await approvedTemplates()).toMatchObject([
      { id: used, lastUsedAt: expect.anything(), lastUsedTo: 1 },
      { id: unused, createdBy: null, lastUsedAt: null, lastUsedTo: 0 },
    ]);
  });

  it("changes a draft's Consent, keeping its other filters, to the other channel only with no words of its own", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf({ ...EMAIL_FILTER, near: "LS1" });
    // By email still, keeping the rest of the filter and what's written.
    await readied(id, { subject: "Events", body: EVENT_WORDS });
    expect(await changeBroadcastConsent(id, "email:site-forms:yes", JO)).toBe(true);
    expect(await getWrittenBroadcast(id)).toMatchObject({
      channel: "email",
      topic: "site-forms",
      subject: "Events",
      filter: { params: { contact: "email:site-forms:yes", near: "LS1" } },
    });
    // Not to a text while it has words, nor to what isn't a yes, nor once it's no draft.
    expect(await changeBroadcastConsent(id, TEXT_FILTER.contact, JO)).toBe(false);
    expect(await changeBroadcastConsent(id, "email:pauseai-updates:unsure", JO)).toBe(false);
    expect(await changeBroadcastConsent(999, TEXT_FILTER.contact, JO)).toBe(false);
    // With none, to a text, starting afresh as one, from the business account.
    const blank = await draftOf(EMAIL_FILTER);
    expect(await changeBroadcastConsent(blank, TEXT_FILTER.contact, JO)).toBe(true);
    expect(await getWrittenBroadcast(blank)).toMatchObject({
      channel: "text",
      topic: "luma-calendar",
      subject: "",
      template: null,
      fromName: TEXT_SENDER_NAME,
    });
    expect(await query("SELECT action FROM audit_log WHERE action = 'change broadcast consent'")).toHaveLength(2);
  });

  it("makes a scheduled broadcast a draft again", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(TEXT_FILTER);
    await scheduleBroadcast(id, await readied(id, { templateId: await addTemplate("March day") }), JO);
    expect(await stopBroadcast(id, JO)).toBe(true);
    expect(await getWrittenBroadcast(id)).toMatchObject({ state: "draft" });
    expect(await stopBroadcast(id, JO)).toBe(false);
    expect(await stopBroadcast(999, JO)).toBe(false);
  });

  it("keeps an approved template when a broadcast on it is unscheduled", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const template = await addTemplate("March day");
    const id = await draftOf(TEXT_FILTER);
    await scheduleBroadcast(id, await readied(id, { templateId: template }), JO);
    await stopBroadcast(id, JO);
    expect((await getWrittenBroadcast(id))!.template).toMatchObject({ id: template });
  });

  it("stops one sending: sends no more, and says so of those not sent", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    const id = await draftOf(EMAIL_FILTER);
    await scheduleBroadcast(id, await readied(id, { subject: "Events", body: EVENT_WORDS }), JO);
    await startSending(id);
    expect(await stopBroadcast(id, JO)).toBe(true);
    expect((await getWrittenBroadcast(id))!.state).toBe("cancelled");
    expect(await query("SELECT status FROM broadcast_messages")).toEqual([{ status: "cancelled" }]);
  });

  it("tests an email by Postmark, and a text by its backend only on an approved template", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const email = (await getWrittenBroadcast(await draftOf(EMAIL_FILTER)))!;
    const emailTo = (await supporterAudience(email.filter, email)).recipients[0];
    await expect(
      sendBroadcastTest({ ...email, subject: "Hi", body: EVENT_WORDS }, emailTo, "me@pauseai.uk"),
    ).resolves.toMatchObject({
      sent: true,
    });
    const id = await draftOf(TEXT_FILTER);
    const text = (await getWrittenBroadcast(id))!;
    const textTo = (await supporterAudience(text.filter, text)).recipients[0];
    expect(await sendBroadcastTest(text, textTo, "+447700900002")).toBeUndefined();
    await readied(id, { templateId: await addTemplate("March day") });
    const approved = (await getWrittenBroadcast(id))!;
    await expect(sendBroadcastTest(approved, textTo, "+447700900002")).resolves.toMatchObject({ sent: true });
    vi.stubEnv("DATA_FIXTURES", "");
    expect(await sendBroadcastTest(approved, textTo, "+447700900002")).toBeUndefined();
  });

  describe_replies();
});

function describe_replies() {
  /** A sent copy to Jane by `filter`; returns its ID. */
  async function sentCopy(params: Record<string, string>, changes: object): Promise<number> {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(params);
    await scheduleBroadcast(id, await readied(id, changes), JO);
    await startSending(id, "sent");
    const [{ copy }] = await query<{ copy: number }>(
      "UPDATE broadcast_messages SET status = 'sent' RETURNING id::int AS copy",
    );
    return copy;
  }

  it("sends a reply to an email, and keeps who sent it", async () => {
    const copy = await sentCopy(EMAIL_FILTER, { subject: "Events", body: EVENT_WORDS });
    expect(await replyToMessage(copy, "  ", JO)).toBe(false);
    expect(await replyToMessage(copy, " Yes, do. ", JO)).toBe(true);
    expect(await query("SELECT body, sent_by FROM broadcast_replies")).toEqual([{ body: "Yes, do.", sent_by: JO }]);
    expect(await query("SELECT action FROM audit_log WHERE action LIKE 'reply to %'")).toEqual([
      { action: "reply to email" },
    ]);
    expect(await replyToMessage(999, "Hello", JO)).toBe(false);
  });

  it("sends a reply to a text only within a day of their last message", async () => {
    const copy = await sentCopy(TEXT_FILTER, { templateId: await addTemplate("March day") });
    expect(await replyToMessage(copy, "Hello", JO)).toBe(false);
    await query(
      "INSERT INTO broadcast_replies (message_id, body, at) VALUES ($1, 'Is it on?', now() - interval '25 hours')",
      [copy],
    );
    expect(await replyToMessage(copy, "Hello", JO)).toBe(false);
    await query(
      "INSERT INTO broadcast_replies (message_id, body, at) VALUES ($1, 'Well?', now() - interval '1 hour')",
      [copy],
    );
    expect(await replyToMessage(copy, "Yes", JO)).toBe(true);
    expect(await query("SELECT action FROM audit_log WHERE action LIKE 'reply to %'")).toEqual([
      { action: "reply to message" },
    ]);
  });

  it("sends no reply with nothing to send it by, or to someone erased", async () => {
    const copy = await sentCopy(EMAIL_FILTER, { subject: "Events", body: EVENT_WORDS });
    vi.stubEnv("DATA_FIXTURES", "");
    expect(await replyToMessage(copy, "Hello", JO)).toBe(false);
    vi.stubEnv("DATA_FIXTURES", "1");
    await query("UPDATE broadcast_messages SET supporter_id = NULL, address = NULL, merge_values = NULL");
    expect(await replyToMessage(copy, "Hello", JO)).toBe(false);
  });

  it("says when a reply couldn't be sent", async () => {
    const copy = await sentCopy(EMAIL_FILTER, { subject: "Events", body: EVENT_WORDS });
    const channels = await import("./broadcast-channels");
    const spy = vi
      .spyOn(channels, "broadcastBackend")
      .mockReturnValue({ send: async () => ({ sent: false, reason: "failed" }) });
    expect(await replyToMessage(copy, "Hello", JO)).toBe(false);
    spy.mockRestore();
  });

  it("leaves a saved draft's filter alone for saveDraft", async () => {
    const id = await draftOf(EMAIL_FILTER);
    await saveDraft(id, 1, { subject: "Hi" });
    expect((await getWrittenBroadcast(id))!.filter.params).toEqual(EMAIL_FILTER);
  });
}
