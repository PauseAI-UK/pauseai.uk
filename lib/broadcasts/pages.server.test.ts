import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { query } from "@/lib/server/db.server";
import { connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { addFollower, addTemplate, EVENT_WORDS, startSending } from "@/tests/broadcast-fixtures";
import {
  createBroadcastDraft,
  getWrittenBroadcast,
  saveBroadcastDraft,
  scheduleBroadcast,
  stopBroadcast,
} from "./drafts.server";
import {
  messageCopy,
  broadcastPageData,
  broadcastsPage,
  broadcastCrumb,
  broadcastTitle,
  newBroadcastPageData,
} from "./pages.server";
import { choosingConsent, choosingBroadcast, broadcastsToSupporter, withChoosing } from "./supporter-pages.server";
import { broadcastsCopy } from "./copy";
import { registeredFor, restsUntil, sendingStopsAt, waitEndsAt } from "./broadcasts";

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
  vi.stubEnv("WHATSAPP_TOKEN", "token");
  vi.stubEnv("WHATSAPP_ACCOUNT_ID", "fixture-account");
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

  it("lists those scheduled, drafts, with who they'd go to now, and those sent, with their counts", async () => {
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
    expect(groups.map((group) => [group.key, group.mailings.map((m) => m.state)])).toEqual([
      ["scheduled", ["scheduled", "scheduled"]],
      ["drafts", ["draft"]],
      [expect.any(String), ["sent"]],
    ]);
    expect(groups[0].mailings.map((m) => m.id)).toEqual([onTemplate, later]);
    expect(groups[1].mailings[0].to).toBe(5);
    expect(groups[2].mailings[0]).toMatchObject({
      id: went,
      channel: "email",
      to: 5,
      // As the sending bar counts them: one went, four done with but not sent.
      sent: 1,
      failed: 4,
      // Read; the failure an error; the rest not sent, as expected.
      states: { read: 1, error: 1, "not-sent": 3, delivered: 0, sent: 0, "opted-out": 0, unreached: 0, look: 0 },
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
      // By Postmark, with no limit.
      sender: { byGmail: false, connected: false, remaining: null, daily: null },
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
    await query("UPDATE mailings SET send_by = 'gmail' WHERE id = $1", [id]);
    const sender = async () => {
      const data = await broadcastPageData(id, {}, JO);
      return data!.kind === "draft" && data!.sender;
    };
    expect(await sender()).toEqual({ byGmail: true, connected: true, remaining: 1800, daily: 1800 });
    await sentByHello(1);
    expect(await sender()).toEqual({ byGmail: true, connected: true, remaining: 1799, daily: 1800 });
    await query(
      "UPDATE staff_accounts SET gmail_token = NULL, gmail_connected_at = NULL, gmail_history_id = NULL, gmail_name = NULL",
    );
    expect(await sender()).toEqual({ byGmail: true, connected: false, remaining: 1799, daily: 1800 });
    // A text goes by our WhatsApp number, at its daily limit, less those texted in the last day.
    const text = (await createBroadcastDraft(JO, { contact: "text:events:yes" }))!;
    const textSender = async () => {
      const data = await broadcastPageData(text, {}, JO);
      return data!.kind === "draft" && data!.sender;
    };
    expect(await textSender()).toEqual({ byGmail: false, connected: false, remaining: 250, daily: 250 });
    // With no WhatsApp, no limit to say.
    vi.stubEnv("WHATSAPP_TOKEN", "");
    vi.stubEnv("DATA_FIXTURES", "");
    expect(await textSender()).toEqual({ byGmail: false, connected: false, remaining: null, daily: null });
  });

  /** A broadcast's pause, as its own page has it and as the list of broadcasts does. */
  async function pauses(id: number) {
    const data = await broadcastPageData(id, {}, JO);
    const { groups } = await broadcastsPage();
    const listed = groups.flatMap((group) => group.mailings).find((one) => one.id === id)!;
    return { page: data!.kind === "written" && data!.summary.pause, list: listed.pause };
  }

  it("says one sending is paused at its limit once hello@ can send no more today", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane Smith");
    const id = await scheduled(EMAIL_FILTER, { subject: "Going", body: EVENT_WORDS, sendBy: "gmail" });
    expect(await pauses(id)).toEqual({ page: null, list: null });
    await startSending(id);
    expect(await pauses(id)).toEqual({ page: null, list: null });
    await sentByHello(1800);
    const limit = { kind: "limit", channel: "email" };
    expect(await pauses(id)).toEqual({ page: limit, list: limit });
  });

  it("says one past its time, or sending, that waits for CiviCRM is paused, why, and when the wait ends", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane Smith");
    const id = await scheduled(EMAIL_FILTER, { subject: "Going", body: EVENT_WORDS });
    const since = new Date("2026-11-11T07:18:00Z");
    // A wait kept before how the check failed was: what it said, alone.
    await query("UPDATE mailings SET waiting_since = $2, wait_reason = 'civicrm', wait_said = 'Down' WHERE id = $1", [
      id,
      since,
    ]);
    const { dueAt: due } = (await getWrittenBroadcast(id))!;
    const endsAt = waitEndsAt(since, { dueAt: due!, finishMinutes: null });
    const waitingThen = { kind: "waiting", reason: "civicrm", said: "Down", endsAt };
    expect(await pauses(id)).toEqual({ page: waitingThen, list: waitingThen });
    await query("UPDATE mailings SET wait_said = NULL, wait_failure = $2 WHERE id = $1", [
      id,
      JSON.stringify({ said: "CiviCRM answered 503", service: "civicrm", kind: "refused", status: 503 }),
    ]);
    const waiting = { ...waitingThen, said: "CiviCRM answered 503" };
    expect(await pauses(id)).toEqual({ page: waiting, list: waiting });
    // Sending, it stops when it stops trying, if that's sooner.
    await startSending(id);
    const { dueAt } = (await getWrittenBroadcast(id))!;
    const sooner = { ...waiting, endsAt: waitEndsAt(since, { dueAt: dueAt!, finishMinutes: null }) };
    expect(await pauses(id)).toEqual({ page: sooner, list: sooner });
  });

  it("says one sending rests after its sends failed, till when, and not once that's past, or for one not sending", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane Smith");
    const id = await scheduled(EMAIL_FILTER, { subject: "Going", body: EVENT_WORDS });
    const failedAt = new Date(Date.now() - 5 * 60 * 1000);
    await query("UPDATE mailings SET try_failed_at = $2 WHERE id = $1", [id, failedAt]);
    // Scheduled, not sending: it isn't resting.
    expect(await pauses(id)).toEqual({ page: null, list: null });
    await startSending(id);
    const resting = { kind: "resting", until: restsUntil(failedAt) };
    expect(await pauses(id)).toEqual({ page: resting, list: resting });
    await query("UPDATE mailings SET try_failed_at = now() - interval '1 hour' WHERE id = $1", [id]);
    expect(await pauses(id)).toEqual({ page: null, list: null });
  });

  it("says one sending is paused once all it has left are texts WhatsApp held, till the first is tried again", async () => {
    for (const n of [1, 2, 3]) await addFollower(`usr-${n}`, `p${n}@example.com`, `Person ${n}`);
    const id = await scheduled(EMAIL_FILTER, { subject: "Going", body: EVENT_WORDS });
    const copies = await sent(id, [
      ["delivered", null],
      ["scheduled", null],
      ["scheduled", null],
    ]);
    await query("UPDATE mailings SET state = 'sending' WHERE id = $1", [id]);
    await query("UPDATE broadcast_messages SET sent_at = NULL WHERE id = ANY($1)", [copies.slice(1)]);
    // One held, one waiting its turn: it's still going.
    await query("UPDATE broadcast_messages SET not_before = now() + interval '2 days' WHERE id = $1", [copies[1]]);
    expect(await pauses(id)).toEqual({ page: null, list: null });
    // Both held: paused till the sooner.
    await query("UPDATE broadcast_messages SET not_before = now() + interval '1 day' WHERE id = $1", [copies[2]]);
    const [{ sooner }] = await query<{ sooner: Date }>(
      "SELECT not_before AS sooner FROM broadcast_messages WHERE id = $1",
      [copies[2]],
    );
    const { dueAt } = (await getWrittenBroadcast(id))!;
    const held = {
      kind: "held",
      held: 2,
      until: sooner,
      stopsAt: sendingStopsAt({ dueAt: dueAt!, finishMinutes: null }),
    };
    expect(await pauses(id)).toEqual({ page: held, list: held });
  });

  it("gives New broadcast an email to no one yet, by Postmark", async () => {
    const { draft, data } = await newBroadcastPageData(JO);
    expect(draft).toMatchObject({
      id: 0,
      channel: "email",
      sendBy: "postmark",
      state: "draft",
      filter: { params: {} },
    });
    expect(data).toMatchObject({ count: 0, me: JO, templates: [] });
    expect(data.fields.map((field) => field.lacking)).toEqual([0, 0]);
    // Each condition a part can be for, as a draft's, covering no one yet.
    expect(data.conditions.length).toBeGreaterThan(0);
    expect(data.conditions.every((condition) => condition.covers === 0)).toBe(true);
    expect(data.sender).toEqual({ byGmail: false, connected: false, remaining: null, daily: null });
  });

  it("names a broadcast in the trail above its page: a draft as a draft, one sent by its title", async () => {
    const id = (await createBroadcastDraft(JO, EMAIL_FILTER))!;
    await query("UPDATE mailings SET title = 'Events' WHERE id = $1", [id]);
    expect(await broadcastCrumb(id)).toBe(broadcastsCopy.broadcastPages.draftCrumb);
    await query("UPDATE mailings SET state = 'sent', due_at = now(), sent_from = $2, from_name = 'Jo' WHERE id = $1", [
      id,
      JO,
    ]);
    expect(await broadcastCrumb(id)).toBe("Events");
    expect(await broadcastCrumb(999)).toBeUndefined();
  });

  it("titles a draft, or says it has none; a mailing to politicians is none", async () => {
    const id = (await createBroadcastDraft(JO, EMAIL_FILTER))!;
    expect(await broadcastTitle(id)).toBe(broadcastsCopy.broadcastPages.untitled);
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
    // A list's topics are its one value; topics that are no list, as from before the lists, a value each.
    expect(choosingConsent({ id, channel: "email", topics: ["newsletter", "events"], title: "", blank: true })).toBe(
      "email:newsletter:yes email:events:yes",
    );
    expect(
      choosingConsent({ id, channel: "email", topics: ["newsletter", "volunteering"], title: "", blank: true }),
    ).toEqual(["email:newsletter:yes", "email:volunteering:yes"]);
    // The list choosing for it keeps its Consent over another; with no draft, the filters as they are.
    const other = { contact: "email:newsletter:yes", near: "LS1" };
    expect(await withChoosing(other, String(id))).toMatchObject({
      choosing: { id },
      params: { ...other, contact: EMAIL_FILTER.contact },
    });
    expect(await withChoosing(other, undefined)).toEqual({ choosing: undefined, params: other });
    // What the list leaves out stays, as the draft's Consent doesn't fix it.
    expect(await withChoosing({ contact: ["text:newsletter:yes", "!text:events:yes"] }, String(id))).toMatchObject({
      params: { contact: [EMAIL_FILTER.contact, "!text:events:yes"] },
    });
    await query("UPDATE mailings SET title = '' WHERE id = $1", [id]);
    expect(await choosingBroadcast(String(id))).toMatchObject({
      title: broadcastsCopy.broadcastPages.newTitle.email,
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
    const [{ delivered }] = await query<{ delivered: number }>(
      "SELECT id::int AS delivered FROM broadcast_messages WHERE mailing_id = $1 AND status = 'delivered'",
      [id],
    );
    await query("INSERT INTO broadcast_message_events (message_id, kind) VALUES ($1, 'read')", [delivered]);
    const all = await broadcastPageData(id, {}, JO);
    expect(all).toMatchObject({ kind: "written", tab: "all", recipientsTotal: 2, page: 1, pages: 1, pageSize: 100 });
    expect(all!.kind === "written" && all!.recipients[0]).toMatchObject({ name: "Jane Smith" });
    expect(all!.kind === "written" && all!.recipients.map((one) => one.state).sort()).toEqual(["error", "read"]);
    expect(await broadcastPageData(id, { tab: "error", page: "1" }, JO)).toMatchObject({
      tab: "error",
      recipientsTotal: 1,
    });
    expect(await broadcastPageData(id, { tab: "nonsense" }, JO)).toMatchObject({ tab: "all" });
    for (const tab of ["delivered", "not-sent", "read"]) {
      expect(await broadcastPageData(id, { tab }, JO)).toMatchObject({ tab });
    }
    expect(await choosingBroadcast(String(id))).toBeUndefined();
  });

  it("sorts one sent's recipients by name either way, or by when each last changed, those not gone last", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane Smith");
    await addFollower("usr-2", "sam@example.com", "Sam");
    await addFollower("usr-3", "pat@example.com", "Pat");
    const id = await scheduled(EMAIL_FILTER, { subject: "Sent", body: EVENT_WORDS });
    await sent(id, [
      ["delivered", null],
      ["delivered", null],
      ["delivered", null],
    ]);
    const copyOf = async (name: string) =>
      (
        await query<{ id: number }>(
          "SELECT id::int AS id FROM broadcast_messages WHERE mailing_id = $1 AND merge_values ->> 'name' = $2",
          [id, name],
        )
      )[0].id;
    // Sam's arrived an hour after it went, Jane's has nothing in its history, and Pat's never went.
    const arrived = new Date("2026-10-20T09:00:00Z");
    await query("INSERT INTO broadcast_message_events (message_id, kind, at) VALUES ($1, 'delivered', $2)", [
      await copyOf("Sam"),
      arrived,
    ]);
    await query("DELETE FROM broadcast_message_events WHERE message_id = $1", [await copyOf("Jane Smith")]);
    await query(
      "UPDATE broadcast_messages SET status = 'skipped', skip_reason = 'blocked', sent_at = NULL WHERE id = $1",
      [await copyOf("Pat")],
    );
    await query("DELETE FROM broadcast_message_events WHERE message_id = $1", [await copyOf("Pat")]);
    const listed = async (search: { sort?: string; dir?: string }) => {
      const data = await broadcastPageData(id, search, JO);
      if (data?.kind !== "written") throw new Error("not written");
      return { sort: data.sort, names: data.recipients.map((one) => one.name), rows: data.recipients };
    };
    expect(await listed({})).toMatchObject({
      sort: { key: "who", dir: "asc" },
      names: ["Jane Smith", "Pat", "Sam"],
    });
    expect((await listed({ sort: "who", dir: "desc" })).names).toEqual(["Sam", "Pat", "Jane Smith"]);
    const newest = await listed({ sort: "changed" });
    expect(newest).toMatchObject({ sort: { key: "changed", dir: "desc" }, names: ["Sam", "Jane Smith", "Pat"] });
    expect(newest.rows.map((one) => one.changedAt)).toEqual([arrived, new Date("2026-10-20T08:00:00Z"), null]);
    expect((await listed({ sort: "changed", dir: "asc" })).names).toEqual(["Jane Smith", "Sam", "Pat"]);
    // A sort it doesn't have is the list as it is.
    expect(await listed({ sort: "nonsense", dir: "desc" })).toMatchObject({ sort: { key: "who", dir: "asc" } });
  });

  it("counts those still to go: held by WhatsApp till a time to come, or waiting their turn", async () => {
    for (const n of [1, 2, 3, 4]) await addFollower(`usr-${n}`, `p${n}@example.com`, `Person ${n}`);
    const id = await scheduled(EMAIL_FILTER, { subject: "Going", body: EVENT_WORDS });
    const copies = await sent(id, [
      ["delivered", null],
      ["scheduled", null],
      ["scheduled", null],
      ["scheduled", null],
    ]);
    await query("UPDATE mailings SET state = 'sending' WHERE id = $1", [id]);
    await query("UPDATE broadcast_messages SET sent_at = NULL WHERE id = ANY($1)", [copies.slice(1)]);
    // One held till tomorrow; one held till a time now past, so it's waiting its turn again; one being sent.
    await query("UPDATE broadcast_messages SET not_before = now() + interval '1 day' WHERE id = $1", [copies[1]]);
    await query("UPDATE broadcast_messages SET not_before = now() - interval '1 hour' WHERE id = $1", [copies[2]]);
    await query("UPDATE broadcast_messages SET status = 'sending', sending_since = now() WHERE id = $1", [copies[3]]);
    const data = await broadcastPageData(id, {}, JO);
    expect(data!.kind === "written" && data!.summary.states).toMatchObject({ delivered: 1, held: 1, "to-go": 2 });
    const rows = data!.kind === "written" ? data!.recipients : [];
    const [{ tomorrow }] = await query<{ tomorrow: Date }>(
      "SELECT not_before AS tomorrow FROM broadcast_messages WHERE id = $1",
      [copies[1]],
    );
    expect(
      copies.map((copy) => rows.find((one) => one.copyId === copy)).map((one) => [one!.state, one!.heldTill]),
    ).toEqual([
      ["delivered", null],
      ["held", tomorrow],
      ["to-go", null],
      ["to-go", null],
    ]);
    expect(await broadcastPageData(id, { tab: "held" }, JO)).toMatchObject({ tab: "held", recipientsTotal: 1 });
    expect(await broadcastPageData(id, { tab: "to-go" }, JO)).toMatchObject({ tab: "to-go", recipientsTotal: 2 });
  });

  it("counts as delayed a copy Postmark soft-bounced or has said nothing of for ten minutes, an error once its days run out", async () => {
    for (const n of [1, 2, 3, 4, 5, 6]) await addFollower(`usr-${n}`, `p${n}@example.com`, `Person ${n}`);
    const id = await scheduled(EMAIL_FILTER, { subject: "Going", body: EVENT_WORDS, sendBy: "postmark" });
    const copies = await sent(id, [
      ["delivered", null],
      ["sent", null],
      ["sent", null],
      ["sent", null],
      ["delivered", null],
      ["sent", null],
    ]);
    // Five went eleven minutes ago, one just now. Postmark soft-bounced one, and is trying it again; soft-bounced
    // another, then delivered it; and said the last was marked as spam, so it reached them.
    await query("UPDATE broadcast_messages SET sent_at = now() - interval '11 minutes' WHERE mailing_id = $1", [id]);
    await query("UPDATE broadcast_messages SET sent_at = now() WHERE id = $1", [copies[3]]);
    await query(
      "INSERT INTO broadcast_message_events (message_id, kind) VALUES ($1, 'soft-bounced'), ($2, 'soft-bounced'), ($3, 'opted-out')",
      [copies[2], copies[4], copies[5]],
    );
    const stands = async () => {
      const data = await broadcastPageData(id, {}, JO);
      const rows = data!.kind === "written" ? data!.recipients : [];
      return {
        summary: data!.kind === "written" && data!.summary,
        rows: copies.map((copy) => rows.find((one) => one.copyId === copy)!).map((one) => [one.state, one.why]),
      };
    };
    expect(await stands()).toMatchObject({
      summary: { sent: 4, failed: 0, states: { delivered: 2, sent: 1, held: 2, "opted-out": 1, error: 0 } },
      rows: [
        ["delivered", null],
        ["held", "postmark-silent"],
        ["held", "soft-bounce"],
        ["sent", null],
        ["delivered", null],
        ["opted-out", null],
      ],
    });
    expect(await broadcastPageData(id, { tab: "held" }, JO)).toMatchObject({ tab: "held", recipientsTotal: 2 });
    // All sent, it's said to be sending, waiting on those delayed, with what's still coming up.
    const [{ dueAt }] = await query<{ dueAt: Date }>('SELECT due_at AS "dueAt" FROM mailings WHERE id = $1', [id]);
    const waiting = {
      state: "sending",
      pause: { kind: "delayed", delayed: 2, stopsAt: sendingStopsAt({ dueAt, finishMinutes: null }) },
    };
    expect((await stands()).summary).toMatchObject(waiting);
    const listed = async () =>
      (await broadcastsPage()).groups.map((group) => [group.key, group.mailings.map((m) => m.state)]);
    expect(await listed()).toEqual([["sending", ["sending"]]]);
    // Its seven days over, those still delayed never will arrive: errors, done with but not sent.
    await query("UPDATE mailings SET due_at = now() - interval '7 days' WHERE id = $1", [id]);
    expect((await listed())[0][1]).toEqual(["sent"]);
    expect(await stands()).toMatchObject({
      summary: { state: "sent", pause: null, sent: 4, failed: 2, states: { held: 0, error: 2 } },
      rows: [
        ["delivered", null],
        ["error", "postmark-silent"],
        ["error", "soft-bounce"],
        ["sent", null],
        ["delivered", null],
        ["opted-out", null],
      ],
    });
    // By Gmail, nothing is ever said of what arrives, so nothing's delayed for silence.
    await query("UPDATE mailings SET send_by = 'gmail', due_at = now() WHERE id = $1", [id]);
    expect(await stands()).toMatchObject({ summary: { states: { sent: 2, held: 1 } } });
  });

  it("lists under Sending those going out, then those waiting, however long ago; under Recent, those done with in the last day", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane Smith");
    const broadcast = (subject: string) => scheduled(EMAIL_FILTER, { subject, body: EVENT_WORDS, sendBy: "gmail" });
    const coming = await broadcast("Coming");
    const waitingNow = await broadcast("Waiting for CiviCRM");
    await query(
      "UPDATE mailings SET due_at = now() - interval '1 hour', waiting_since = now(), wait_reason = 'civicrm' WHERE id = $1",
      [waitingNow],
    );
    const sending = await broadcast("Sending");
    await startSending(sending);
    const resting = await broadcast("Resting");
    await startSending(resting);
    await query("UPDATE mailings SET try_failed_at = now(), due_at = now() - interval '9 days' WHERE id = $1", [
      resting,
    ]);
    const done = async (subject: string, state: string, ago: string) => {
      const id = await broadcast(subject);
      await sent(id, [["delivered", null]]);
      await query("UPDATE mailings SET state = $2 WHERE id = $1", [id, state]);
      await query(`UPDATE broadcast_messages SET sent_at = now() - interval '${ago}' WHERE mailing_id = $1`, [id]);
      return id;
    };
    const sentToday = await done("Sent today", "sent", "2 hours");
    const stoppedToday = await done("Stopped today", "cancelled", "23 hours");
    const sentBefore = await done("Sent before", "sent", "25 hours");
    const { groups } = await broadcastsPage();
    // One past its time, waiting for CiviCRM, hasn't started, so it's still scheduled, first, as it was due first.
    expect(groups.map((group) => [group.key, group.mailings.map((m) => m.id)])).toEqual([
      ["scheduled", [waitingNow, coming]],
      ["sending", [sending, resting]],
      ["just-finished", [sentToday, stoppedToday]],
      [expect.any(String), [sentBefore]],
    ]);
    expect(groups.map((group) => group.heading).slice(0, 3)).toEqual(["Scheduled", "Sending", "Just finished"]);
  });

  it("gives up on emails Postmark delayed when stopped, counting them as errors, though one delivered after is delivered", async () => {
    for (const n of [1, 2, 3]) await addFollower(`usr-${n}`, `p${n}@example.com`, `Person ${n}`);
    const id = await scheduled(EMAIL_FILTER, { subject: "Going", body: EVENT_WORDS, sendBy: "postmark" });
    const copies = await sent(id, [
      ["delivered", null],
      ["sent", null],
      ["sent", null],
    ]);
    await query("UPDATE broadcast_messages SET sent_at = now() - interval '11 minutes' WHERE mailing_id = $1", [id]);
    await query("UPDATE mailings SET due_at = now() - interval '1 day' WHERE id = $1", [id]);
    const stands = async () => {
      const data = await broadcastPageData(id, {}, JO);
      return data!.kind === "written" && data!.summary;
    };
    expect(await stands()).toMatchObject({ state: "sending", pause: { kind: "delayed", delayed: 2 } });
    expect(await stopBroadcast(id, JO)).toBe(true);
    expect(await stands()).toMatchObject({ state: "cancelled", pause: null, states: { held: 0, error: 2 } });
    // Nothing more to give up on.
    expect(await stopBroadcast(id, JO)).toBe(false);
    // Postmark delivers one after all.
    await query("UPDATE broadcast_messages SET status = 'delivered' WHERE id = $1", [copies[1]]);
    expect(await stands()).toMatchObject({ states: { delivered: 2, error: 1 } });
  });

  it("stops nothing sent with nothing delayed", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane Smith");
    const id = await scheduled(EMAIL_FILTER, { subject: "Going", body: EVENT_WORDS, sendBy: "postmark" });
    await sent(id, [["delivered", null]]);
    expect(await stopBroadcast(id, JO)).toBe(false);
  });

  it("says a text WhatsApp held till its broadcast's days ran out is an error of WhatsApp's limit; one stopped otherwise, that it stopped", async () => {
    for (const n of [1, 2, 3]) await addFollower(`usr-${n}`, `p${n}@example.com`, `Person ${n}`);
    const id = await scheduled(EMAIL_FILTER, { subject: "Going", body: EVENT_WORDS });
    const copies = await sent(id, [
      ["delivered", null],
      ["cancelled", null],
      ["cancelled", null],
    ]);
    // Held once, then cancelled as its days ran out; and one cancelled with it, never held.
    await query("UPDATE broadcast_messages SET not_before = now() - interval '1 day' WHERE id = $1", [copies[1]]);
    await query(
      "UPDATE mailings SET state = 'cancelled', gave_up = true, wait_reason = 'limit', waiting_since = now() WHERE id = $1",
      [id],
    );
    const whys = async () => {
      const data = await broadcastPageData(id, {}, JO);
      const rows = data!.kind === "written" ? data!.recipients : [];
      return copies.map((copy) => rows.find((one) => one.copyId === copy)!).map((one) => [one.state, one.why]);
    };
    expect(await whys()).toEqual([
      ["delivered", null],
      ["error", "whatsapp-limit"],
      ["error", "limit"],
    ]);
    // Stopped as its sending kept failing, a copy once held is one that broadcast stopped.
    await query("UPDATE mailings SET wait_reason = 'failing' WHERE id = $1", [id]);
    expect((await whys())[1]).toEqual(["error", "failing"]);
  });

  it("says which drafts are waiting for WhatsApp to approve their words, which it approved, and which it rejected", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const plain = (await createBroadcastDraft(JO, TEXT_FILTER))!;
    const id = (await createBroadcastDraft(JO, TEXT_FILTER))!;
    const ready = (await createBroadcastDraft(JO, TEXT_FILTER))!;
    const turnedDown = (await createBroadcastDraft(JO, TEXT_FILTER))!;
    const pending = await addTemplate("Rain on Saturday", { status: "pending" });
    const approved = await addTemplate("Snow on Monday", { status: "approved" });
    const rejected = await addTemplate("Sun on Sunday", { status: "rejected", reason: "It ends with a field." });
    await query("UPDATE mailings SET template_id = $2 WHERE id = $1", [id, pending]);
    await query("UPDATE mailings SET template_id = $2 WHERE id = $1", [ready, approved]);
    await query("UPDATE mailings SET template_id = $2 WHERE id = $1", [turnedDown, rejected]);
    // A template with a conditional variant stands by both: waiting or rejected if either is, approved once both are.
    const on = async (conditional: { status: string; reason?: string }) => {
      const draft = (await createBroadcastDraft(JO, TEXT_FILTER))!;
      const template = await addTemplate("Fog on Friday", { condition: "has:firstName", conditional });
      await query("UPDATE mailings SET template_id = $2 WHERE id = $1", [draft, template]);
      return draft;
    };
    const halfWaiting = await on({ status: "pending" });
    const bothReady = await on({ status: "approved" });
    const halfTurnedDown = await on({ status: "rejected" });
    const drafts = (await broadcastsPage()).groups[0].mailings;
    // Each says who its conditional variant is for, as stored where no part has words for it; none for one variant.
    expect(drafts.find((m) => m.id === bothReady)!.variantFor).toBe("has:firstName");
    expect(drafts.find((m) => m.id === plain)!.variantFor).toBeNull();
    expect(drafts.map((m) => [m.id, m.waiting, m.approved, m.rejected]).sort()).toEqual([
      [plain, false, false, false],
      [id, true, false, false],
      [ready, false, true, false],
      [turnedDown, false, false, true],
      [halfWaiting, true, false, false],
      [bothReady, false, true, false],
      [halfTurnedDown, false, false, true],
    ]);
  });

  it("says who a broadcast's conditional variant is for in the words of the part that has it, in the list and on its page", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const template = await addTemplate("Ice on Sunday", { condition: registeredFor("evt-1"), conditional: {} });
    const id = await scheduled(TEXT_FILTER, { templateId: template });
    const who = broadcastsCopy.broadcastPages.conditions.registered("evt-1");
    const [{ mailings }] = (await broadcastsPage()).groups;
    expect(mailings.map((m) => [m.id, m.variantFor])).toEqual([[id, who]]);
    expect(await broadcastPageData(id, {}, JO)).toMatchObject({ kind: "written", summary: { variantFor: who } });
  });

  it("lists who one scheduled would go to now, by name, a page at a time, each yet to be sent", async () => {
    await addFollower("usr-1", "sam@example.com", "Sam");
    await addFollower("usr-2", "jane@example.com", "Jane Smith");
    await addFollower("usr-3", "nameless@example.com", "");
    const id = await scheduled(EMAIL_FILTER, { subject: "Soon", body: EVENT_WORDS });
    const data = await broadcastPageData(id, {}, JO);
    // An email has no link cards.
    expect(data).toMatchObject({ kind: "written", recipientsTotal: 3, pages: 1, summary: { to: 3 }, cards: {} });
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
      // Its broadcast as written, for the version they got, its top and buttons.
      written: { id, channel: "text", textVersion: null },
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

  it("gives a text's link cards, for each version's link, on its page and its copy's", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane Smith", { phone: "07700 900001" });
    const words = (text: string) => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });
    const template = await addTemplate("March day", {
      buttons: [{ text: "Sign up", url: "https://pauseai.uk/march" }],
      condition: registeredFor("evt-1"),
      conditional: { body: words("See https://pauseai.uk/route") },
    });
    const id = await scheduled(TEXT_FILTER, { templateId: template });
    // Our own site's pages, as the fixtures serve them, each with its card.
    const card = { title: expect.any(String), description: expect.any(String), name: "PauseAI UK", site: "pauseai.uk" };
    const cards = { "https://pauseai.uk/march": card, "https://pauseai.uk/route": card };
    expect(await broadcastPageData(id, {}, JO)).toMatchObject({ kind: "written", cards });
    const [copy] = await sent(id, [["delivered", null]]);
    expect((await messageCopy(id, copy))!.cards).toEqual(cards);
  });

  it("gives an email's copy no text as written, nor a text's whose broadcast has no words kept", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane Smith", { phone: "07700 900001" });
    const email = await scheduled(EMAIL_FILTER, { subject: "Events", body: EVENT_WORDS });
    const [emailCopy] = await sent(email, [["delivered", null]]);
    expect(await messageCopy(email, emailCopy)).toMatchObject({ channel: "email", written: null });
    const text = await scheduled(TEXT_FILTER, { templateId: await addTemplate("March day") });
    const [textCopy] = await sent(text, [["delivered", null]]);
    await query("UPDATE mailings SET body = NULL, state = 'sent' WHERE id = $1", [text]);
    expect(await messageCopy(text, textCopy)).toMatchObject({ channel: "text", written: null });
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
        state: "delivered",
        why: null,
      },
    ]);
    // Their reply, waiting for staff.
    await query(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, account, gmail_message_id,
         gmail_thread_id, blob_key, automatic)
       VALUES ($1, now(), 'jane@example.com', 'Re: Events', 'hello@pauseai.uk', 'g1', 't1', 'k', false)`,
      [copy],
    );
    expect(await broadcastsToSupporter(jane)).toMatchObject([{ state: "look" }]);
  });

  it("puts each copy in one state, the first that applies, with why", async () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) await addFollower(`usr-${n}`, `p${n}@example.com`, `P${n}`);
    const id = await scheduled(EMAIL_FILTER, { subject: "Events", body: EVENT_WORDS, sendBy: "gmail" });
    const copies = await sent(id, [
      ["delivered", null],
      ["failed", null],
      ["failed", null],
      ["failed", null],
      ["skipped", "not-on-whatsapp"],
      ["skipped", "not-on-whatsapp"],
      ["cancelled", null],
      ["delivered", null],
      ["sent", null],
    ]);
    const event = (copy: number, kind: string, details = {}) =>
      query("INSERT INTO broadcast_message_events (message_id, kind, details) VALUES ($1, $2, $3)", [
        copy,
        kind,
        JSON.stringify(details),
      ]);
    // Opted out because of it: replied stop.
    await query(
      `INSERT INTO opt_outs (address, list, way, source, source_ref, unsubscribed_at, message_id)
       VALUES ('+447700900001', 'events', 'text', 'whatsapp', 'reply w1 events', now(), $1)`,
      [copies[0]],
    );
    await event(copies[1], "bounced");
    await event(copies[2], "failed", { unfinished: true });
    await event(copies[3], "failed", { reason: "Recipient address rejected" });
    // Found not on WhatsApp by this one, and known before.
    await query("INSERT INTO whatsapp_unreachable (number, message_id) VALUES ('+447700900005', $1)", [copies[4]]);
    await query(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, account, gmail_message_id,
         gmail_thread_id, blob_key, automatic)
       VALUES ($1, now(), 'p8@example.com', 'Re: Events', 'hello@pauseai.uk', 'g8', 't8', 'k', false)`,
      [copies[7]],
    );
    const states = async () => {
      const data = await broadcastPageData(id, {}, JO);
      const rows = data!.kind === "written" ? data!.recipients : [];
      return copies.map((copy) => {
        const row = rows.find((one) => one.copyId === copy)!;
        return [row.state, row.why];
      });
    };
    expect(await states()).toEqual([
      ["opted-out", "whatsapp-reply"],
      ["unreached", "bounced"],
      ["error", "unfinished"],
      ["error", "gmail"],
      ["unreached", "not-on-whatsapp"],
      ["not-sent", "not-on-whatsapp"],
      ["not-sent", "cancelled"],
      ["look", null],
      ["sent", null],
    ]);
    // A broadcast that gave up: those it left are an error, and why.
    await query(
      "UPDATE mailings SET state = 'cancelled', gave_up = true, wait_reason = 'limit', waiting_since = now() WHERE id = $1",
      [id],
    );
    expect((await states())[6]).toEqual(["error", "limit"]);
  });
});
