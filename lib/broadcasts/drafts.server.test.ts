import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { forgetNumbers, NUMBER_KEPT_MS } from "./channels.server";
import { query } from "@/lib/server/db.server";
import { EMPTY_MAILING_DOC, letterFor } from "@/lib/mailings/doc";
import { connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { recordGmail } from "@/tests/gmail-sends";
import { TEMPLATE_FOOTER } from "./whatsapp-template";
import { addFollower, addTemplate, EVENT_WORDS, startSending } from "@/tests/broadcast-fixtures";
import { toNotifications } from "@/tests/notifications";
import { getWrittenMailing, saveDraft } from "@/lib/mailings/drafts.server";
import {
  approvedTemplates,
  templatePairs,
  deleteApprovedTemplate,
  changeBroadcastConsent,
  changeBroadcastFilter,
  copyBroadcast,
  createBroadcastDraft,
  getWrittenBroadcast,
  broadcastChangesFrom,
  reviewTemplate,
  saveBroadcastDraft,
  sameTerms,
  scheduleBroadcast,
  sendBroadcastTest,
  resumeBroadcast,
  retimeBroadcast,
  stopBroadcast,
  submitTemplate,
  withdrawTemplate,
  type BroadcastChanges,
} from "./drafts.server";
import { fakeRecipient, FIELDS_AS_WORDS, registeredFor, TEXT_SENDER_NAME } from "./broadcasts";
import type { TextVersion } from "./text-parts";
import { keepPicture } from "./text-pictures.server";
import { toText } from "@/lib/letters/format";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readOutbox } from "@/lib/server/fixtures/outbox";
import { broadcastsCopy } from "./copy";

// WhatsApp's binding as it is, with deleting a template stood in for, so a test can have it throw what WhatsApp never would.
const { deletesTemplate } = vi.hoisted(() => ({ deletesTemplate: vi.fn() }));
vi.mock("@/lib/server/outside-services/whatsapp.server", async (original) => {
  const real = await original<typeof import("@/lib/server/outside-services/whatsapp.server")>();
  deletesTemplate.mockImplementation(real.deleteTemplate);
  return { ...real, deleteTemplate: deletesTemplate };
});

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
const PLACE = { name: "Parliament Square", address: "London SW1P 3JX", latitude: 51.5, longitude: -0.127 };
const CONFLICT = { saved: false, reason: "conflict" };
/** Words of a text's own, not an approved template's (EVENT_WORDS). */
const SATURDAY = structuredClone(EVENT_WORDS);
SATURDAY.content[0].content[2] = { type: "text", text: ", see you on Saturday." };

/** A second version, for those registered for evt-1, in SATURDAY's words on no template, with a place and a button; or as `more` says. */
const versionOf = (more: Partial<TextVersion> = {}): TextVersion => ({
  condition: registeredFor("evt-1"),
  body: SATURDAY,
  templateId: null,
  header: "location",
  place: PLACE,
  pictureId: null,
  buttons: [{ text: "Coming" }],
  ...more,
});

/** A PNG's first bytes, kept as a text's picture; its ID. */
async function aPicture(type = "image/png"): Promise<string> {
  const kept = await keepPicture({ type, content: Buffer.from([137, 80, 78, 71]) }, JO);
  if (!("id" in kept)) throw new Error("not kept");
  return kept.id;
}

beforeEach(() => {
  vi.stubEnv("DATA_FIXTURES", "1");
  vi.stubEnv("WHATSAPP_TOKEN", "token");
  vi.stubEnv("WHATSAPP_ACCOUNT_ID", "fixture-account");
});
// Each test sets Meta's answers its own way, so none sees our number as another's Meta said it.
afterEach(() => {
  vi.unstubAllEnvs();
  forgetNumbers();
});

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
  expect(broadcastChangesFrom({ sendBy: "postmark" }, "email")).toEqual({ sendBy: "postmark" });
  expect(broadcastChangesFrom({ sendBy: "pigeon" }, "email")).toBeUndefined();
  expect(broadcastChangesFrom({ sendBy: "gmail" }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ subject: "Hello" }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ sentFrom: "jo@pauseai.uk" }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ fromName: "Jo" }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ templateId: "one" }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ dueAt: FUTURE }, "text")).toEqual({ dueAt: FUTURE });
  // Either, how long it keeps trying: half a day or whole days, in minutes, or null for seven days.
  expect(broadcastChangesFrom({ finishMinutes: 720 }, "email")).toEqual({ finishMinutes: 720 });
  expect(broadcastChangesFrom({ finishMinutes: null }, "text")).toEqual({ finishMinutes: null });
  expect(broadcastChangesFrom({ finishMinutes: 1.5 }, "email")).toBeUndefined();
  expect(broadcastChangesFrom({ finishMinutes: 0 }, "email")).toBeUndefined();
  // Not a length it offers.
  expect(broadcastChangesFrom({ finishMinutes: 90 }, "email")).toBeUndefined();
  expect(broadcastChangesFrom({ finishMinutes: 8 * 24 * 60 }, "email")).toBeUndefined();
  expect(broadcastChangesFrom({ finishMinutes: "90" }, "email")).toBeUndefined();
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

it("takes a text's top, place, picture, buttons and second version, each a proper one, and none of them for an email", () => {
  const parts = { header: "location", place: PLACE, buttons: [{ text: "Coming" }], textVersion: versionOf() };
  expect(broadcastChangesFrom(parts, "text")).toEqual(parts);
  const picture = { header: "image", pictureId: "00000000-0000-4000-8000-000000000001" };
  expect(broadcastChangesFrom(picture, "text")).toEqual(picture);
  // None of each: no top, no place, no picture, no buttons, one version.
  const none = { header: null, place: null, pictureId: null, buttons: [], textVersion: null };
  expect(broadcastChangesFrom(none, "text")).toEqual(none);
  expect(broadcastChangesFrom({ header: "video" }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ place: { ...PLACE, latitude: 91 } }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ buttons: [{ words: "Coming" }] }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ pictureId: "banner.png" }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ textVersion: versionOf({ condition: "" }) }, "text")).toBeUndefined();
  expect(broadcastChangesFrom({ header: "location" }, "email")).toBeUndefined();
  expect(broadcastChangesFrom({ place: PLACE }, "email")).toBeUndefined();
  expect(broadcastChangesFrom({ buttons: [] }, "email")).toBeUndefined();
  expect(broadcastChangesFrom({ pictureId: null }, "email")).toBeUndefined();
  expect(broadcastChangesFrom({ textVersion: null }, "email")).toBeUndefined();
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

  it("copies a broadcast to a new draft: who, its words and what sends it, not when it goes", async () => {
    const id = await draftOf({ ...EMAIL_FILTER, near: "M1" });
    await readied(id, { subject: "Events", body: EVENT_WORDS, sendBy: "gmail" });
    const copy = (await copyBroadcast(id, "sam@pauseai.uk"))!;
    expect(copy).not.toBe(id);
    expect(await getWrittenBroadcast(copy)).toMatchObject({
      channel: "email",
      topics: ["events"],
      filter: { list: "supporters", params: { ...EMAIL_FILTER, near: "M1" } },
      subject: "Events",
      title: "Events",
      body: EVENT_WORDS,
      sendBy: "gmail",
      createdBy: "sam@pauseai.uk",
      sentFrom: "hello@pauseai.uk",
      dueAt: null,
      state: "draft",
    });
    expect(await copyBroadcast(999, JO)).toBeUndefined();
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

  it("goes under several topics' yeses, keeping them and those it leaves out through a change of Consent, and schedules", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    const id = (await createBroadcastDraft(JO, {
      contact: ["email:volunteering:yes", "!text:newsletter:yes", "email:newsletter:yes"],
    }))!;
    expect(await getWrittenBroadcast(id)).toMatchObject({ topics: ["newsletter", "volunteering"] });
    expect(
      await changeBroadcastConsent(id, "email:newsletter:yes email:events:yes email:volunteering:yes", JO),
    ).toEqual(expect.any(Number));
    expect(await getWrittenBroadcast(id)).toMatchObject({
      topics: ["newsletter", "events", "volunteering"],
      filter: {
        params: {
          contact: ["email:newsletter:yes", "email:events:yes", "email:volunteering:yes", "!text:newsletter:yes"],
        },
      },
    });
    const version = await readied(id, { subject: "Events", body: EVENT_WORDS });
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: true });
  });

  it("holds an email by Gmail to hello@'s being connected, but not one by Postmark", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    const id = await draftOf(EMAIL_FILTER);
    expect(await getWrittenBroadcast(id)).toMatchObject({ sendBy: "postmark" });
    const version = await readied(id, { subject: "Events", body: EVENT_WORDS, sendBy: "gmail" });
    expect(await getWrittenBroadcast(id)).toMatchObject({ sendBy: "gmail" });
    await query(
      "UPDATE staff_accounts SET gmail_token = NULL, gmail_connected_at = NULL, gmail_history_id = NULL, gmail_name = NULL",
    );
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: false, problems: ["not-connected"] });
    await connectTestGmail(HELLO);
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: true });
  });

  it("schedules an email by Postmark, as a new one is, with no Gmail connected", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    const id = await draftOf(EMAIL_FILTER);
    const version = await readied(id, { subject: "Events", body: EVENT_WORDS });
    await query(
      "UPDATE staff_accounts SET gmail_token = NULL, gmail_connected_at = NULL, gmail_history_id = NULL, gmail_name = NULL",
    );
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: true });
  });

  it("schedules a text on an approved template, or on new words, sending them for approval as it does", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const template = await addTemplate("March day");
    const on = await draftOf(TEXT_FILTER);
    expect(await scheduleBroadcast(on, await readied(on, { templateId: template }), JO)).toEqual({ scheduled: true });
    expect((await getWrittenBroadcast(on))!.template).toMatchObject({ id: template, status: "approved" });

    // New words, not the template's.
    const saturday = structuredClone(EVENT_WORDS);
    saturday.content[0].content[2] = { type: "text", text: ", see you on Saturday." };
    const fresh = await draftOf(TEXT_FILTER);
    expect(
      await scheduleBroadcast(fresh, await readied(fresh, { body: saturday, title: "See you Saturday." }), JO),
    ).toEqual({ scheduled: true });
    expect(await getWrittenBroadcast(fresh)).toMatchObject({
      state: "scheduled",
      template: { status: "pending", name: "See you Saturday.", body: saturday },
    });
    expect(await query("SELECT action FROM audit_log WHERE action = 'submit broadcast template'")).toHaveLength(1);
    // The very words of the approved template: nothing new to approve.
    const same = await draftOf(TEXT_FILTER);
    expect(
      await scheduleBroadcast(same, await readied(same, { body: EVENT_WORDS, title: "See you there." }), JO),
    ).toEqual({ scheduled: false, problems: ["same-words"] });
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
    const words = broadcastsCopy.notifications.templateSubmitted;
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
    // Scheduled while WhatsApp has them, they aren't sent again.
    expect(await scheduleBroadcast(id, version + 1, JO)).toEqual({ scheduled: true });
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

  describe("a text's top, buttons and second version", () => {
    it("saves a text's top, place, buttons and second version with the rest, replaces the version, and takes it away", async () => {
      const id = await draftOf(TEXT_FILTER);
      const broadcast = (await getWrittenBroadcast(id))!;
      expect(broadcast).toMatchObject({ header: null, place: null, buttons: [], textVersion: null });
      const parts = { header: "location" as const, place: PLACE, buttons: [{ text: "Coming" }] };
      expect(await saveBroadcastDraft(broadcast, 1, { body: EVENT_WORDS, ...parts, textVersion: versionOf() })).toEqual(
        { saved: true, version: 2 },
      );
      expect(await getWrittenBroadcast(id)).toMatchObject({
        body: EVENT_WORDS,
        ...parts,
        textVersion: { ...versionOf(), template: null },
      });
      // Saved at a version changed since, neither is.
      const plain = versionOf({ condition: "has:firstName", header: null, place: null, buttons: [] });
      expect(await saveBroadcastDraft(broadcast, 1, { body: SATURDAY, textVersion: plain })).toEqual(CONFLICT);
      expect(await getWrittenBroadcast(id)).toMatchObject({ body: EVENT_WORDS, textVersion: versionOf() });
      expect(await saveBroadcastDraft(broadcast, 2, { textVersion: plain })).toEqual({ saved: true, version: 3 });
      expect((await getWrittenBroadcast(id))!.textVersion).toEqual({ ...plain, template: null });
      expect(await saveBroadcastDraft(broadcast, 3, { textVersion: null })).toEqual({ saved: true, version: 4 });
      expect(await getWrittenBroadcast(id)).toMatchObject({ body: EVENT_WORDS, ...parts, textVersion: null });
      expect(await query("SELECT mailing_id FROM broadcast_versions")).toEqual([]);
    });

    it("saves a picture at a text's top, and at its second version's, and takes them away", async () => {
      const id = await draftOf(TEXT_FILTER);
      const broadcast = (await getWrittenBroadcast(id))!;
      expect(broadcast.pictureId).toBeNull();
      const [mine, theirs] = [await aPicture(), await aPicture("image/jpeg")];
      const pictured = versionOf({ header: "image", place: null, pictureId: theirs });
      expect(
        await saveBroadcastDraft(broadcast, 1, { header: "image", pictureId: mine, textVersion: pictured }),
      ).toEqual({ saved: true, version: 2 });
      expect(await getWrittenBroadcast(id)).toMatchObject({
        header: "image",
        pictureId: mine,
        textVersion: { header: "image", pictureId: theirs },
      });
      expect(
        await saveBroadcastDraft(broadcast, 2, {
          header: null,
          pictureId: null,
          textVersion: { ...pictured, pictureId: null },
        }),
      ).toEqual({ saved: true, version: 3 });
      expect(await getWrittenBroadcast(id)).toMatchObject({
        header: null,
        pictureId: null,
        textVersion: { pictureId: null },
      });
    });

    it("gives a text and its second version the words, top and buttons of the approved templates chosen, and none other", async () => {
      const id = await draftOf(TEXT_FILTER);
      const template = await addTemplate("March day");
      await query(`UPDATE whatsapp_templates SET header = 'location', buttons = '[{"text": "Coming"}]' WHERE id = $1`, [
        template,
      ]);
      const broadcast = (await getWrittenBroadcast(id))!;
      expect(
        await saveBroadcastDraft(broadcast, 1, {
          templateId: template,
          textVersion: versionOf({ templateId: template, header: null, buttons: [] }),
        }),
      ).toEqual({ saved: true, version: 2 });
      const parts = { body: EVENT_WORDS, header: "location", buttons: [{ text: "Coming" }] };
      expect(await getWrittenBroadcast(id)).toMatchObject({
        ...parts,
        title: "March day",
        template: { id: template },
        // Its place is its own, as each send gives it.
        textVersion: { ...parts, place: PLACE, templateId: template, template: { id: template } },
      });
      // Not one that isn't there, nor one that isn't approved.
      expect(await saveBroadcastDraft(broadcast, 2, { textVersion: versionOf({ templateId: 999 }) })).toEqual(CONFLICT);
      const pending = await addTemplate("Waiting", { status: "pending" });
      expect(await saveBroadcastDraft(broadcast, 2, { textVersion: versionOf({ templateId: pending }) })).toEqual(
        CONFLICT,
      );
    });

    it("keeps what WhatsApp is reviewing as it was sent, a text's own or its version's, but not where their maps are", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const id = await draftOf(TEXT_FILTER);
      const parts = { header: "location" as const, place: PLACE, buttons: [{ text: "Coming" }] };
      await readied(id, { body: EVENT_WORDS, title: "See you there.", ...parts, textVersion: versionOf() });
      expect(await submitTemplate(id, JO)).toBe("submitted");
      const broadcast = (await getWrittenBroadcast(id))!;
      const { version } = broadcast;
      // The version as the writer has it, on its template.
      const sent = versionOf({ templateId: broadcast.textVersion!.templateId });
      const refused: BroadcastChanges[] = [
        { header: null },
        { buttons: [] },
        { textVersion: null },
        { textVersion: { ...sent, condition: "has:firstName" } },
        { textVersion: { ...sent, templateId: null } },
        { textVersion: { ...sent, body: EVENT_WORDS } },
        { textVersion: { ...sent, header: null } },
        { textVersion: { ...sent, buttons: [] } },
      ];
      for (const changes of refused) expect(await saveBroadcastDraft(broadcast, version, changes)).toEqual(CONFLICT);
      const elsewhere = { ...PLACE, name: "Elsewhere" };
      expect(
        await saveBroadcastDraft(broadcast, version, { place: elsewhere, textVersion: { ...sent, place: elsewhere } }),
      ).toEqual({ saved: true, version: version + 1 });
      expect(await getWrittenBroadcast(id)).toMatchObject({
        place: elsewhere,
        template: { status: "pending" },
        textVersion: { place: elsewhere, body: SATURDAY, template: { status: "pending" } },
      });
    });

    it("copies a text's top, place, picture, buttons and second version", async () => {
      const id = await draftOf(TEXT_FILTER);
      await readied(id, {
        body: EVENT_WORDS,
        header: "location",
        place: PLACE,
        pictureId: await aPicture(),
        buttons: [{ text: "Coming" }],
        textVersion: versionOf({ templateId: await addTemplate("March day"), pictureId: await aPicture() }),
      });
      const { header, place, pictureId, buttons, textVersion } = (await getWrittenBroadcast(id))!;
      expect(pictureId).toEqual(expect.any(String));
      expect(textVersion!.pictureId).toEqual(expect.any(String));
      const { template, ...version } = textVersion!;
      expect(template).toMatchObject({ name: "March day" });
      const copy = (await copyBroadcast(id, JO))!;
      expect(await getWrittenBroadcast(copy)).toMatchObject({
        header,
        place,
        pictureId,
        buttons,
        textVersion: { ...version, template: { id: template!.id } },
      });
    });

    it("clears a text's top, place, picture, buttons and second version when its Consent moves it to email", async () => {
      const id = await draftOf(TEXT_FILTER);
      await readied(id, {
        header: "location",
        place: PLACE,
        pictureId: await aPicture(),
        buttons: [{ text: "Coming" }],
        textVersion: versionOf(),
      });
      expect(await changeBroadcastConsent(id, EMAIL_FILTER.contact, JO)).toEqual(expect.any(Number));
      expect(await getWrittenBroadcast(id)).toMatchObject({
        channel: "email",
        header: null,
        place: null,
        pictureId: null,
        buttons: [],
        textVersion: null,
      });
    });

    it("lists each pair of approved templates a text has had, by the newest text's title, newest first", async () => {
      const own = await addTemplate("Own");
      const version = await addTemplate("Theirs");
      const pending = await addTemplate("Waiting", { status: "pending" });
      const had = async (title: string, ownId: number, versionId: number, condition = registeredFor("evt-1")) => {
        const id = await draftOf(TEXT_FILTER);
        await query("UPDATE mailings SET template_id = $2, title = $3 WHERE id = $1", [id, ownId, title]);
        await query(
          "INSERT INTO broadcast_versions (mailing_id, condition, body, template_id) VALUES ($1, $2, $3, $4)",
          [id, condition, JSON.stringify(SATURDAY), versionId],
        );
      };
      await had("Older", own, version);
      await had("Newer", own, version);
      await had("For writers", own, version, "wrote:regulate-ai");
      // Not a pair: one not approved, and one template for both.
      await had("Waiting", own, pending);
      await had("One for both", own, own);
      expect(await templatePairs()).toEqual([
        { own, version, condition: "wrote:regulate-ai", title: "For writers" },
        { own, version, condition: registeredFor("evt-1"), title: "Newer" },
      ]);
    });

    it("sends a second version's words for approval as a template of its own, each named for who it's for, without the title's full stop", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const id = await draftOf(TEXT_FILTER);
      await readied(id, {
        body: EVENT_WORDS,
        title: "March day.",
        header: "location",
        place: PLACE,
        textVersion: versionOf(),
      });
      expect(await submitTemplate(id, JO)).toBe("submitted");
      const { template, textVersion } = (await getWrittenBroadcast(id))!;
      const who = broadcastsCopy.broadcastPages.conditions.registered("evt-1");
      expect(template).toMatchObject({
        name: broadcastsCopy.broadcastPages.othersTemplateName("March day", who),
        status: "pending",
        header: "location",
        buttons: [],
      });
      expect(textVersion!.template).toMatchObject({
        name: broadcastsCopy.broadcastPages.versionTemplateName("March day", who),
        status: "pending",
        body: SATURDAY,
        header: "location",
        buttons: [{ text: "Coming" }],
      });
      expect(await query("SELECT action FROM audit_log WHERE action = 'submit broadcast template'")).toHaveLength(2);
      expect(await submitTemplate(id, JO)).toBe("already");
      // Both taken back from WhatsApp's review.
      expect(await withdrawTemplate(id, JO)).toBe(true);
      expect(await getWrittenBroadcast(id)).toMatchObject({ template: null, textVersion: { templateId: null } });
      expect(await query("SELECT id FROM whatsapp_templates")).toEqual([]);
      // Nothing to take back for a broadcast that isn't there.
      expect(await withdrawTemplate(999, JO)).toBe(false);
    });

    it("sends one template for both when the second version would be the same template, whatever its place", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const id = await draftOf(TEXT_FILTER);
      await readied(id, {
        body: EVENT_WORDS,
        title: "March day",
        header: "location",
        place: PLACE,
        buttons: [{ text: "Coming" }],
        textVersion: versionOf({ body: EVENT_WORDS, place: { ...PLACE, name: "Elsewhere" } }),
      });
      expect(await submitTemplate(id, JO)).toBe("submitted");
      const { template, textVersion } = (await getWrittenBroadcast(id))!;
      expect(textVersion).toMatchObject({ templateId: template!.id, place: { name: "Elsewhere" } });
      expect(await query("SELECT name FROM whatsapp_templates")).toEqual([{ name: "March day" }]);
    });

    it("sends only a second version's words for a text on an approved template, named by its condition where no part has it", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const own = await addTemplate("March day");
      const id = await draftOf(TEXT_FILTER);
      await readied(id, {
        templateId: own,
        textVersion: versionOf({ condition: "has:firstName", header: null, place: null, buttons: [] }),
      });
      expect(await submitTemplate(id, JO)).toBe("submitted");
      expect(await getWrittenBroadcast(id)).toMatchObject({
        template: { id: own, status: "approved" },
        textVersion: {
          template: {
            name: broadcastsCopy.broadcastPages.versionTemplateName("March day", "has:firstName"),
            status: "pending",
          },
        },
      });
    });

    it("counts a template only a second version has as used: by drafts, and not deleted", async () => {
      const template = await addTemplate("Came before");
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { body: SATURDAY, textVersion: versionOf({ templateId: template }) });
      expect((await approvedTemplates())[0]).toMatchObject({
        id: template,
        uses: { sent: 0, scheduled: 0, drafts: 1 },
      });
      expect(await deleteApprovedTemplate(template, JO)).toBe("used");
    });

    it("makes a text whose second version's words WhatsApp rejects a draft again, emailing with it named", async () => {
      vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const id = await draftOf(TEXT_FILTER);
      const version = await readied(id, { body: EVENT_WORDS, title: "See you there.", textVersion: versionOf() });
      expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: true });
      const theirs = (await getWrittenBroadcast(id))!.textVersion!.template!.id;
      const sent = outbox();
      expect(await reviewTemplate(theirs, { approved: false, reason: "SCAM" })).toBe(true);
      expect(await getWrittenBroadcast(id)).toMatchObject({ state: "draft", textVersion: { templateId: theirs } });
      const words = broadcastsCopy.notifications;
      expect(sent()[0].TextBody).toBe(
        words.templateRejected.body(
          words.templateRejectedWhy.reasons.SCAM!,
          toText(letterFor(SATURDAY, FIELDS_AS_WORDS)),
          [`https://pauseai.uk/staff/broadcasts/${id}`],
          1,
        ),
      );
    });
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
          { type: "FOOTER", text: TEMPLATE_FOOTER },
        ],
      });
      // Its footer kept as it went, for every page to show.
      expect(await query("SELECT meta_id, footer FROM whatsapp_templates")).toEqual([
        { meta_id: "meta-1", footer: TEMPLATE_FOOTER },
      ]);
    });

    it("leaves the draft as it was, reporting it, when WhatsApp doesn't take the words or answer", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      server.use(http.post(TEMPLATES, () => HttpResponse.json({ error: { message: "Bad" } }, { status: 400 })));
      const rejected = await addTemplate("Old words", { status: "rejected" });
      const id = await written();
      await query("UPDATE mailings SET template_id = $2 WHERE id = $1", [id, rejected]);
      // With WhatsApp's reason, to show staff.
      expect(await submitTemplate(id, JO)).toEqual({ failed: "Bad" });
      expect((await getWrittenBroadcast(id))!.template).toMatchObject({ id: rejected, status: "rejected" });
      // The request itself failing gives none.
      server.use(http.post(TEMPLATES, () => HttpResponse.error()));
      expect(await submitTemplate(id, JO)).toEqual({ failed: null });
      expect(await query("SELECT id::int AS id FROM whatsapp_templates")).toEqual([{ id: rejected }]);
      expect(console.error).toHaveBeenCalled();
      // WhatsApp answering the check before, but not when the words go, the number kept from the check having gone
      // stale in between.
      forgetNumbers();
      vi.useFakeTimers({ toFake: ["Date"] });
      onTestFinished(() => void vi.useRealTimers());
      let asked = 0;
      server.use(
        http.get(/phone_numbers/, () => {
          if (++asked > 1) return HttpResponse.json({}, { status: 500 });
          vi.advanceTimersByTime(NUMBER_KEPT_MS);
          return HttpResponse.json({ data: [{ id: "fixture-phone", display_phone_number: "+44 7700 900000" }] });
        }),
      );
      // WhatsApp not reached: no reason.
      expect(await submitTemplate(id, JO)).toEqual({ failed: null });
      expect(await query("SELECT action FROM audit_log WHERE action = 'submit broadcast template'")).toEqual([]);
    });

    it("leaves a text a draft when Schedule sends its words for approval and WhatsApp doesn't take them", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      server.use(http.post(TEMPLATES, () => HttpResponse.json({ error: { message: "Bad" } }, { status: 400 })));
      const id = await written();
      const { version } = (await getWrittenBroadcast(id))!;
      expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: false, submit: { failed: "Bad" } });
      expect(await getWrittenBroadcast(id)).toMatchObject({ state: "draft", template: null });
      expect(console.error).toHaveBeenCalled();
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

    it("deletes an approved template no broadcast ever had, from WhatsApp first, keeping it here", async () => {
      const deleted: string[] = [];
      let refuse = false;
      server.use(
        http.delete(TEMPLATES, ({ request }) => {
          deleted.push(new URL(request.url).searchParams.get("name")!);
          return refuse
            ? HttpResponse.json({ error: { message: "No" } }, { status: 400 })
            : HttpResponse.json({ success: true });
        }),
      );
      const old = await addTemplate("Old words");
      await query("UPDATE whatsapp_templates SET meta_name = 'old_words_1' WHERE id = $1", [old]);
      // WhatsApp refusing: it's kept as it was, and reported.
      refuse = true;
      expect(await deleteApprovedTemplate(old, JO)).toBe("failed");
      expect(console.error).toHaveBeenCalled();
      expect((await approvedTemplates()).map((t) => t.id)).toEqual([old]);
      refuse = false;
      expect(await deleteApprovedTemplate(old, JO)).toBe("deleted");
      expect(deleted).toEqual(["old_words_1", "old_words_1"]);
      expect(
        await query(
          "SELECT status, deleted_by, deleted_at IS NOT NULL AS dated FROM whatsapp_templates WHERE id = $1",
          [old],
        ),
      ).toEqual([{ status: "deleted", deleted_by: JO, dated: true }]);
      expect(await query("SELECT actor, details FROM audit_log WHERE action = 'delete broadcast template'")).toEqual([
        { actor: JO, details: { id: old, name: "old_words_1" } },
      ]);
      expect(await approvedTemplates()).toEqual([]);
      // Gone already: nothing more to do.
      expect(await deleteApprovedTemplate(old, JO)).toBe("gone");
      // One a broadcast has, even a draft, stays; one made in WhatsApp Manager goes by its name there.
      const kept = await addTemplate("Kept");
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { templateId: kept });
      expect(await deleteApprovedTemplate(kept, JO)).toBe("used");
      const manager = await addTemplate("made_in_manager", { createdBy: null });
      expect(await deleteApprovedTemplate(manager, JO)).toBe("deleted");
      expect(deleted).toEqual(["old_words_1", "old_words_1", "made_in_manager"]);
      // With no keys, as on a deploy preview, WhatsApp can't be reached.
      vi.stubEnv("WHATSAPP_TOKEN", "");
      expect(await deleteApprovedTemplate(await addTemplate("No keys"), JO)).toBe("failed");
    });

    it("throws on anything else going wrong while deleting words taken back, which is a bug of ours, not WhatsApp failing", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const id = await written();
      await submitTemplate(id, JO);
      const thrown = new TypeError("name is undefined");
      deletesTemplate.mockRejectedValueOnce(thrown);
      vi.mocked(console.error).mockClear();
      await expect(withdrawTemplate(id, JO)).rejects.toBe(thrown);
      expect(console.error).not.toHaveBeenCalled();
    });

    it("throws on anything else going wrong while deleting an approved template, which is a bug of ours, changing nothing here", async () => {
      const old = await addTemplate("Old words");
      const thrown = new TypeError("name is undefined");
      deletesTemplate.mockRejectedValueOnce(thrown);
      await expect(deleteApprovedTemplate(old, JO)).rejects.toBe(thrown);
      expect(console.error).not.toHaveBeenCalled();
      expect((await approvedTemplates()).map((t) => t.id)).toEqual([old]);
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
      // Once the number this server kept has gone stale, and it asks again.
      forgetNumbers();
      expect(await sendBroadcastTest(text, to, "+447700900002")).toBeUndefined();
    });

    it("tests a text with a second version as the made-up recipient gets it: that version, with its place, if they meet it", async () => {
      const sent: { template: { name: string; components: { type: string }[] } }[] = [];
      server.use(
        http.post(/messages$/, async ({ request }) => {
          sent.push((await request.json()) as (typeof sent)[number]);
          return HttpResponse.json({ messages: [{ id: "wamid.test" }] });
        }),
      );
      const own = await addTemplate("March day");
      const theirs = await addTemplate("For those who came");
      await query("UPDATE whatsapp_templates SET header = 'location', body = $2 WHERE id = $1", [
        theirs,
        JSON.stringify(SATURDAY),
      ]);
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { templateId: own, textVersion: versionOf({ templateId: theirs }) });
      const text = (await getWrittenBroadcast(id))!;
      await sendBroadcastTest(text, fakeRecipient([], "text"), "+447700900002");
      await sendBroadcastTest(text, fakeRecipient([registeredFor("evt-1")], "text"), "+447700900002");
      expect(sent.map((one) => one.template.name)).toEqual(["March day", "For those who came"]);
      expect(sent.map((one) => one.template.components.map((part) => part.type))).toEqual([
        ["body"],
        ["header", "body"],
      ]);
      expect(sent[1].template.components[0]).toMatchObject({
        parameters: [{ type: "location", location: { name: PLACE.name, address: PLACE.address } }],
      });
    });

    it("sends a second version's template with a place at its top and its reply buttons", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const made: { components: unknown[] }[] = [];
      server.use(
        http.post(TEMPLATES, async ({ request }) => {
          made.push((await request.json()) as (typeof made)[number]);
          return HttpResponse.json({ id: `meta-${made.length}`, status: "PENDING", category: "MARKETING" });
        }),
      );
      const id = await draftOf(TEXT_FILTER);
      await readied(id, {
        body: EVENT_WORDS,
        title: "See you there.",
        textVersion: versionOf({ buttons: [{ text: " Coming " }] }),
      });
      expect(await submitTemplate(id, JO)).toBe("submitted");
      const footer = { type: "FOOTER", text: TEMPLATE_FOOTER };
      const body = expect.objectContaining({ type: "BODY" });
      expect(made.map((one) => one.components)).toEqual([
        [body, footer],
        [
          { type: "HEADER", format: "LOCATION" },
          body,
          footer,
          { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Coming" }] },
        ],
      ]);
    });

    it("uploads each version's picture as its template's example through the Meta app, and sends link buttons' addresses trimmed", async () => {
      vi.stubEnv("WHATSAPP_APP_ID", "app-1");
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const uploads: string[] = [];
      const made: { name: string; components: unknown[] }[] = [];
      server.use(
        http.post(/\/app-1\/uploads/, ({ request }) => {
          uploads.push(new URL(request.url).searchParams.get("file_name")!);
          return HttpResponse.json({ id: `upload:session-${uploads.length}` });
        }),
        http.post(/\/upload:session-\d$/, ({ request }) =>
          HttpResponse.json({ h: `4::${new URL(request.url).pathname.split("-").pop()}` }),
        ),
        http.post(TEMPLATES, async ({ request }) => {
          made.push((await request.json()) as (typeof made)[number]);
          return HttpResponse.json({ id: `meta-${made.length}`, status: "PENDING", category: "MARKETING" });
        }),
      );
      const id = await draftOf(TEXT_FILTER);
      await readied(id, {
        body: EVENT_WORDS,
        title: "See you there.",
        header: "image",
        pictureId: await aPicture(),
        buttons: [
          { text: "Read", url: " https://pauseai.uk/news " },
          { text: " Sign up ", url: "https://luma.com/march" },
        ],
        textVersion: versionOf({ header: "image", place: null, pictureId: await aPicture("image/jpeg"), buttons: [] }),
      });
      expect(await submitTemplate(id, JO)).toBe("submitted");
      const names = made.map((one) => one.name);
      expect(uploads).toEqual([`${names[0]}.png`, `${names[1]}.jpg`]);
      const footer = { type: "FOOTER", text: TEMPLATE_FOOTER };
      const body = expect.objectContaining({ type: "BODY" });
      expect(made.map((one) => one.components)).toEqual([
        [
          { type: "HEADER", format: "IMAGE", example: { header_handle: ["4::1"] } },
          body,
          footer,
          {
            type: "BUTTONS",
            buttons: [
              { type: "URL", text: "Read", url: "https://pauseai.uk/news" },
              { type: "URL", text: "Sign up", url: "https://luma.com/march" },
            ],
          },
        ],
        [{ type: "HEADER", format: "IMAGE", example: { header_handle: ["4::2"] } }, body, footer],
      ]);
      expect(await getWrittenBroadcast(id)).toMatchObject({
        template: {
          header: "image",
          buttons: [
            { text: "Read", url: " https://pauseai.uk/news " },
            { text: " Sign up ", url: "https://luma.com/march" },
          ],
        },
      });
    });

    it("sends no text with a picture for approval without the Meta app to upload its example through", async () => {
      vi.stubEnv("WHATSAPP_APP_ID", "");
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      let asked = 0;
      server.use(
        http.post(TEMPLATES, () => {
          asked++;
          return HttpResponse.json({ id: "meta-1", status: "PENDING", category: "MARKETING" });
        }),
      );
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { body: EVENT_WORDS, title: "See you there.", header: "image", pictureId: await aPicture() });
      expect(await submitTemplate(id, JO)).toEqual({ failed: null });
      expect(asked).toBe(0);
      expect(await getWrittenBroadcast(id)).toMatchObject({ template: null, header: "image" });
      expect(await query("SELECT id FROM whatsapp_templates")).toEqual([]);
    });

    it("tests a text with a picture at its top by the picture's address on the site", async () => {
      vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
      const sent: { template: { components: { type: string; parameters: unknown[] }[] } }[] = [];
      server.use(
        http.post(/messages$/, async ({ request }) => {
          sent.push((await request.json()) as (typeof sent)[number]);
          return HttpResponse.json({ messages: [{ id: "wamid.test" }] });
        }),
      );
      const template = await addTemplate("March day");
      await query("UPDATE whatsapp_templates SET header = 'image' WHERE id = $1", [template]);
      const picture = await aPicture();
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { templateId: template, pictureId: picture, place: PLACE });
      await sendBroadcastTest((await getWrittenBroadcast(id))!, fakeRecipient([], "text"), "+447700900002");
      // A place it kept from before is no part of a picture's text.
      expect(sent[0].template.components.map((part) => part.type)).toEqual(["header", "body"]);
      expect(sent[0].template.components[0].parameters).toEqual([
        { type: "image", image: { link: `https://pauseai.uk/api/text-pictures/${picture}` } },
      ]);
    });

    it("takes back from WhatsApp the template it took when it refuses the next, leaving the draft as it was", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const deleted: string[] = [];
      let made = 0;
      server.use(
        http.post(TEMPLATES, () =>
          ++made > 1
            ? HttpResponse.json({ error: { message: "Bad" } }, { status: 400 })
            : HttpResponse.json({ id: "meta-1", status: "PENDING", category: "MARKETING" }),
        ),
        http.delete(TEMPLATES, ({ request }) => {
          deleted.push(new URL(request.url).searchParams.get("name")!);
          return HttpResponse.json({ success: true });
        }),
      );
      const rejected = await addTemplate("Old words", { status: "rejected" });
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { body: EVENT_WORDS, title: "See you there.", textVersion: versionOf() });
      await query("UPDATE broadcast_versions SET template_id = $2 WHERE mailing_id = $1", [id, rejected]);
      expect(await submitTemplate(id, JO)).toEqual({ failed: "Bad" });
      // The one it took, everyone else's, named for who it's for.
      expect(deleted).toEqual([expect.stringMatching(/^see_you_there_for_all_but_those_who_.*_\d+$/)]);
      expect(await getWrittenBroadcast(id)).toMatchObject({ template: null, textVersion: { templateId: rejected } });
      expect(await query("SELECT id::int AS id FROM whatsapp_templates")).toEqual([{ id: rejected }]);
      expect(console.error).toHaveBeenCalled();
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
    const words = broadcastsCopy.notifications;
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
      TextBody: words.templateRejected.body(words.templateRejectedWhy.reasons.SCAM!, SAID, [], 0),
    });
    expect(sent()[1].Cc).toBeUndefined();
    // WhatsApp's code is kept, and put in words where it's shown.
    expect(await query("SELECT status, rejected_reason FROM whatsapp_templates WHERE id = $1", [other])).toEqual([
      { status: "rejected", rejected_reason: "SCAM" },
    ]);
  });

  it("makes a text scheduled on words WhatsApp rejects a draft again, saying so", async () => {
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(TEXT_FILTER);
    const version = await readied(id, { body: EVENT_WORDS, title: "See you there." });
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: true });
    // Past its time, waiting for WhatsApp.
    await query("UPDATE mailings SET waiting_since = now(), wait_reason = 'approval' WHERE id = $1", [id]);
    const template = (await getWrittenBroadcast(id))!.template!.id;
    const sent = outbox();
    expect(await reviewTemplate(template, { approved: false, reason: "SCAM" })).toBe(true);
    expect(await getWrittenBroadcast(id)).toMatchObject({ state: "draft", waitingSince: null, waitReason: null });
    const words = broadcastsCopy.notifications;
    expect(sent()[0].TextBody).toBe(
      words.templateRejected.body(
        words.templateRejectedWhy.reasons.SCAM!,
        SAID,
        [`https://pauseai.uk/staff/broadcasts/${id}`],
        1,
      ),
    );
    expect(await query("SELECT actor, details FROM audit_log WHERE action = 'unschedule broadcast'")).toEqual([
      { actor: "whatsapp", details: { id, templateId: template } },
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
    forgetNumbers();
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

  it("lists approved templates by the later of when each was approved and last used", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const unused = await addTemplate("Unused", { createdBy: null });
    const used = await addTemplate("Used");
    // Approved after the other was last sent (in 2099, as the fixtures send): first.
    const newest = await addTemplate("Newest");
    await query("UPDATE whatsapp_templates SET approved_at = '2100-01-01' WHERE id = $1", [newest]);
    await addTemplate("Rejected", { status: "rejected" });
    const id = await draftOf(TEXT_FILTER);
    await scheduleBroadcast(id, await readied(id, { templateId: used }), JO);
    await startSending(id, "sent");
    // A draft on the unused one, and another scheduled on the used one, are counted, but not as sent.
    await readied(await draftOf(TEXT_FILTER), { templateId: unused });
    const again = await draftOf(TEXT_FILTER);
    await scheduleBroadcast(again, await readied(again, { templateId: used }), JO);
    expect(await approvedTemplates()).toMatchObject([
      { id: newest, lastUsedAt: null, nextScheduledAt: null },
      {
        id: used,
        lastUsedAt: expect.anything(),
        lastUsedTo: 1,
        nextScheduledAt: expect.any(Date),
        uses: { sent: 1, scheduled: 1, drafts: 0 },
      },
      {
        id: unused,
        createdBy: null,
        lastUsedAt: null,
        lastUsedTo: 0,
        nextScheduledAt: null,
        uses: { sent: 0, scheduled: 0, drafts: 1 },
      },
    ]);
  });

  it("changes a draft's Consent, keeping its other filters, to the other channel only with no words of its own", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf({ ...EMAIL_FILTER, near: "LS1" });
    // By email still, keeping the rest of the filter and what's written.
    await readied(id, { subject: "Events", body: EVENT_WORDS });
    // It says the version it made, which the draft's writer saves at next.
    const made = await changeBroadcastConsent(id, "email:newsletter:yes", JO);
    expect(made).toBe((await getWrittenBroadcast(id))!.version);
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
    expect(await changeBroadcastConsent(blank, TEXT_FILTER.contact, JO)).toEqual(expect.any(Number));
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
           due_at = '2026-11-01T09:00:00Z', try_failed_at = now(), failed_in_a_row = 5, finish_minutes = 60 WHERE id = $1`,
        [id],
      );
    await gaveUp();
    expect(await resumeBroadcast(id, JO)).toBe(true);
    const resumed = (await getWrittenBroadcast(id))!;
    // Trying for as long as it can, whenever it stopped trying before.
    expect(resumed).toMatchObject({
      state: "sending",
      gaveUp: false,
      waitingSince: null,
      waitReason: null,
      finishMinutes: null,
    });
    // It goes at the next run, not resting after a try that failed before it stopped, and its count starts again.
    expect(await query("SELECT try_failed_at, failed_in_a_row FROM mailings WHERE id = $1", [id])).toEqual([
      { try_failed_at: null, failed_in_a_row: 0 },
    ]);
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

  it("changes when one scheduled goes and how long it keeps trying, and only how long when one sending", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    const id = await draftOf(EMAIL_FILTER);
    await scheduleBroadcast(id, await readied(id, { subject: "Events", body: EVENT_WORDS }), JO);
    await query("UPDATE mailings SET waiting_since = now(), wait_reason = 'pull' WHERE id = $1", [id]);
    const due = new Date("2099-02-03T09:33:00Z");
    expect(await retimeBroadcast(id, due, 24 * 60, JO)).toBe(true);
    // At its new time, it waits for nothing yet.
    expect(await getWrittenBroadcast(id)).toMatchObject({
      dueAt: due,
      finishMinutes: 24 * 60,
      waitingSince: null,
      waitReason: null,
    });
    expect(await retimeBroadcast(id, due, null, JO)).toBe(true);
    expect((await getWrittenBroadcast(id))!.finishMinutes).toBeNull();
    // Not a length it offers, nor a time already gone, nor with no time to go.
    expect(await retimeBroadcast(id, due, 90, JO)).toBe(false);
    expect(await retimeBroadcast(id, new Date("2020-01-01T09:03:00Z"), null, JO)).toBe(false);
    expect(await retimeBroadcast(id, undefined, null, JO)).toBe(false);
    expect(await query("SELECT details FROM audit_log WHERE action = 'change broadcast times'")).toHaveLength(2);
    // Sending, it keeps its time, and only how long changes, to stop at a time still to come; a wait stays.
    await startSending(id);
    await query("UPDATE mailings SET waiting_since = now(), wait_reason = 'civicrm' WHERE id = $1", [id]);
    const { dueAt } = (await getWrittenBroadcast(id))!;
    expect(await retimeBroadcast(id, due, 720, JO)).toBe(true);
    expect(await getWrittenBroadcast(id)).toMatchObject({ dueAt, finishMinutes: 720, waitReason: "civicrm" });
    await query("UPDATE mailings SET due_at = now() - interval '1 day' WHERE id = $1", [id]);
    expect(await retimeBroadcast(id, undefined, 720, JO)).toBe(false);
    // Sent, or not there, there's nothing to change.
    await query("UPDATE mailings SET state = 'sent' WHERE id = $1", [id]);
    expect(await retimeBroadcast(id, undefined, null, JO)).toBe(false);
    expect(await retimeBroadcast(999, undefined, null, JO)).toBe(false);
  });

  it("sends again, on Resume of one that stopped as its copies kept failing, those refused, not those that may have gone", async () => {
    for (const name of ["jane", "sam", "pat", "ann", "bo"])
      await addFollower(`usr-${name}`, `${name}@example.com`, name);
    const id = await draftOf(EMAIL_FILTER);
    await scheduleBroadcast(id, await readied(id, { subject: "Events", body: EVENT_WORDS }), JO);
    await startSending(id);
    // Jane's went; Gmail refused Sam's; Pat's send was cut off; Ann's bounced; Bo's never went.
    const failed = async (address: string, details: object, kind = "failed") => {
      await query(
        `WITH c AS (UPDATE broadcast_messages SET status = 'failed' WHERE address = $1 RETURNING id)
         INSERT INTO broadcast_message_events (message_id, kind, details) SELECT id, $3, $2 FROM c`,
        [address, JSON.stringify(details), kind],
      );
    };
    await query("UPDATE broadcast_messages SET status = 'sent' WHERE address = 'jane@example.com'");
    await failed("sam@example.com", { reason: "Gmail answered 400" });
    await failed("pat@example.com", { unfinished: true });
    await failed("ann@example.com", {}, "bounced");
    await query("UPDATE broadcast_messages SET status = 'cancelled' WHERE address = 'bo@example.com'");
    const stop = (reason: string) =>
      query(
        `UPDATE mailings SET state = 'cancelled', gave_up = true, waiting_since = now(), wait_reason = $2 WHERE id = $1`,
        [id, reason],
      );
    const statuses = () => query("SELECT address, status FROM broadcast_messages ORDER BY address");
    // Stopped for another reason, its failures stay failed: they were each one's own.
    await stop("limit");
    expect(await resumeBroadcast(id, JO)).toBe(true);
    expect((await statuses()).filter((c) => c.status === "scheduled")).toEqual([
      { address: "bo@example.com", status: "scheduled" },
    ]);
    await stop("failing");
    expect(await resumeBroadcast(id, JO)).toBe(true);
    expect(await statuses()).toEqual([
      { address: "ann@example.com", status: "failed" },
      { address: "bo@example.com", status: "scheduled" },
      { address: "jane@example.com", status: "sent" },
      { address: "pat@example.com", status: "failed" },
      { address: "sam@example.com", status: "scheduled" },
    ]);
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
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
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

  it("tests an email by what the broadcast goes by, with an unsubscribe link and headers that change nothing", async () => {
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "token");
    // Postmark and Gmail as their APIs get it, not the fixture build's fakes.
    vi.stubEnv("DATA_FIXTURES", "");
    await connectTestGmail(HELLO);
    const postmark: Record<string, unknown>[] = [];
    server.use(
      http.post("https://api.postmarkapp.com/email", async ({ request }) => {
        postmark.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ ErrorCode: 0, MessageID: "pm-test" });
      }),
    );
    const gmail = recordGmail();
    const draft = (await getWrittenBroadcast(await draftOf(EMAIL_FILTER)))!;
    const email = { ...draft, subject: "Hi", body: EVENT_WORDS };
    const to = fakeRecipient([], "email");
    const oneClick = "<https://pauseai.uk/api/unsubscribe/test-copy>";

    // By Postmark's broadcast stream, from hello@, though hello@'s Gmail is connected.
    expect(email.sendBy).toBe("postmark");
    await expect(sendBroadcastTest(email, to, "me@pauseai.uk")).resolves.toMatchObject({ sent: true });
    expect(gmail).toEqual([]);
    expect(postmark).toEqual([
      expect.objectContaining({
        From: `"PauseAI UK" <${HELLO}>`,
        Subject: "Hi",
        MessageStream: "broadcast",
        Headers: [
          { Name: "List-Unsubscribe", Value: oneClick },
          { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
        ],
      }),
    ]);
    // The link at its foot is the contact preferences page itself, and its one click unsubscribes no one.
    expect(postmark[0].TextBody).toMatch(/ https:\/\/pauseai\.uk\/contact-preferences$/);

    // By the Gmail, when that's what it goes by.
    await expect(sendBroadcastTest({ ...email, sendBy: "gmail" }, to, "me@pauseai.uk")).resolves.toMatchObject({
      sent: true,
    });
    expect(postmark).toHaveLength(1);
    expect(gmail).toHaveLength(1);
    expect(gmail[0].account).toBe(HELLO);
    expect(gmail[0].headers.get("list-unsubscribe")).toBe(oneClick);
    expect(gmail[0].text.trim()).toMatch(/ https:\/\/pauseai\.uk\/contact-preferences$/);
  });

  it("leaves a saved draft's filter alone for saveDraft", async () => {
    const id = await draftOf(EMAIL_FILTER);
    await saveDraft(id, 1, { subject: "Hi" });
    expect((await getWrittenBroadcast(id))!.filter.params).toEqual(EMAIL_FILTER);
  });
});
