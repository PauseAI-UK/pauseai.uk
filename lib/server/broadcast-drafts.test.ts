import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { query } from "@/lib/server/db";
import { EMPTY_MAILING_DOC, letterFor } from "@/lib/mailing-doc";
import { connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { templateFooter } from "@/lib/whatsapp-template";
import { addFollower, addTemplate, EVENT_WORDS, startSending } from "@/tests/broadcast-fixtures";
import { toNotifications } from "@/tests/notifications";
import { getWrittenMailing, saveDraft } from "./mailing-drafts";
import {
  approvedTemplates,
  changeBroadcastConsent,
  changeBroadcastFilter,
  createBroadcastDraft,
  getWrittenBroadcast,
  broadcastChangesFrom,
  reviewTemplate,
  saveBroadcastDraft,
  sameTerms,
  scheduleBroadcast,
  sendBroadcastTest,
  resumeBroadcast,
  stopBroadcast,
  submitTemplate,
  withdrawTemplate,
} from "./broadcast-drafts";
import { fakeRecipient, FIELDS_AS_WORDS, TEXT_SENDER_NAME } from "@/lib/broadcasts";
import { toText } from "@/lib/letter-format";
import { staffCopy } from "@/lib/content/staff-interface";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readOutbox } from "@/lib/server/fixtures/outbox";

const NOTIFICATIONS = "notifications@example.org";

/** Sends the fixture Postmark's emails to an outbox of their own, and gives what's in it, oldest first. */
function outbox() {
  const dir = mkdtempSync(join(tmpdir(), "outbox-"));
  vi.stubEnv("OUTBOX_DIR", dir);
  vi.stubEnv("NOTIFICATION_INBOX", NOTIFICATIONS);
  return () => readOutbox(dir);
}

const JO = "jo@pauseai.uk";
const HELLO = "hello@pauseai.uk";
const FUTURE = new Date("2099-01-01T09:18:00.000Z");
/** EVENT_WORDS as an email about a template says them, its fields as words. */
const SAID = toText(letterFor(EVENT_WORDS, FIELDS_AS_WORDS));
const EMAIL_FILTER = { contact: "email:events:yes" };
const TEXT_FILTER = { contact: "text:events:yes" };

beforeEach(() => {
  vi.stubEnv("DATA_FIXTURES", "1");
  vi.stubEnv("WHATSAPP_TOKEN", "token");
  vi.stubEnv("WHATSAPP_ACCOUNT_ID", "fixture-account");
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
  expect(broadcastChangesFrom({ subject: "Hello" }, "email")).toEqual({ subject: "Hello" });
  expect(broadcastChangesFrom({ subject: "Hello", fromName: "Jo" }, "email")).toBeUndefined();
  // Neither says the address it's from; an email may say what sends it, of what can yet.
  expect(broadcastChangesFrom({ sentFrom: "jo@pauseai.uk" }, "email")).toBeUndefined();
  expect(broadcastChangesFrom({ subject: "Hello", sendBy: "gmail" }, "email")).toEqual({
    subject: "Hello",
    sendBy: "gmail",
  });
  expect(broadcastChangesFrom({ sendBy: "postmark" }, "email")).toBeUndefined();
  expect(broadcastChangesFrom({ sendBy: "gmail" }, "text")).toBeUndefined();
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
  const own = { channel: "email" as const, topics: ["newsletter" as const] };
  expect(sameTerms(own, own)).toBe(true);
  expect(sameTerms({ ...own, topics: ["events"] }, own)).toBe(false);
  expect(sameTerms({ ...own, topics: ["newsletter", "events"] }, own)).toBe(false);
  expect(sameTerms({ ...own, channel: "text" }, own)).toBe(false);
  expect(sameTerms(undefined, own)).toBe(false);
});

describeWithDatabase("broadcasts to supporters", () => {
  useTestDatabase();
  // An email goes by hello@'s Gmail, which is connected.
  beforeEach(() => connectTestGmail(HELLO));

  it("makes a draft only from a Consent filter answered yes, from hello@ for an email and the account for a text", async () => {
    expect(await createBroadcastDraft(JO, { contact: "email:events:unsure" })).toBeUndefined();
    const email = (await getWrittenBroadcast(await draftOf({ ...EMAIL_FILTER, near: "M1" })))!;
    expect(email).toMatchObject({
      channel: "email",
      topics: ["events"],
      sentFrom: "hello@pauseai.uk",
      fromName: "PauseAI UK",
      state: "draft",
      template: null,
      filter: { list: "supporters", params: { ...EMAIL_FILTER, near: "M1" } },
    });
    vi.stubEnv("WHATSAPP_TOKEN", "token");
    expect(await getWrittenBroadcast(await draftOf(TEXT_FILTER))).toMatchObject({
      channel: "text",
      sentFrom: "+447700900000",
      fromName: "PauseAI UK",
    });
    // Where no keys are set, as on a deploy preview; a fixture build would use the fake's.
    vi.stubEnv("DATA_FIXTURES", "");
    vi.stubEnv("WHATSAPP_TOKEN", "");
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
    expect(await changeBroadcastFilter(id, { contact: "email:newsletter:yes" })).toBe(false);
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
    // An email goes on the live site too.
    const version = await readied(id, { subject: "Events", body: EVENT_WORDS });
    vi.stubEnv("DATA_FIXTURES", "");
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: true });
  });

  it("goes under several topics' yeses, keeping them through a change of Consent, and schedules", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    const id = (await createBroadcastDraft(JO, { contact: ["email:volunteering:yes", "email:newsletter:yes"] }))!;
    expect(await getWrittenBroadcast(id)).toMatchObject({ topics: ["newsletter", "volunteering"] });
    expect(await changeBroadcastConsent(id, "email:newsletter:yes email:events:yes email:volunteering:yes", JO)).toBe(
      true,
    );
    expect(await getWrittenBroadcast(id)).toMatchObject({
      topics: ["newsletter", "events", "volunteering"],
      filter: { params: { contact: ["email:newsletter:yes", "email:events:yes", "email:volunteering:yes"] } },
    });
    const version = await readied(id, { subject: "Events", body: EVENT_WORDS });
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: true });
  });

  it("holds an email by Gmail to hello@'s being connected, and one by Postmark to Postmark's sending yet", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    const id = await draftOf(EMAIL_FILTER);
    const version = await readied(id, { subject: "Events", body: EVENT_WORDS, sendBy: "gmail" });
    expect(await getWrittenBroadcast(id)).toMatchObject({ sendBy: "gmail" });
    await query(
      "UPDATE staff_accounts SET gmail_token = NULL, gmail_connected_at = NULL, gmail_history_id = NULL, gmail_name = NULL",
    );
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: false, problems: ["not-connected"] });
    await query("UPDATE mailings SET send_by = 'postmark' WHERE id = $1", [id]);
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: false, problems: ["cannot-send"] });
    await query("UPDATE mailings SET send_by = 'gmail' WHERE id = $1", [id]);
    await connectTestGmail(HELLO);
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
        To: toNotifications(),
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
    vi.stubEnv("WHATSAPP_TOKEN", "");
    expect(await submitTemplate(unready, JO)).toBe("not-ready");
    vi.stubEnv("WHATSAPP_TOKEN", "token");
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

  describe("at WhatsApp", () => {
    const TEMPLATES = /graph\.facebook\.com\/v23\.0\/fixture-account\/message_templates/;

    beforeEach(() => {
      vi.stubEnv("DATA_FIXTURES", "");
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    /** A draft text with words, ready to send for approval; its ID. */
    async function written(): Promise<number> {
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { body: EVENT_WORDS, title: "See you there." });
      return id;
    }

    it("sends new words as a marketing template, its field an example, with how to stop, keeping its ID", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      let made: Record<string, unknown> = {};
      server.use(
        http.post(TEMPLATES, async ({ request }) => {
          made = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: "meta-1", status: "PENDING", category: "MARKETING" });
        }),
      );
      const id = await written();
      expect(await submitTemplate(id, JO)).toBe("submitted");
      const template = (await getWrittenBroadcast(id))!.template!;
      expect(template.metaName).toBe(`see_you_there_${template.id}`);
      expect(made).toEqual({
        name: template.metaName,
        language: "en_GB",
        category: "MARKETING",
        parameter_format: "NAMED",
        components: [
          {
            type: "BODY",
            text: toText(letterFor(EVENT_WORDS, { values: { firstName: "{{first_name}}" }, meets: [] })),
            example: { body_text_named_params: [{ param_name: "first_name", example: "Jane" }] },
          },
          // Saying a reply of stop stops the text's topic, with no button.
          { type: "FOOTER", text: templateFooter(["events"]) },
        ],
      });
      // Its footer kept as it went, for every page to show.
      expect(await query("SELECT meta_id, footer FROM whatsapp_templates")).toEqual([
        { meta_id: "meta-1", footer: templateFooter(["events"]) },
      ]);
    });

    it("leaves the draft as it was, reporting it, when WhatsApp doesn't take the words or answer", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      server.use(http.post(TEMPLATES, () => HttpResponse.json({ error: { message: "Bad" } }, { status: 400 })));
      const rejected = await addTemplate("Old words", { status: "rejected" });
      const id = await written();
      await query("UPDATE mailings SET template_id = $2 WHERE id = $1", [id, rejected]);
      expect(await submitTemplate(id, JO)).toBe("failed");
      expect((await getWrittenBroadcast(id))!.template).toMatchObject({ id: rejected, status: "rejected" });
      expect(await query("SELECT id::int AS id FROM whatsapp_templates")).toEqual([{ id: rejected }]);
      expect(console.error).toHaveBeenCalled();
      // WhatsApp answering the check before, but not when the words go.
      let asked = 0;
      server.use(
        http.get(/phone_numbers/, () =>
          ++asked > 1
            ? HttpResponse.json({}, { status: 500 })
            : HttpResponse.json({ data: [{ id: "fixture-phone", display_phone_number: "+44 7700 900000" }] }),
        ),
      );
      expect(await submitTemplate(id, JO)).toBe("failed");
      expect(await query("SELECT action FROM audit_log WHERE action = 'submit broadcast template'")).toEqual([]);
    });

    it("deletes words taken back there too, reporting it if it can't", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const deleted: string[] = [];
      server.use(
        http.delete(TEMPLATES, ({ request }) => {
          deleted.push(new URL(request.url).searchParams.get("name")!);
          return deleted.length > 1
            ? HttpResponse.json({ error: { message: "Gone" } }, { status: 404 })
            : HttpResponse.json({ success: true });
        }),
      );
      const id = await written();
      await submitTemplate(id, JO);
      const name = (await getWrittenBroadcast(id))!.template!.metaName;
      expect(await withdrawTemplate(id, JO)).toBe(true);
      expect(deleted).toEqual([name]);
      await submitTemplate(id, JO);
      expect(await withdrawTemplate(id, JO)).toBe(true);
      expect(deleted).toHaveLength(2);
      expect(console.error).toHaveBeenCalled();
      // One made before it had a name there, only here.
      const other = await written();
      await query("UPDATE mailings SET template_id = $2 WHERE id = $1", [
        other,
        await addTemplate("Never sent", { status: "pending" }),
      ]);
      expect(await withdrawTemplate(other, JO)).toBe(true);
      expect(deleted).toHaveLength(2);
    });

    it("tests a text on a template by the name WhatsApp has it by, but not while WhatsApp doesn't answer", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const names: string[] = [];
      server.use(
        http.post(/messages$/, async ({ request }) => {
          names.push(((await request.json()) as { template: { name: string } }).template.name);
          return HttpResponse.json({ messages: [{ id: "wamid.test" }] });
        }),
      );
      const id = await draftOf(TEXT_FILTER);
      const template = await addTemplate("March day");
      await query("UPDATE whatsapp_templates SET meta_name = 'march_day_9' WHERE id = $1", [template]);
      await readied(id, { templateId: template });
      const text = (await getWrittenBroadcast(id))!;
      const to = fakeRecipient([], "text");
      expect(await sendBroadcastTest(text, to, "+447700900002")).toEqual({ sent: true, id: "wamid.test" });
      expect(names).toEqual(["march_day_9"]);
      server.use(http.get(/phone_numbers/, () => HttpResponse.json({}, { status: 500 })));
      expect(await sendBroadcastTest(text, to, "+447700900002")).toBeUndefined();
    });
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
    expect(await reviewTemplate(other, { approved: false, reason: "SCAM" })).toBe(true);
    expect(sent()[1]).toMatchObject({
      Subject: words.templateRejected.subject("Made in WhatsApp Manager"),
      TextBody: words.templateRejected.body(words.templateRejectedWhy.reasons.SCAM!, SAID, []),
    });
    expect(sent()[1].Cc).toBeUndefined();
    // WhatsApp's code is kept, and put in words where it's shown.
    expect(await query("SELECT status, rejected_reason FROM whatsapp_templates WHERE id = $1", [other])).toEqual([
      { status: "rejected", rejected_reason: "SCAM" },
    ]);
  });

  it("wants a template for a text, and a WhatsApp number for it to come from", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(TEXT_FILTER);
    const version = await readied(id, { body: EMPTY_MAILING_DOC });
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: false, problems: ["no-template"] });
    // WhatsApp answering, but with no number on the account.
    vi.stubEnv("DATA_FIXTURES", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get(/graph\.facebook\.com/, () => HttpResponse.json({ data: [] })));
    expect(await scheduleBroadcast(id, version, JO)).toEqual({
      scheduled: false,
      problems: ["no-template", "no-number"],
    });
    // No keys, as on a deploy preview: nothing sends a text, and there's no number.
    vi.stubEnv("WHATSAPP_TOKEN", "");
    expect(await scheduleBroadcast(id, version, JO)).toEqual({
      scheduled: false,
      problems: ["no-template", "no-number", "cannot-send"],
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
    expect(await changeBroadcastConsent(id, "email:newsletter:yes", JO)).toBe(true);
    expect(await getWrittenBroadcast(id)).toMatchObject({
      channel: "email",
      topics: ["newsletter"],
      subject: "Events",
      filter: { params: { contact: "email:newsletter:yes", near: "LS1" } },
    });
    // Not to a text while it has words, nor to what isn't a yes, nor once it's no draft.
    expect(await changeBroadcastConsent(id, TEXT_FILTER.contact, JO)).toBe(false);
    expect(await changeBroadcastConsent(id, "email:newsletter:unsure", JO)).toBe(false);
    expect(await changeBroadcastConsent(999, TEXT_FILTER.contact, JO)).toBe(false);
    // With none, to a text, starting afresh as one, from the business account.
    const blank = await draftOf(EMAIL_FILTER);
    expect(await changeBroadcastConsent(blank, TEXT_FILTER.contact, JO)).toBe(true);
    expect(await getWrittenBroadcast(blank)).toMatchObject({
      channel: "text",
      topics: ["events"],
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
    // It was waiting for CiviCRM, which a draft doesn't.
    await query("UPDATE mailings SET waiting_since = now(), wait_reason = 'pull' WHERE id = $1", [id]);
    expect(await stopBroadcast(id, JO)).toBe(true);
    expect(await getWrittenBroadcast(id)).toMatchObject({ state: "draft", waitingSince: null, waitReason: null });
    expect(await stopBroadcast(id, JO)).toBe(false);
    expect(await stopBroadcast(999, JO)).toBe(false);
  });

  it("sets going again one that stopped as it hadn't all gone in time, to those it didn't reach, and no other", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    await addFollower("usr-2", "sam@example.com", "Sam");
    const id = await draftOf(EMAIL_FILTER);
    await scheduleBroadcast(id, await readied(id, { subject: "Events", body: EVENT_WORDS }), JO);
    // One that isn't stopped, or that staff stopped, has nothing to resume.
    expect(await resumeBroadcast(id, JO)).toBe(false);
    expect(await resumeBroadcast(999, JO)).toBe(false);
    // It started, sent Jane's, and stopped with Sam's still to go.
    await startSending(id);
    await query("UPDATE broadcast_messages SET status = 'sent' WHERE address = 'jane@example.com'");
    await query("UPDATE broadcast_messages SET status = 'cancelled' WHERE address = 'sam@example.com'");
    const gaveUp = () =>
      query(
        `UPDATE mailings SET state = 'cancelled', gave_up = true, waiting_since = now(), wait_reason = 'limit',
           due_at = '2026-11-01T09:00:00Z' WHERE id = $1`,
        [id],
      );
    await gaveUp();
    expect(await resumeBroadcast(id, JO)).toBe(true);
    const resumed = (await getWrittenBroadcast(id))!;
    expect(resumed).toMatchObject({ state: "sending", gaveUp: false, waitingSince: null, waitReason: null });
    // From now, so it has its days again.
    expect(resumed.dueAt!.getTime()).toBeGreaterThan(Date.parse("2026-11-01T09:00:00Z"));
    expect(await query("SELECT address, status FROM broadcast_messages ORDER BY address")).toEqual([
      { address: "jane@example.com", status: "sent" },
      { address: "sam@example.com", status: "scheduled" },
    ]);
    expect(await query("SELECT actor, details FROM audit_log WHERE action = 'resume broadcast'")).toEqual([
      { actor: JO, details: { id, copies: 1 } },
    ]);
    // One that never started is scheduled again, for sending to find who it goes to.
    await query("DELETE FROM broadcast_messages");
    await gaveUp();
    expect(await resumeBroadcast(id, JO)).toBe(true);
    expect(await getWrittenBroadcast(id)).toMatchObject({ state: "scheduled", gaveUp: false });
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
    // It was waiting for CiviCRM, which one that's stopped doesn't.
    await query("UPDATE mailings SET waiting_since = now(), wait_reason = 'civicrm' WHERE id = $1", [id]);
    expect(await stopBroadcast(id, JO)).toBe(true);
    expect(await getWrittenBroadcast(id)).toMatchObject({ state: "cancelled", waitingSince: null, waitReason: null });
    expect(await query("SELECT status FROM broadcast_messages")).toEqual([{ status: "cancelled" }]);
  });

  it("tests an email by Postmark, and a text by its backend only on an approved template", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const email = (await getWrittenBroadcast(await draftOf(EMAIL_FILTER)))!;
    // A test copy is for someone made up, as the writer's preview is.
    const emailTo = fakeRecipient([], "email");
    await expect(
      sendBroadcastTest({ ...email, subject: "Hi", body: EVENT_WORDS }, emailTo, "me@pauseai.uk"),
    ).resolves.toMatchObject({
      sent: true,
    });
    const id = await draftOf(TEXT_FILTER);
    const text = (await getWrittenBroadcast(id))!;
    const textTo = fakeRecipient([], "text");
    expect(await sendBroadcastTest(text, textTo, "+447700900002")).toBeUndefined();
    await readied(id, { templateId: await addTemplate("March day") });
    const approved = (await getWrittenBroadcast(id))!;
    await expect(sendBroadcastTest(approved, textTo, "+447700900002")).resolves.toMatchObject({ sent: true });
    // Where no keys are set, as on a deploy preview; a fixture build would use the fake's.
    vi.stubEnv("DATA_FIXTURES", "");
    vi.stubEnv("WHATSAPP_TOKEN", "");
    expect(await sendBroadcastTest(approved, textTo, "+447700900002")).toBeUndefined();
  });

  it("leaves a saved draft's filter alone for saveDraft", async () => {
    const id = await draftOf(EMAIL_FILTER);
    await saveDraft(id, 1, { subject: "Hi" });
    expect((await getWrittenBroadcast(id))!.filter.params).toEqual(EMAIL_FILTER);
  });
});
