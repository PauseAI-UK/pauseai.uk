import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { forgetNumbers, NUMBER_KEPT_MS } from "./channels.server";
import { query } from "@/lib/server/db.server";
import { EMPTY_MAILING_DOC, letterFor } from "@/lib/mailings/doc";
import { connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { recordGmail } from "@/tests/gmail-sends";
import { TEMPLATE_FOOTER } from "./whatsapp-template";
import {
  addFollower,
  addTemplate,
  addVariant,
  EVENT_WORDS,
  startSending,
  variantsOf,
} from "@/tests/broadcast-fixtures";
import { toNotifications } from "@/tests/notifications";
import { getWrittenMailing, saveDraft } from "@/lib/mailings/drafts.server";
import {
  approvedTemplates,
  getTemplate,
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
import { broadcastProblems, broadcastsCopy } from "./copy";

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
  // A template chosen, by its ID: a WhatsApp broadcast says none other way, as its words say which they are.
  expect(broadcastChangesFrom({ templateId: 3 }, "text")).toEqual({ templateId: 3 });
  expect(broadcastChangesFrom({ templateId: null }, "text")).toBeUndefined();
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
  // A conditional variant names no variant or template: the save tells which its words are.
  expect(broadcastChangesFrom({ textVersion: { ...versionOf(), templateId: 3 } }, "text")).toBeUndefined();
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

  it("puts a WhatsApp broadcast on the approved template chosen, or on one of its own for new words", async () => {
    const id = await draftOf(TEXT_FILTER);
    const template = await addTemplate("March day");
    const pending = await addTemplate("Waiting", { status: "pending", body: SATURDAY });
    const broadcast = (await getWrittenBroadcast(id))!;
    // Only one WhatsApp has approved every variant of can be chosen.
    for (const none of [pending, 999]) {
      expect(await saveBroadcastDraft(broadcast, 1, { templateId: none })).toEqual({
        saved: false,
        reason: "conflict",
      });
    }
    expect(await saveBroadcastDraft(broadcast, 1, { templateId: template })).toEqual({ saved: true, version: 2 });
    expect(await getWrittenBroadcast(id)).toMatchObject({
      title: "March day",
      body: EVENT_WORDS,
      template: { id: template, name: "March day", condition: null, listed: true },
      variant: { status: "approved", createdBy: JO },
    });
    // New words are a template of the draft's own, still being written, named as staff name it; and words alone
    // change no name.
    expect(await saveBroadcastDraft(broadcast, 2, { body: SATURDAY, title: "" })).toEqual({ saved: true, version: 3 });
    const written = (await getWrittenBroadcast(id))!;
    expect(written).toMatchObject({
      title: "",
      body: SATURDAY,
      template: { name: "", listed: false },
      variant: { status: "draft", name: null, body: SATURDAY },
    });
    expect(written.template!.id).not.toBe(template);
    await saveBroadcastDraft(broadcast, 3, { title: "See you Saturday" });
    await saveBroadcastDraft(broadcast, 4, { body: SATURDAY });
    expect(await getWrittenBroadcast(id)).toMatchObject({
      title: "See you Saturday",
      template: { id: written.template!.id, name: "See you Saturday" },
      variant: { id: written.variant!.id },
    });
    // Words an approved template has are that template, whatever staff called them, and the draft's own is gone.
    await saveBroadcastDraft(broadcast, 5, { body: EVENT_WORDS, title: "My own name" });
    expect(await getWrittenBroadcast(id)).toMatchObject({
      title: "March day",
      template: { id: template, listed: true },
    });
    expect(await query("SELECT id::int AS id FROM whatsapp_templates ORDER BY id")).toEqual([
      { id: template },
      { id: pending },
    ]);
    expect(await query("SELECT id FROM whatsapp_template_variants WHERE status = 'draft'")).toEqual([]);
    // With no words and no name, it has no template.
    await saveBroadcastDraft(broadcast, 6, { body: EMPTY_MAILING_DOC, title: "" });
    expect(await getWrittenBroadcast(id)).toMatchObject({ title: "", template: null, variant: null });
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
    expect(await getWrittenBroadcast(on)).toMatchObject({
      template: { id: template },
      variant: { status: "approved" },
    });

    // New words, not the template's.
    const saturday = structuredClone(EVENT_WORDS);
    saturday.content[0].content[2] = { type: "text", text: ", see you on Saturday." };
    const fresh = await draftOf(TEXT_FILTER);
    expect(
      await scheduleBroadcast(fresh, await readied(fresh, { body: saturday, title: "See you Saturday." }), JO),
    ).toEqual({ scheduled: true });
    expect(await getWrittenBroadcast(fresh)).toMatchObject({
      state: "scheduled",
      template: { name: "See you Saturday." },
      variant: { status: "pending", name: "See you Saturday.", body: saturday },
    });
    expect(await query("SELECT action FROM audit_log WHERE action = 'submit broadcast template'")).toHaveLength(1);
    // The very words of the approved template are that template, by any name: nothing new to approve.
    const same = await draftOf(TEXT_FILTER);
    expect(
      await scheduleBroadcast(same, await readied(same, { body: EVENT_WORDS, title: "See you there." }), JO),
    ).toEqual({ scheduled: true });
    expect(await getWrittenBroadcast(same)).toMatchObject({ title: "March day", template: { id: template } });
    expect(await query("SELECT action FROM audit_log WHERE action = 'submit broadcast template'")).toHaveLength(1);
    // Its words with a button of their own would be a second template of them, which WhatsApp rejects.
    const again = await draftOf(TEXT_FILTER);
    const buttoned = await readied(again, { body: EVENT_WORDS, title: "See you.", buttons: [{ text: "Coming" }] });
    expect(await scheduleBroadcast(again, buttoned, JO)).toEqual({ scheduled: false, problems: ["same-words"] });
  });

  it("sends new words for approval, emailing who sent them and the inbox, and locks them till WhatsApp decides", async () => {
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    const sent = outbox();
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(TEXT_FILTER);
    const version = await readied(id, { body: EVENT_WORDS, title: "See you there." });
    expect(await submitTemplate(id, JO)).toBe("submitted");
    const broadcast = (await getWrittenBroadcast(id))!;
    expect(broadcast.variant).toMatchObject({
      status: "pending",
      createdBy: JO,
      name: "See you there.",
      body: EVENT_WORDS,
    });
    // The draft they were sent from is gone: what WhatsApp has is the one variant.
    expect(await query("SELECT status FROM whatsapp_template_variants")).toEqual([{ status: "pending" }]);
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
    expect(await getWrittenBroadcast(id)).toMatchObject({
      title: "March day",
      template: { name: "March day" },
      variant: { name: "March day" },
    });
  });

  it("sends a rejected variant's words for approval again, as a new variant, keeping the one WhatsApp rejected", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(TEXT_FILTER);
    await readied(id, { body: EVENT_WORDS, title: "See you there." });
    const rejected = (await getWrittenBroadcast(id))!.variant!.id;
    await query(
      `UPDATE whatsapp_template_variants SET status = 'rejected', name = 'See you there.', rejected_at = now(),
         rejected_reason = 'INVALID_FORMAT' WHERE id = $1`,
      [rejected],
    );
    expect((await getWrittenBroadcast(id))!.variant).toMatchObject({
      status: "rejected",
      rejectedReason: expect.any(String),
    });
    expect(await submitTemplate(id, JO)).toBe("submitted");
    const sent = (await getWrittenBroadcast(id))!.variant!;
    expect(sent).toMatchObject({ status: "pending" });
    expect(sent.id).not.toBe(rejected);
    expect(await query("SELECT status FROM whatsapp_template_variants ORDER BY id")).toEqual([
      { status: "rejected" },
      { status: "pending" },
    ]);
  });

  it("takes words back from WhatsApp's review, so they can be changed: a draft again, with no name there", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(TEXT_FILTER);
    const version = await readied(id, { body: EVENT_WORDS, title: "See you there." });
    expect(await withdrawTemplate(id, JO)).toBe(false);
    await submitTemplate(id, JO);
    expect(await withdrawTemplate(id, JO)).toBe(true);
    const broadcast = (await getWrittenBroadcast(id))!;
    expect(broadcast).toMatchObject({
      title: "See you there.",
      body: EVENT_WORDS,
      variant: { status: "draft", name: null, metaName: null },
    });
    expect(await query("SELECT status FROM whatsapp_template_variants")).toEqual([{ status: "draft" }]);
    expect(await query("SELECT action FROM audit_log WHERE action = 'withdraw broadcast template'")).toHaveLength(1);
    // And changed they are, in place.
    expect(await saveBroadcastDraft(broadcast, version, { body: SATURDAY })).toMatchObject({ saved: true });
    expect((await getWrittenBroadcast(id))!.variant).toMatchObject({ id: broadcast.variant!.id, body: SATURDAY });
  });

  describe("a WhatsApp broadcast's variants, headers and buttons", () => {
    /** Saves `changes` to draft `id` at its version, and gives it as it's then stored. */
    const save = async (id: number, changes: BroadcastChanges) => {
      const broadcast = (await getWrittenBroadcast(id))!;
      expect(await saveBroadcastDraft(broadcast, broadcast.version, changes)).toMatchObject({ saved: true });
      return (await getWrittenBroadcast(id))!;
    };

    it("saves a header kind, what it shows, buttons and a conditional variant with the rest, replaces the variant, and takes it away", async () => {
      const id = await draftOf(TEXT_FILTER);
      const broadcast = (await getWrittenBroadcast(id))!;
      expect(broadcast).toMatchObject({ header: null, place: null, buttons: [], textVersion: null });
      const parts = { header: "location" as const, place: PLACE, buttons: [{ text: "Coming" }] };
      expect(await saveBroadcastDraft(broadcast, 1, { body: EVENT_WORDS, ...parts, textVersion: versionOf() })).toEqual(
        { saved: true, version: 2 },
      );
      const written = (await getWrittenBroadcast(id))!;
      expect(written).toMatchObject({
        body: EVENT_WORDS,
        ...parts,
        template: { condition: registeredFor("evt-1"), listed: false },
        variant: { status: "draft", header: "location", buttons: [{ text: "Coming" }] },
        textVersion: { ...versionOf(), variant: { status: "draft", body: SATURDAY } },
      });
      expect(written.textVersion!.variant.id).not.toBe(written.variant!.id);
      // Saved at a version changed since, neither is.
      const plain = versionOf({ condition: "has:firstName", header: null, place: null, buttons: [] });
      expect(await saveBroadcastDraft(broadcast, 1, { body: SATURDAY, textVersion: plain })).toEqual(CONFLICT);
      expect(await getWrittenBroadcast(id)).toMatchObject({ body: EVENT_WORDS, textVersion: versionOf() });
      // Replaced: the same draft variant, with the new words, for who it's now for.
      expect(await saveBroadcastDraft(broadcast, 2, { textVersion: plain })).toEqual({ saved: true, version: 3 });
      expect(await getWrittenBroadcast(id)).toMatchObject({
        template: { id: written.template!.id, condition: "has:firstName" },
        textVersion: { ...plain, variant: { id: written.textVersion!.variant.id } },
      });
      // Taken away, its draft variant goes, and what its header showed.
      expect(await saveBroadcastDraft(broadcast, 3, { textVersion: null })).toEqual({ saved: true, version: 4 });
      expect(await getWrittenBroadcast(id)).toMatchObject({
        body: EVENT_WORDS,
        ...parts,
        template: { condition: null },
        textVersion: null,
      });
      expect(await query("SELECT id FROM whatsapp_template_variants")).toHaveLength(1);
      expect(await query("SELECT variant FROM broadcast_headers WHERE mailing_id = $1", [id])).toEqual([
        { variant: "default" },
      ]);
    });

    it("saves the picture each variant's header shows, and takes them away", async () => {
      const id = await draftOf(TEXT_FILTER);
      expect((await getWrittenBroadcast(id))!.pictureId).toBeNull();
      const [mine, theirs] = [await aPicture(), await aPicture("image/jpeg")];
      const pictured = versionOf({ header: "image", place: null, pictureId: theirs });
      expect(await save(id, { header: "image", pictureId: mine, textVersion: pictured })).toMatchObject({
        header: "image",
        pictureId: mine,
        textVersion: { header: "image", pictureId: theirs },
      });
      expect(
        await save(id, { header: null, pictureId: null, textVersion: { ...pictured, pictureId: null } }),
      ).toMatchObject({ header: null, pictureId: null, textVersion: { pictureId: null } });
    });

    it("gives a broadcast both variants of the approved template chosen, and who the conditional one is for", async () => {
      const id = await draftOf(TEXT_FILTER);
      const template = await addTemplate("March day", {
        header: "location",
        buttons: [{ text: "Coming" }],
        condition: "has:firstName",
        conditional: { body: SATURDAY },
      });
      const { first, second } = await variantsOf(template);
      expect(await save(id, { templateId: template, place: PLACE })).toMatchObject({
        title: "March day",
        body: EVENT_WORDS,
        header: "location",
        buttons: [{ text: "Coming" }],
        place: PLACE,
        template: { id: template, condition: "has:firstName", listed: true },
        variant: { id: first },
        textVersion: { condition: "has:firstName", body: SATURDAY, header: null, buttons: [], variant: { id: second } },
      });
      // Not one with a variant WhatsApp hasn't approved.
      const waiting = await addTemplate("Waiting", {
        body: SATURDAY,
        conditional: { status: "pending" },
        condition: "x",
      });
      const broadcast = (await getWrittenBroadcast(id))!;
      expect(await saveBroadcastDraft(broadcast, broadcast.version, { templateId: waiting })).toEqual(CONFLICT);
      // One template alone after, the conditional variant is gone.
      const alone = await addTemplate("Alone", { body: SATURDAY });
      expect(await save(id, { templateId: alone })).toMatchObject({
        title: "Alone",
        body: SATURDAY,
        template: { id: alone, condition: null },
        textVersion: null,
      });
    });

    it("tells which variant each one's words are: an approved one's are that variant, shared, and other words a draft of its own", async () => {
      const id = await draftOf(TEXT_FILTER);
      const march = await addTemplate("March day");
      const { first: marchWords } = await variantsOf(march);
      // New words for some, beside an approved template's for everyone else: only theirs is a draft.
      const mixed = await save(id, { body: EVENT_WORDS, title: "March day, two ways", textVersion: versionOf() });
      expect(mixed).toMatchObject({
        title: "March day, two ways",
        template: { listed: false },
        variant: { id: marchWords, status: "approved" },
        textVersion: { variant: { status: "draft" } },
      });
      expect(mixed.template!.id).not.toBe(march);
      // A place or a picture is the broadcast's own: the same variants, on the same template.
      const elsewhere = { ...PLACE, name: "Elsewhere" };
      expect(
        await save(id, { place: elsewhere, textVersion: versionOf({ place: elsewhere, pictureId: await aPicture() }) }),
      ).toMatchObject({
        place: elsewhere,
        template: { id: mixed.template!.id },
        variant: { id: marchWords },
        textVersion: { place: elsewhere, variant: { id: mixed.textVersion!.variant.id } },
      });
      // The same words for both are one variant for both; with every variant approved, a template of its own
      // that can be chosen, named as staff named it.
      const both = await save(id, { textVersion: versionOf({ body: EVENT_WORDS, header: null, buttons: [] }) });
      expect(both).toMatchObject({
        title: "March day, two ways",
        template: { id: mixed.template!.id, listed: true },
        variant: { id: marchWords },
        textVersion: { variant: { id: marchWords } },
      });
      expect((await approvedTemplates()).map((one) => one.name).sort()).toEqual(["March day", "March day, two ways"]);
      expect(await query("SELECT id FROM whatsapp_template_variants WHERE status = 'draft'")).toEqual([]);
      // Another draft with those variants and that condition is on that template; with none, on the first.
      const other = await draftOf(TEXT_FILTER);
      expect(
        await save(other, {
          body: EVENT_WORDS,
          textVersion: versionOf({ body: EVENT_WORDS, header: null, buttons: [] }),
        }),
      ).toMatchObject({ title: "March day, two ways", template: { id: both.template!.id } });
      expect(await save(other, { textVersion: null })).toMatchObject({ title: "March day", template: { id: march } });
      // An approved template is never changed: words changed on it are a template of the draft's own.
      const changed = await save(other, { body: SATURDAY });
      expect(changed).toMatchObject({ body: SATURDAY, template: { listed: false }, variant: { status: "draft" } });
      expect(changed.template!.id).not.toBe(march);
      expect((await getTemplate(march))!.default.body).toEqual(EVENT_WORDS);
    });

    it("keeps a conditional variant through a save from a page that hasn't heard WhatsApp approved it, or that it was taken back", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const elsewhere = { ...PLACE, name: "Elsewhere" };
      // The page saves the variant whole, naming none, so it can't say the wrong one.
      const moved = async (id: number) =>
        (await save(id, { textVersion: versionOf({ place: elsewhere }) })).textVersion;
      // Taken back since the page loaded: its place moved, they're a draft still.
      const withdrawn = await draftOf(TEXT_FILTER);
      await readied(withdrawn, { templateId: await addTemplate("April day"), textVersion: versionOf() });
      expect(await submitTemplate(withdrawn, JO)).toBe("submitted");
      expect(await withdrawTemplate(withdrawn, JO)).toBe(true);
      expect(await moved(withdrawn)).toMatchObject({ place: elsewhere, variant: { status: "draft" } });
      await save(withdrawn, { textVersion: null });
      // Approved since the page loaded: its place moved, it's the approved variant still.
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { templateId: await addTemplate("March day"), textVersion: versionOf() });
      expect(await submitTemplate(id, JO)).toBe("submitted");
      const theirs = (await getWrittenBroadcast(id))!.textVersion!.variant.id;
      await reviewTemplate(theirs, { approved: true });
      expect(await moved(id)).toMatchObject({ place: elsewhere, variant: { id: theirs, status: "approved" } });
    });

    it("keeps the variant WhatsApp rejected as its words change, to say why till they're sent again", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { body: EVENT_WORDS, title: "See you there.", textVersion: versionOf() });
      expect(await submitTemplate(id, JO)).toBe("submitted");
      const sent = (await getWrittenBroadcast(id))!;
      await reviewTemplate(sent.variant!.id, { approved: false, reason: "SCAM" });
      await reviewTemplate(sent.textVersion!.variant.id, { approved: false, reason: "SCAM" });
      const other = structuredClone(SATURDAY);
      other.content[0].content[0] = { type: "text", text: "Rain is forecast." };
      expect(await save(id, { body: other, textVersion: versionOf({ body: EVENT_WORDS }) })).toMatchObject({
        body: other,
        variant: { id: sent.variant!.id, status: "rejected", rejectedReason: "SCAM" },
        textVersion: { body: EVENT_WORDS, variant: { id: sent.textVersion!.variant.id, status: "rejected" } },
      });
    });

    it("keeps what WhatsApp is reviewing as it was sent, either variant's, but not what their headers show", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const id = await draftOf(TEXT_FILTER);
      const parts = { header: "location" as const, place: PLACE, buttons: [{ text: "Coming" }] };
      await readied(id, { body: EVENT_WORDS, title: "See you there.", ...parts, textVersion: versionOf() });
      expect(await submitTemplate(id, JO)).toBe("submitted");
      const broadcast = (await getWrittenBroadcast(id))!;
      const { version } = broadcast;
      // The conditional variant as the writer has it, whole.
      const sent = versionOf();
      const approved = await addTemplate("March day", { body: SATURDAY });
      const refused: BroadcastChanges[] = [
        { header: null },
        { buttons: [] },
        { body: SATURDAY },
        { templateId: approved },
        { textVersion: null },
        { textVersion: { ...sent, condition: "has:firstName" } },
        { textVersion: { ...sent, body: EVENT_WORDS } },
        { textVersion: { ...sent, header: null } },
        { textVersion: { ...sent, buttons: [] } },
      ];
      for (const changes of refused) expect(await saveBroadcastDraft(broadcast, version, changes)).toEqual(CONFLICT);
      const elsewhere = { ...PLACE, name: "Elsewhere" };
      expect(
        await saveBroadcastDraft(broadcast, version, {
          place: elsewhere,
          title: "See you",
          body: EVENT_WORDS,
          textVersion: { ...sent, place: elsewhere },
        }),
      ).toEqual({ saved: true, version: version + 1 });
      expect(await getWrittenBroadcast(id)).toMatchObject({
        place: elsewhere,
        title: "See you",
        variant: { id: broadcast.variant!.id, status: "pending" },
        textVersion: { place: elsewhere, body: SATURDAY, variant: { status: "pending" } },
      });
    });

    it("copies an approved template as it is, and one still being written with draft variants of its own", async () => {
      const id = await draftOf(TEXT_FILTER);
      const approved = await addTemplate("March day");
      await readied(id, {
        templateId: approved,
        header: null,
        place: PLACE,
        pictureId: await aPicture(),
        textVersion: versionOf({ pictureId: await aPicture() }),
      });
      const from = (await getWrittenBroadcast(id))!;
      expect(from).toMatchObject({ template: { listed: false }, variant: { status: "approved" } });
      const copy = (await getWrittenBroadcast((await copyBroadcast(id, JO))!))!;
      expect(copy).toMatchObject({
        title: from.title,
        body: from.body,
        place: from.place,
        pictureId: from.pictureId,
        template: { name: from.template!.name, condition: from.template!.condition, listed: false },
        // The approved variant shared, the draft one a copy.
        variant: { id: from.variant!.id },
        textVersion: { ...versionOf({ pictureId: from.textVersion!.pictureId }), variant: { status: "draft" } },
      });
      expect(copy.template!.id).not.toBe(from.template!.id);
      expect(copy.textVersion!.variant.id).not.toBe(from.textVersion!.variant.id);
      // Changing the copy's words leaves the first one's.
      await save(copy.id, { textVersion: versionOf({ body: EVENT_WORDS, buttons: [] }) });
      expect((await getWrittenBroadcast(id))!.textVersion).toMatchObject({ body: SATURDAY });
      // A copy of one on an approved template is on that template.
      const on = await draftOf(TEXT_FILTER);
      await readied(on, { templateId: approved });
      expect(await getWrittenBroadcast((await copyBroadcast(on, JO))!)).toMatchObject({ template: { id: approved } });
      // One draft variant for both, where their words are the same, is one in the copy too, its own.
      const same = await draftOf(TEXT_FILTER);
      await readied(same, {
        body: SATURDAY,
        title: "Saturday",
        textVersion: versionOf({ header: null, place: null, buttons: [] }),
      });
      const both = (await getWrittenBroadcast(same))!;
      expect(both.textVersion!.variant.id).toBe(both.variant!.id);
      const copied = (await getWrittenBroadcast((await copyBroadcast(same, JO))!))!;
      expect(copied.textVersion!.variant.id).toBe(copied.variant!.id);
      expect(copied.variant).toMatchObject({ status: "draft", body: SATURDAY });
      expect(copied.variant!.id).not.toBe(both.variant!.id);
    });

    it("copies a template's variants WhatsApp is reviewing or rejected as drafts of the copy's own, so neither changes the other", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { body: EVENT_WORDS, title: "March day", textVersion: versionOf() });
      expect(await submitTemplate(id, JO)).toBe("submitted");
      // WhatsApp rejects the default variant's words, and is still reviewing the conditional one's.
      const before = (await getWrittenBroadcast(id))!;
      await query(
        "UPDATE whatsapp_template_variants SET status = 'rejected', rejected_at = now(), rejected_reason = 'INVALID_FORMAT' WHERE id = $1",
        [before.variant!.id],
      );
      const copy = (await getWrittenBroadcast((await copyBroadcast(id, JO))!))!;
      expect(copy).toMatchObject({ variant: { status: "draft" }, textVersion: { variant: { status: "draft" } } });
      expect(copy.variant!.id).not.toBe(before.variant!.id);
      expect(copy.textVersion!.variant.id).not.toBe(before.textVersion!.variant.id);
      // The copy's words changed leave the first one's; taking the copy's back from WhatsApp, there's nothing to.
      await save(copy.id, { body: SATURDAY });
      expect(await withdrawTemplate(copy.id, JO)).toBe(false);
      expect(await getWrittenBroadcast(id)).toMatchObject({
        body: EVENT_WORDS,
        variant: { status: "rejected" },
        textVersion: { variant: { status: "pending" } },
      });
    });

    it("clears a broadcast's template and what its headers show when its Consent moves it to email", async () => {
      const id = await draftOf(TEXT_FILTER);
      await readied(id, {
        header: "location",
        place: PLACE,
        pictureId: await aPicture(),
        buttons: [{ text: "Coming" }],
      });
      // It has words of its own only once it has a subject or a template, so a header alone moves.
      await query("UPDATE mailings SET template_id = NULL WHERE id = $1", [id]);
      expect(await changeBroadcastConsent(id, EMAIL_FILTER.contact, JO)).toEqual(expect.any(Number));
      expect(await getWrittenBroadcast(id)).toMatchObject({
        channel: "email",
        template: null,
        header: null,
        place: null,
        pictureId: null,
        buttons: [],
        textVersion: null,
      });
      expect(await query("SELECT id FROM whatsapp_templates")).toEqual([]);
      expect(await query("SELECT id FROM whatsapp_template_variants")).toEqual([]);
    });

    it("lists a template with two variants once WhatsApp has approved both, with who the conditional one is for", async () => {
      const both = await addTemplate("Both", { condition: "has:firstName", conditional: { body: SATURDAY } });
      await addTemplate("Half", { condition: "has:firstName", conditional: { body: SATURDAY, status: "pending" } });
      await addTemplate("Stopped", { status: "paused" });
      expect(await approvedTemplates()).toEqual([
        expect.objectContaining({
          id: both,
          name: "Both",
          condition: "has:firstName",
          default: expect.objectContaining({ status: "approved", body: EVENT_WORDS }),
          conditional: expect.objectContaining({ status: "approved", body: SATURDAY }),
          approvedAt: expect.any(Date),
        }),
      ]);
    });

    it("sends each variant's new words for approval, each named for who it's for, without the name's full stop", async () => {
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
      const { template, variant, textVersion } = (await getWrittenBroadcast(id))!;
      const who = broadcastsCopy.broadcastPages.conditions.registered("evt-1");
      expect(template).toMatchObject({ name: "March day.", listed: false });
      expect(variant).toMatchObject({
        name: broadcastsCopy.broadcastPages.othersTemplateName("March day", who),
        status: "pending",
        header: "location",
        buttons: [],
      });
      expect(textVersion!.variant).toMatchObject({
        name: broadcastsCopy.broadcastPages.versionTemplateName("March day", who),
        status: "pending",
        body: SATURDAY,
        header: "location",
        buttons: [{ text: "Coming" }],
      });
      expect(await query("SELECT action FROM audit_log WHERE action = 'submit broadcast template'")).toHaveLength(2);
      expect(await submitTemplate(id, JO)).toBe("already");
      // Both taken back from WhatsApp's review: drafts again.
      expect(await withdrawTemplate(id, JO)).toBe(true);
      expect(await getWrittenBroadcast(id)).toMatchObject({
        variant: { status: "draft" },
        textVersion: { variant: { status: "draft" } },
      });
      expect(await query("SELECT status FROM whatsapp_template_variants")).toEqual([
        { status: "draft" },
        { status: "draft" },
      ]);
      // Nothing to take back for a broadcast that isn't there.
      expect(await withdrawTemplate(999, JO)).toBe(false);
    });

    it("sends one variant for both when their words, header kind and buttons are the same, whatever each header shows", async () => {
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
      const { variant, textVersion } = (await getWrittenBroadcast(id))!;
      expect(textVersion).toMatchObject({ variant: { id: variant!.id }, place: { name: "Elsewhere" } });
      expect(await query("SELECT name, status FROM whatsapp_template_variants")).toEqual([
        { name: "March day", status: "pending" },
      ]);
    });

    it("sends only the conditional variant's words for a broadcast whose default one is approved, named by its condition where no part has it", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const own = await addTemplate("March day");
      const id = await draftOf(TEXT_FILTER);
      await readied(id, {
        templateId: own,
        textVersion: versionOf({ condition: "has:firstName", header: null, place: null, buttons: [] }),
      });
      expect(await submitTemplate(id, JO)).toBe("submitted");
      expect(await getWrittenBroadcast(id)).toMatchObject({
        variant: { id: (await variantsOf(own)).first, status: "approved" },
        textVersion: {
          variant: {
            name: broadcastsCopy.broadcastPages.versionTemplateName("March day", "has:firstName"),
            status: "pending",
          },
        },
      });
    });

    it("sends only the default variant's words for a broadcast whose conditional one is another, approved", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const theirs = await addTemplate("For those with a name", { body: SATURDAY });
      const id = await draftOf(TEXT_FILTER);
      await readied(id, {
        body: EVENT_WORDS,
        title: "March day",
        textVersion: versionOf({ condition: "has:firstName", header: null, place: null, buttons: [] }),
      });
      expect(await submitTemplate(id, JO)).toBe("submitted");
      expect(await getWrittenBroadcast(id)).toMatchObject({
        variant: {
          name: broadcastsCopy.broadcastPages.othersTemplateName("March day", "has:firstName"),
          status: "pending",
        },
        textVersion: { variant: { id: (await variantsOf(theirs)).first, status: "approved" } },
      });
    });

    it("sends a conditional variant's new words for approval when a broadcast on an approved template is scheduled, and again once WhatsApp rejects them", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const own = await addTemplate("March day");
      const id = await draftOf(TEXT_FILTER);
      const version = await readied(id, {
        templateId: own,
        textVersion: versionOf({ condition: "has:firstName", header: null, place: null, buttons: [] }),
      });
      expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: true });
      const scheduled = (await getWrittenBroadcast(id))!;
      expect(scheduled).toMatchObject({
        state: "scheduled",
        variant: { status: "approved" },
        textVersion: { variant: { status: "pending" } },
      });
      expect(await query("SELECT action FROM audit_log WHERE action = 'submit broadcast template'")).toHaveLength(1);
      // Rejected, it's a draft again, and scheduling it sends the variant's words afresh.
      const rejected = scheduled.textVersion!.variant.id;
      await reviewTemplate(rejected, { approved: false, reason: "SCAM" });
      const draft = (await getWrittenBroadcast(id))!;
      expect(draft).toMatchObject({ state: "draft", textVersion: { variant: { status: "rejected" } } });
      expect(await scheduleBroadcast(id, draft.version, JO)).toEqual({ scheduled: true });
      const again = (await getWrittenBroadcast(id))!;
      expect(again).toMatchObject({ state: "scheduled", textVersion: { variant: { status: "pending" } } });
      expect(again.textVersion!.variant.id).not.toBe(rejected);
    });

    it("schedules and sends for approval no broadcast whose variants have the same new words but other buttons", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const id = await draftOf(TEXT_FILTER);
      const version = await readied(id, {
        body: SATURDAY,
        title: "March day",
        textVersion: versionOf({ header: null, place: null }),
      });
      expect(await scheduleBroadcast(id, version, JO)).toEqual({
        scheduled: false,
        problems: ["versions-same-words"],
      });
      expect(await submitTemplate(id, JO)).toBe("not-ready");
      expect(await query("SELECT status FROM whatsapp_template_variants")).toEqual([
        { status: "draft" },
        { status: "draft" },
      ]);
    });

    it("counts a template as used by the drafts on it, and deletes none that's used", async () => {
      const template = await addTemplate("Came before", {
        condition: "has:firstName",
        conditional: { body: SATURDAY },
      });
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { templateId: template });
      expect((await approvedTemplates())[0]).toMatchObject({
        id: template,
        uses: { sent: 0, scheduled: 0, drafts: 1 },
      });
      expect(await deleteApprovedTemplate(template, JO)).toBe("used");
    });

    it("makes a broadcast whose conditional variant WhatsApp rejects a draft again, emailing with it named", async () => {
      vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      const id = await draftOf(TEXT_FILTER);
      const version = await readied(id, { body: EVENT_WORDS, title: "See you there.", textVersion: versionOf() });
      expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: true });
      const theirs = (await getWrittenBroadcast(id))!.textVersion!.variant.id;
      const sent = outbox();
      expect(await reviewTemplate(theirs, { approved: false, reason: "SCAM" })).toBe(true);
      expect(await getWrittenBroadcast(id)).toMatchObject({
        state: "draft",
        textVersion: { variant: { id: theirs, status: "rejected" } },
      });
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

    /** Makes draft `id`'s default variant one WhatsApp rejected, or has with no name there yet; its ID. */
    async function variantNow(id: number, status: "rejected" | "pending"): Promise<number> {
      const variant = (await getWrittenBroadcast(id))!.variant!.id;
      await query(
        `UPDATE whatsapp_template_variants SET status = $2, name = 'Old words',
           rejected_at = CASE WHEN $2 = 'rejected' THEN now() END,
           rejected_reason = CASE WHEN $2 = 'rejected' THEN 'INVALID_FORMAT' END
         WHERE id = $1`,
        [variant, status],
      );
      return variant;
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
      const template = (await getWrittenBroadcast(id))!.variant!;
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
      expect(await query("SELECT meta_id, footer FROM whatsapp_template_variants")).toEqual([
        { meta_id: "meta-1", footer: TEMPLATE_FOOTER },
      ]);
    });

    it("leaves the draft as it was, reporting it, when WhatsApp doesn't take the words or answer", async () => {
      await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
      server.use(http.post(TEMPLATES, () => HttpResponse.json({ error: { message: "Bad" } }, { status: 400 })));
      const id = await written();
      const rejected = await variantNow(id, "rejected");
      // With WhatsApp's reason, to show staff.
      expect(await submitTemplate(id, JO)).toEqual({ failed: "Bad" });
      expect((await getWrittenBroadcast(id))!.variant).toMatchObject({ id: rejected, status: "rejected" });
      // The request itself failing gives none.
      server.use(http.post(TEMPLATES, () => HttpResponse.error()));
      expect(await submitTemplate(id, JO)).toEqual({ failed: null });
      expect(await query("SELECT id::int AS id FROM whatsapp_template_variants")).toEqual([{ id: rejected }]);
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
      expect(await getWrittenBroadcast(id)).toMatchObject({ state: "draft", variant: { status: "draft" } });
      expect(await query("SELECT status FROM whatsapp_template_variants")).toEqual([{ status: "draft" }]);
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
      const name = (await getWrittenBroadcast(id))!.variant!.metaName;
      expect(await withdrawTemplate(id, JO)).toBe(true);
      expect(deleted).toEqual([name]);
      await submitTemplate(id, JO);
      expect(await withdrawTemplate(id, JO)).toBe(true);
      expect(deleted).toHaveLength(2);
      expect(console.error).toHaveBeenCalled();
      // One made before it had a name there, only here.
      const other = await draftOf(TEXT_FILTER);
      await readied(other, { body: SATURDAY, title: "Never sent" });
      await variantNow(other, "pending");
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
      const { first } = await variantsOf(old);
      await query("UPDATE whatsapp_template_variants SET meta_name = 'old_words_1' WHERE id = $1", [first]);
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
          "SELECT status, deleted_by, deleted_at IS NOT NULL AS dated FROM whatsapp_template_variants WHERE id = $1",
          [first],
        ),
      ).toEqual([{ status: "deleted", deleted_by: JO, dated: true }]);
      expect(await query("SELECT id FROM whatsapp_templates WHERE id = $1", [old])).toEqual([]);
      expect(await query("SELECT actor, details FROM audit_log WHERE action = 'delete broadcast template'")).toEqual([
        { actor: JO, details: { id: old, name: "Old words" } },
      ]);
      expect(await approvedTemplates()).toEqual([]);
      // Gone already: nothing more to do.
      expect(await deleteApprovedTemplate(old, JO)).toBe("gone");
      // One a broadcast has, even a draft, stays; one made in WhatsApp Manager goes by its name there.
      const kept = await addTemplate("Kept");
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { templateId: kept });
      expect(await deleteApprovedTemplate(kept, JO)).toBe("used");
      const manager = await addTemplate("made_in_manager", { createdBy: null, body: SATURDAY });
      expect(await deleteApprovedTemplate(manager, JO)).toBe("deleted");
      expect(deleted).toEqual(["old_words_1", "old_words_1", "made_in_manager"]);
      // A variant another template has too stays at WhatsApp: only the template goes.
      const shared = await addTemplate("Shared");
      await query(
        `INSERT INTO whatsapp_templates (name, condition, default_variant_id, conditional_variant_id)
         SELECT 'Shared, two ways', 'has:firstName', default_variant_id, default_variant_id
         FROM whatsapp_templates WHERE id = $1`,
        [shared],
      );
      expect(await deleteApprovedTemplate(shared, JO)).toBe("deleted");
      expect(deleted).toHaveLength(3);
      expect((await approvedTemplates()).map((t) => t.name)).toEqual(["Shared, two ways", "Kept"]);
      // One with two variants of its own takes both from WhatsApp.
      const two = await addTemplate("Two ways", { condition: "has:firstName", conditional: { body: SATURDAY } });
      expect(await deleteApprovedTemplate(two, JO)).toBe("deleted");
      expect(deleted.slice(3).sort()).toEqual(["Two ways", "Two ways, for some"]);
      // With no keys, as on a deploy preview, WhatsApp can't be reached.
      vi.stubEnv("WHATSAPP_TOKEN", "");
      expect(await deleteApprovedTemplate(await addTemplate("No keys"), JO)).toBe("failed");
    });

    it("keeps what WhatsApp deleted as deleted, and the template gone, when it refuses another of its variants", async () => {
      const deleted: string[] = [];
      server.use(
        http.delete(TEMPLATES, ({ request }) => {
          const name = new URL(request.url).searchParams.get("name")!;
          deleted.push(name);
          return name.endsWith("for some")
            ? HttpResponse.json({ error: { message: "No" } }, { status: 400 })
            : HttpResponse.json({ success: true });
        }),
      );
      const two = await addTemplate("Two ways", { condition: "has:firstName", conditional: { body: SATURDAY } });
      const { first, second } = await variantsOf(two);
      expect(await deleteApprovedTemplate(two, JO)).toBe("failed");
      expect(deleted).toEqual(["Two ways", "Two ways, for some"]);
      // The one WhatsApp deleted is deleted here too, so nothing sends on it; the template, half gone, can't be
      // chosen; the other is kept as it is at WhatsApp.
      const states = await query<{ id: number; status: string }>(
        "SELECT id::int AS id, status FROM whatsapp_template_variants WHERE id = ANY($1) ORDER BY id",
        [[first, second]],
      );
      expect(states).toEqual([
        { id: first, status: "deleted" },
        { id: second, status: "approved" },
      ]);
      expect(await query("SELECT id FROM whatsapp_templates WHERE id = $1", [two])).toEqual([]);
      expect(await approvedTemplates()).toEqual([]);
      expect(await query("SELECT details FROM audit_log WHERE action = 'delete broadcast template'")).toEqual([
        { details: { id: two, name: "Two ways" } },
      ]);
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
      await query("UPDATE whatsapp_template_variants SET meta_name = 'march_day_9' WHERE id = $1", [
        (await variantsOf(template)).first,
      ]);
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
      const template = await addTemplate("March day", {
        condition: registeredFor("evt-1"),
        conditional: { body: SATURDAY, header: "location", buttons: [{ text: "Coming" }] },
      });
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { templateId: template, textVersion: versionOf() });
      const text = (await getWrittenBroadcast(id))!;
      expect(text.template).toMatchObject({ id: template, listed: true });
      await sendBroadcastTest(text, fakeRecipient([], "text"), "+447700900002");
      await sendBroadcastTest(text, fakeRecipient([registeredFor("evt-1")], "text"), "+447700900002");
      expect(sent.map((one) => one.template.name)).toEqual(["March day", "March day, for some"]);
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
        variant: {
          header: "image",
          buttons: [
            { text: "Read", url: " https://pauseai.uk/news " },
            { text: " Sign up ", url: "https://luma.com/march" },
          ],
        },
      });
    });

    it("sends no text with a picture for approval without the Meta app to upload its example through, saying so and reporting it", async () => {
      vi.stubEnv("WHATSAPP_APP_ID", "");
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
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
      expect(await submitTemplate(id, JO)).toBe("no-app");
      expect(error.mock.calls.map(([what]) => what)).toEqual([broadcastProblems.noMetaApp().what]);
      expect(asked).toBe(0);
      expect(await getWrittenBroadcast(id)).toMatchObject({ variant: { status: "draft" }, header: "image" });
      expect(await query("SELECT status FROM whatsapp_template_variants")).toEqual([{ status: "draft" }]);
      // A second version's picture needs the app as much, though the text's own words have no picture.
      const two = await draftOf(TEXT_FILTER);
      await readied(two, {
        body: EVENT_WORDS,
        title: "See you there.",
        textVersion: versionOf({ header: "image", place: null, pictureId: await aPicture(), buttons: [] }),
      });
      expect(await submitTemplate(two, JO)).toBe("no-app");
      // With no picture, a text needs no app.
      const plain = await draftOf(TEXT_FILTER);
      await readied(plain, { body: EVENT_WORDS, title: "See you there." });
      expect(await submitTemplate(plain, JO)).toBe("submitted");
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
      const template = await addTemplate("March day", { header: "image" });
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
      const id = await draftOf(TEXT_FILTER);
      await readied(id, { body: EVENT_WORDS, title: "See you there.", textVersion: versionOf() });
      // Its conditional variant one WhatsApp rejected before.
      const rejected = (await getWrittenBroadcast(id))!.textVersion!.variant.id;
      await query(
        `UPDATE whatsapp_template_variants SET status = 'rejected', name = 'Old words', rejected_at = now(),
           rejected_reason = 'INVALID_FORMAT' WHERE id = $1`,
        [rejected],
      );
      expect(await submitTemplate(id, JO)).toEqual({ failed: "Bad" });
      // The one it took, everyone else's, named for who it's for.
      expect(deleted).toEqual([expect.stringMatching(/^see_you_there_for_all_but_those_who_.*_\d+$/)]);
      expect(await getWrittenBroadcast(id)).toMatchObject({
        variant: { status: "draft" },
        textVersion: { variant: { id: rejected, status: "rejected" } },
      });
      expect(await query("SELECT status FROM whatsapp_template_variants ORDER BY id")).toEqual([
        { status: "draft" },
        { status: "rejected" },
      ]);
      expect(console.error).toHaveBeenCalled();
    });
  });

  it("records WhatsApp's decision, emailing who sent the words and the inbox, with the texts on them", async () => {
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(TEXT_FILTER);
    const version = await readied(id, { body: EVENT_WORDS, title: "See you there." });
    await submitTemplate(id, JO);
    const template = (await getWrittenBroadcast(id))!.variant!.id;
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

    const other = await addVariant("Made in WhatsApp Manager", { status: "pending", createdBy: null });
    expect(await reviewTemplate(other, { approved: false, reason: "SCAM" })).toBe(true);
    expect(sent()[1]).toMatchObject({
      Subject: words.templateRejected.subject("Made in WhatsApp Manager"),
      TextBody: words.templateRejected.body(words.templateRejectedWhy.reasons.SCAM!, SAID, [], 0),
    });
    expect(sent()[1].Cc).toBeUndefined();
    // WhatsApp's code is kept, and put in words where it's shown.
    expect(
      await query("SELECT status, rejected_reason FROM whatsapp_template_variants WHERE id = $1", [other]),
    ).toEqual([{ status: "rejected", rejected_reason: "SCAM" }]);
  });

  it("makes a text scheduled on words WhatsApp rejects a draft again, saying so", async () => {
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draftOf(TEXT_FILTER);
    const version = await readied(id, { body: EVENT_WORDS, title: "See you there." });
    expect(await scheduleBroadcast(id, version, JO)).toEqual({ scheduled: true });
    // Past its time, waiting for WhatsApp.
    await query("UPDATE mailings SET waiting_since = now(), wait_reason = 'approval' WHERE id = $1", [id]);
    const template = (await getWrittenBroadcast(id))!.variant!.id;
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
    await query("UPDATE whatsapp_template_variants SET approved_at = '2100-01-01' WHERE id = $1", [
      (await variantsOf(newest)).first,
    ]);
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
    // A text with only a template's name has no words yet, so it can go to email, its name and template gone;
    // one with an approved template chosen has.
    const named = await draftOf(TEXT_FILTER);
    await readied(named, { title: "March day" });
    expect((await getWrittenBroadcast(named))!.template).not.toBeNull();
    expect(await changeBroadcastConsent(named, EMAIL_FILTER.contact, JO)).toEqual(expect.any(Number));
    expect(await getWrittenBroadcast(named)).toMatchObject({ channel: "email", title: "", template: null });
    const chosen = await draftOf(TEXT_FILTER);
    await readied(chosen, { templateId: await addTemplate("Event") });
    expect(await changeBroadcastConsent(chosen, EMAIL_FILTER.contact, JO)).toBe(false);
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
