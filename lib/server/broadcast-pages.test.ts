import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { staffCopy } from "@/lib/content/staff-interface";
import { query } from "@/lib/server/db";
import { connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { addFollower, addTemplate, EVENT_WORDS, startSending } from "@/tests/broadcast-fixtures";
import { createBroadcastDraft, getWrittenBroadcast, saveBroadcastDraft, scheduleBroadcast } from "./broadcast-drafts";
import {
  choosingConsent,
  choosingBroadcast,
  messageCopy,
  broadcastPageData,
  broadcastsPage,
  broadcastsToSupporter,
  broadcastCrumb,
  broadcastTitle,
  newBroadcastPageData,
  withChoosing,
} from "./broadcast-pages";

const JO = "jo@pauseai.uk";
const HELLO = "hello@pauseai.uk";

/** hello@ having sent `n` more emails just now. */
const sentByHello = (n: number) =>
  query(
    `INSERT INTO email_sends (purpose, address, outcome, message_id, backend, sender)
     SELECT 'broadcast', 'x' || i || '@example.com', 'sent', 'earlier-' || i, 'gmail', $2
     FROM generate_series(1, $1::int) i`,
    [n, HELLO],
  );
const FUTURE = new Date("2099-01-01T09:18:00.000Z");
const EMAIL_FILTER = { contact: "email:events:yes" };
const TEXT_FILTER = { contact: "text:events:yes" };

beforeEach(() => {
  vi.stubEnv("DATA_FIXTURES", "1");
  vi.stubEnv("WHATSAPP_NUMBER", "+447700900000");
});
afterEach(() => vi.unstubAllEnvs());

/** A broadcast by `params`, scheduled with these changes; returns its ID. */
async function scheduled(params: Record<string, string>, changes: object): Promise<number> {
  const id = (await createBroadcastDraft(JO, params))!;
  const broadcast = (await getWrittenBroadcast(id))!;
  const saved = await saveBroadcastDraft(broadcast, 1, { dueAt: FUTURE, ...changes });
  if (!saved.saved) throw new Error("not saved");
  const result = await scheduleBroadcast(id, saved.version, JO);
  if (!result.scheduled) throw new Error("not scheduled");
  return id;
}

/**
 * Sets a broadcast sent, with a message to each recipient its filters find, as
 * sending makes them, each status by supporter's order, as `statuses`;
 * returns their IDs.
 */
async function sent(id: number, statuses: [string, string | null][]): Promise<number[]> {
  await startSending(id, "sent");
  const copies = await query<{ id: number }>(
    "SELECT id::int AS id FROM broadcast_messages WHERE mailing_id = $1 ORDER BY id",
    [id],
  );
  for (const [i, [status, reason]] of statuses.entries()) {
    await query(
      "UPDATE broadcast_messages SET status = $2, skip_reason = $3, sent_at = '2026-10-20T08:00:00Z' WHERE id = $1",
      [copies[i].id, status, reason],
    );
  }
  return copies.map((copy) => copy.id);
}

describeWithDatabase("the pages of broadcasts to supporters", () => {
  useTestDatabase();
  // An email goes by hello@'s Gmail, which is connected.
  beforeEach(() => connectTestGmail(HELLO));

  it("says when there are none", async () => {
    expect((await broadcastsPage()).groups).toEqual([]);
    expect(await broadcastPageData(999, {}, JO)).toBeUndefined();
    expect(await broadcastTitle(999)).toBeUndefined();
    expect(await messageCopy(999, 1)).toBeUndefined();
    expect(await choosingBroadcast("")).toBeUndefined();
    expect(await choosingBroadcast("999")).toBeUndefined();
  });

  it("lists drafts, with who they'd go to now, those coming up, and those sent, with their counts", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    await addFollower("usr-2", "sam@example.com", "Sam", { phone: "07700 900002" });
    await addFollower("usr-3", "pat@example.com", "Pat", { phone: "07700 900003" });
    await addFollower("usr-4", "bob@example.com", "Bob", { phone: "07700 900004" });
    await addFollower("usr-5", "kim@example.com", "Kim", { phone: "07700 900005" });
    await createBroadcastDraft(JO, EMAIL_FILTER);
    const later = await scheduled(TEXT_FILTER, { templateId: await addTemplate("Event") });
    const onTemplate = await scheduled(TEXT_FILTER, {
      templateId: await addTemplate("March day"),
      dueAt: "2098-01-01T09:18:00.000Z",
    });
    const went = await scheduled(EMAIL_FILTER, { subject: "Sent", body: EVENT_WORDS });
    const copies = await sent(went, [
      ["delivered", null],
      ["failed", null],
      ["skipped", "unsubscribed"],
      ["skipped", "blocked"],
      ["skipped", "no-permission"],
    ]);
    await query("INSERT INTO broadcast_message_events (message_id, kind) VALUES ($1, 'read')", [copies[0]]);
    const { groups, now } = await broadcastsPage();
    expect(typeof now).toBe("string");
    const coming = groups[0].mailings;
    expect(coming.map((m) => [m.id, m.state])).toEqual([
      [onTemplate, "scheduled"],
      [later, "scheduled"],
      [expect.any(Number), "draft"],
    ]);
    expect(coming[2].to).toBe(5);
    expect(groups[1].mailings[0]).toMatchObject({
      id: went,
      channel: "email",
      to: 5,
      sent: 1,
      delivered: 1,
      // The failure and the blocked address; and those who asked us to stop, or whose consent ended.
      failed: 2,
      stopped: 2,
      read: 1,
    });
  });

  it("gives a draft's page what writing it needs, with one recipient for each mix of conditions", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    await addFollower("usr-2", "sam@example.com", "Sam");
    await addFollower("usr-3", "nameless@example.com", "");
    const id = (await createBroadcastDraft(JO, EMAIL_FILTER))!;
    const data = await broadcastPageData(id, {}, JO);
    expect(data).toMatchObject({
      kind: "draft",
      count: 3,
      me: JO,
      sends: true,
      unknown: [],
      templates: [],
      sender: { byGmail: true, connected: true, remaining: 1800 },
    });
    // No supporter's details: its preview is for someone made up.
    expect(data!.kind === "draft" && "recipients" in data!).toBe(false);
    await query(
      `UPDATE mailings SET filter = '{"list": "supporters", "params": {"contact": "email:events:yes", "event": "gone"}}' WHERE id = $1`,
      [id],
    );
    expect(await broadcastPageData(id, {}, JO)).toMatchObject({ unknown: ["event=gone"], count: 0 });
  });

  it("says how what sends a draft email stands: hello@'s Gmail connected or not, and what it can send today", async () => {
    const id = (await createBroadcastDraft(JO, EMAIL_FILTER))!;
    const sender = async () => {
      const data = await broadcastPageData(id, {}, JO);
      return data!.kind === "draft" && data!.sender;
    };
    expect(await sender()).toEqual({ byGmail: true, connected: true, remaining: 1800 });
    await sentByHello(1);
    expect(await sender()).toEqual({ byGmail: true, connected: true, remaining: 1799 });
    await query(
      "UPDATE staff_accounts SET gmail_token = NULL, gmail_connected_at = NULL, gmail_history_id = NULL, gmail_name = NULL",
    );
    expect(await sender()).toEqual({ byGmail: true, connected: false, remaining: 1799 });
    // A text has no such sender.
    const text = (await createBroadcastDraft(JO, { contact: "text:events:yes" }))!;
    const data = await broadcastPageData(text, {}, JO);
    expect(data!.kind === "draft" && data!.sender).toEqual({ byGmail: false, connected: false, remaining: null });
  });

  it("says one sending is at its limit once hello@ can send no more today", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane Smith");
    const id = await scheduled(EMAIL_FILTER, { subject: "Going", body: EVENT_WORDS });
    expect(await broadcastPageData(id, {}, JO)).toMatchObject({ kind: "written", atLimit: false });
    await startSending(id);
    expect(await broadcastPageData(id, {}, JO)).toMatchObject({ atLimit: false });
    await sentByHello(1800);
    expect(await broadcastPageData(id, {}, JO)).toMatchObject({ atLimit: true });
  });

  it("gives New broadcast an email to no one yet, by hello@'s Gmail", async () => {
    const { draft, data } = await newBroadcastPageData(JO);
    expect(draft).toMatchObject({ id: 0, channel: "email", sendBy: "gmail", state: "draft", filter: { params: {} } });
    expect(data).toMatchObject({ count: 0, me: JO, templates: [] });
    expect(data.fields.map((field) => field.lacking)).toEqual([0, 0]);
    // Each condition a part can be for, as a draft's, covering no one yet.
    expect(data.conditions.length).toBeGreaterThan(0);
    expect(data.conditions.every((condition) => condition.covers === 0)).toBe(true);
    expect(data.sender).toEqual({ byGmail: true, connected: true, remaining: 1800 });
  });

  it("names a broadcast in the trail above its page: a draft as a draft, one sent by its title", async () => {
    const id = (await createBroadcastDraft(JO, EMAIL_FILTER))!;
    await query("UPDATE mailings SET title = 'Events' WHERE id = $1", [id]);
    expect(await broadcastCrumb(id)).toBe(staffCopy.broadcastPages.draftCrumb);
    await query("UPDATE mailings SET state = 'sent', due_at = now(), sent_from = $2, from_name = 'Jo' WHERE id = $1", [
      id,
      JO,
    ]);
    expect(await broadcastCrumb(id)).toBe("Events");
    expect(await broadcastCrumb(999)).toBeUndefined();
  });

  it("titles a draft, or says it has none; a mailing to politicians is none", async () => {
    const id = (await createBroadcastDraft(JO, EMAIL_FILTER))!;
    expect(await broadcastTitle(id)).toBe(staffCopy.broadcastPages.untitled);
    await query("UPDATE mailings SET title = 'Events' WHERE id = $1", [id]);
    expect(await broadcastTitle(id)).toBe("Events");
    expect(await choosingBroadcast(String(id))).toEqual({
      id,
      channel: "email",
      topics: ["events"],
      title: "Events",
      blank: false,
    });
    expect(choosingConsent((await choosingBroadcast(String(id)))!)).toBe(EMAIL_FILTER.contact);
    expect(choosingConsent({ id, channel: "text", topics: ["events"], title: "", blank: true })).toBe(
      "text:events:yes",
    );
    expect(choosingConsent({ id, channel: "email", topics: ["newsletter", "events"], title: "", blank: true })).toEqual(
      ["email:newsletter:yes", "email:events:yes"],
    );
    // The list choosing for it keeps its Consent over another; with no draft, the filters as they are.
    const other = { contact: "email:newsletter:yes", near: "LS1" };
    expect(await withChoosing(other, String(id))).toMatchObject({
      choosing: { id },
      params: { ...other, contact: EMAIL_FILTER.contact },
    });
    expect(await withChoosing(other, undefined)).toEqual({ choosing: undefined, params: other });
    await query("UPDATE mailings SET title = '' WHERE id = $1", [id]);
    expect(await choosingBroadcast(String(id))).toMatchObject({
      title: staffCopy.broadcastPages.newTitle.email,
      blank: true,
    });
    expect(await choosingBroadcast("not a number")).toBeUndefined();
  });

  it("gives one sent's page its recipients, in a tab, a page at a time, and stops choosing for it", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane Smith", { postcode: undefined });
    await addFollower("usr-2", "sam@example.com", "Sam");
    const id = await scheduled(EMAIL_FILTER, { subject: "Sent", body: EVENT_WORDS });
    await sent(id, [
      ["delivered", null],
      ["failed", null],
    ]);
    const [{ jane }] = await query<{ jane: number }>(
      "SELECT id::int AS jane FROM broadcast_messages WHERE address = 'jane@example.com'",
    );
    await query("INSERT INTO broadcast_message_events (message_id, kind) VALUES ($1, 'read')", [jane]);
    const all = await broadcastPageData(id, {}, JO);
    expect(all).toMatchObject({ kind: "written", tab: "all", recipientsTotal: 2, page: 1, pages: 1, pageSize: 100 });
    expect(all!.kind === "written" && all!.recipients[0]).toMatchObject({ name: "Jane Smith", read: true });
    expect(await broadcastPageData(id, { tab: "failed", page: "1" }, JO)).toMatchObject({
      tab: "failed",
      recipientsTotal: 1,
    });
    expect(await broadcastPageData(id, { tab: "nonsense" }, JO)).toMatchObject({ tab: "all" });
    for (const tab of ["delivered", "stopped", "read"]) {
      expect(await broadcastPageData(id, { tab }, JO)).toMatchObject({ tab });
    }
    expect(await choosingBroadcast(String(id))).toBeUndefined();
  });

  it("says which drafts are waiting for WhatsApp to approve their words, and which it rejected", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const plain = (await createBroadcastDraft(JO, TEXT_FILTER))!;
    const id = (await createBroadcastDraft(JO, TEXT_FILTER))!;
    const turnedDown = (await createBroadcastDraft(JO, TEXT_FILTER))!;
    const pending = await addTemplate("Rain on Saturday", { status: "pending" });
    const rejected = await addTemplate("Sun on Sunday", { status: "rejected", reason: "It ends with a field." });
    await query("UPDATE mailings SET template_id = $2 WHERE id = $1", [id, pending]);
    await query("UPDATE mailings SET template_id = $2 WHERE id = $1", [turnedDown, rejected]);
    const drafts = (await broadcastsPage()).groups[0].mailings;
    expect(drafts.map((m) => [m.id, m.waiting, m.rejected]).sort()).toEqual([
      [plain, false, false],
      [id, true, false],
      [turnedDown, false, true],
    ]);
  });

  it("lists who one scheduled would go to now, by name, a page at a time, each yet to be sent", async () => {
    await addFollower("usr-1", "sam@example.com", "Sam");
    await addFollower("usr-2", "jane@example.com", "Jane Smith");
    await addFollower("usr-3", "nameless@example.com", "");
    const id = await scheduled(EMAIL_FILTER, { subject: "Soon", body: EVENT_WORDS });
    const data = await broadcastPageData(id, {}, JO);
    expect(data).toMatchObject({ kind: "written", recipientsTotal: 3, pages: 1, summary: { to: 3 } });
    expect(data!.kind === "written" && data!.recipients.map((r) => [r.name, r.status])).toEqual([
      ["Jane Smith", "scheduled"],
      ["Sam", "scheduled"],
      // One with no name has none here, and comes last, as among the copies of one that has started.
      [null, "scheduled"],
    ]);
    expect(await broadcastPageData(id, { page: "2" }, JO)).toMatchObject({ recipients: [] });
  });

  it("gives one copy, with what its provider reported, newest first", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane Smith", { phone: "07700 900001" });
    const id = await scheduled(TEXT_FILTER, { templateId: await addTemplate("March day") });
    const [copy] = await sent(id, [["delivered", null]]);
    expect(await messageCopy(id + 1, copy)).toBeUndefined();
    expect(await messageCopy(id, copy)).toMatchObject({
      channel: "text",
      name: "Jane Smith",
      address: "+447700900001",
      merge: { values: { firstName: "Jane" } },
      events: [],
    });
    await query(
      "INSERT INTO broadcast_message_events (message_id, kind, at) VALUES ($1, 'delivered', '2026-10-20T08:01:00Z'), ($1, 'read', '2026-10-20T08:02:00Z')",
      [copy],
    );
    expect((await messageCopy(id, copy))!.events).toEqual([
      { at: new Date("2026-10-20T08:02:00Z"), kind: "read", details: {} },
      { at: new Date("2026-10-20T08:01:00Z"), kind: "delivered", details: {} },
    ]);
    // Erased, it keeps only that it was sent.
    await query("UPDATE broadcast_messages SET supporter_id = NULL, address = NULL, merge_values = NULL");
    expect(await messageCopy(id, copy)).toMatchObject({
      name: null,
      place: null,
      address: null,
      merge: null,
      supporterId: null,
    });
  });

  it("lists the broadcasts a supporter was sent, newest first", async () => {
    const jane = await addFollower("usr-1", "jane@example.com", "Jane");
    expect(await broadcastsToSupporter(jane)).toEqual([]);
    const id = await scheduled(EMAIL_FILTER, { subject: "Events", body: EVENT_WORDS });
    const [copy] = await sent(id, [["delivered", null]]);
    expect(await broadcastsToSupporter(jane)).toMatchObject([
      {
        copyId: copy,
        messageId: id,
        title: "Events",
        channel: "email",
        status: "delivered",
        read: false,
        replied: false,
        toLookAt: false,
      },
    ]);
    // Their reply, waiting for staff.
    await query(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, account, gmail_message_id,
         gmail_thread_id, blob_key, automatic)
       VALUES ($1, now(), 'jane@example.com', 'Re: Events', 'hello@pauseai.uk', 'g1', 't1', 'k', false)`,
      [copy],
    );
    expect(await broadcastsToSupporter(jane)).toMatchObject([{ replied: true, toLookAt: true }]);
  });
});
