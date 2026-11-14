import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { query } from "@/lib/server/db";
import { createDraft, getWrittenMailing, saveDraft } from "@/lib/server/mailing-drafts";
import { createBroadcastDraft, getWrittenBroadcast } from "@/lib/server/broadcast-drafts";
import { createSession } from "@/lib/accounts/auth";
import { connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { addFollower, addTemplate, EVENT_WORDS } from "@/tests/broadcast-fixtures";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import {
  attachToBroadcast,
  deleteBroadcastDraft,
  detachFromBroadcast,
  keepFilterForBroadcast,
  newBroadcast,
  changeBroadcastConsentNow,
  dealWithReplyNow,
  answerReplyNow,
  newBroadcastWith,
  rescheduleBroadcastNow,
  saveBroadcast,
  scheduleBroadcastNow,
  sendBroadcastTestNow,
  resumeBroadcastNow,
  stopBroadcastNow,
  submitTemplateNow,
  withdrawTemplateNow,
} from "./broadcast-actions";
import { broadcastWriterActions } from "./(signed-in)/broadcasts/writer-actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const JO = "jo@pauseai.uk";
const EMAIL = { contact: "email:events:yes" };
const TEXT = { contact: "text:events:yes" };
const FUTURE = new Date("2099-01-01T09:18:00.000Z");

function form(fields: Record<string, string | string[] | File>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const one of [value].flat()) data.append(name, one);
  }
  return data;
}

const draft = async (params: Record<string, string> = EMAIL) => (await createBroadcastDraft(JO, params))!;

beforeEach(() => {
  vi.stubEnv("DATA_FIXTURES", "1");
  vi.stubEnv("WHATSAPP_TOKEN", "token");
  vi.stubEnv("WHATSAPP_ACCOUNT_ID", "fixture-account");
});
afterEach(() => vi.unstubAllEnvs());

describeWithDatabase("the broadcast pages' Server Actions", () => {
  useTestDatabase();
  // An email goes by hello@'s Gmail, which is connected.
  beforeEach(() => connectTestGmail("hello@pauseai.uk"));

  beforeEach(async () => {
    requestCookies.clear();
    revalidatePath.mockClear();
    requestCookies.set("staff_session", await createSession(JO));
    await query("UPDATE staff_accounts SET permissions = ARRAY['supporters'] WHERE email = $1", [JO]);
  });

  it("asks for the supporters permission", async () => {
    await query("UPDATE staff_accounts SET permissions = '{}' WHERE email = $1", [JO]);
    await expect(saveBroadcast(1, 1, {})).rejects.toThrow();
  });

  it("makes a broadcast from a Consent filter answered yes, and opens it", async () => {
    const to = await expectRedirect(() =>
      newBroadcast(form({ ...EMAIL, near: "LS1", page: "2", file: new File(["x"], "x.txt") })),
    );
    expect(to).toMatch(/^\/staff\/broadcasts\/\d+$/);
    const id = Number(to.split("/").at(-1));
    expect((await getWrittenBroadcast(id))!.filter.params).toEqual({ ...EMAIL, near: "LS1" });
  });

  it("goes back to the list, without a Consent filter answered yes", async () => {
    await expect(expectRedirect(() => newBroadcast(form({ near: "LS1", within: ["10", "25"] })))).resolves.toBe(
      "/staff/supporters?near=LS1&within=10&within=25",
    );
    expect(await query("SELECT id FROM mailings WHERE body IS NOT NULL")).toEqual([]);
  });

  it("makes a draft under New broadcast's Consent, to everyone who said yes, and opens it", async () => {
    const to = await expectRedirect(() => newBroadcastWith(EMAIL.contact));
    const [{ id }] = await query<{ id: number }>("SELECT id::int AS id FROM mailings WHERE body IS NOT NULL");
    expect(to).toBe(`/staff/broadcasts/${id}`);
    expect((await getWrittenBroadcast(id))!.filter.params).toEqual(EMAIL);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/broadcasts");
  });

  it("makes none without a Consent answered yes", async () => {
    await newBroadcastWith("email:newsletter:unsure");
    expect(await query("SELECT id FROM mailings WHERE body IS NOT NULL")).toEqual([]);
  });

  it("changes a draft's Consent, and says when it didn't", async () => {
    const id = await draft();
    expect(await changeBroadcastConsentNow(id, "email:newsletter:yes")).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/broadcasts/${id}`);
    expect((await getWrittenBroadcast(id))!.topics).toEqual(["newsletter"]);
    vi.mocked(revalidatePath).mockClear();
    expect(await changeBroadcastConsentNow(id, "nonsense")).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("changes a draft to several topics' yeses, and back to one", async () => {
    const id = await draft();
    expect(await changeBroadcastConsentNow(id, "email:newsletter:yes email:events:yes")).toBe(true);
    expect((await getWrittenBroadcast(id))!.topics).toEqual(["newsletter", "events"]);
    expect(await changeBroadcastConsentNow(id, "email:events:yes")).toBe(true);
    expect((await getWrittenBroadcast(id))!.topics).toEqual(["events"]);
  });

  it("records what a reply is, and nothing for a form that doesn't say", async () => {
    const id = await draft();
    const [{ copy }] = await query<{ copy: number }>(
      "INSERT INTO broadcast_messages (mailing_id, status) VALUES ($1, 'sent') RETURNING id::int AS copy",
      [id],
    );
    const [{ reply }] = await query<{ reply: number }>(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, account, gmail_message_id,
         gmail_thread_id, blob_key, automatic)
       VALUES ($1, now(), 'jane@example.com', 'Re', 'hello@pauseai.uk', 'g1', 't1', 'k', false) RETURNING id::int AS reply`,
      [copy],
    );
    await dealWithReplyNow(form({ replyId: String(reply), decision: "maybe" }));
    await dealWithReplyNow(form({ decision: "nothing" }));
    expect(revalidatePath).not.toHaveBeenCalled();
    await dealWithReplyNow(form({ replyId: String(reply), decision: "nothing" }));
    expect(revalidatePath).toHaveBeenCalledWith("/staff/broadcasts", "layout");
    vi.mocked(revalidatePath).mockClear();
    await dealWithReplyNow(form({ replyId: String(reply), decision: "bulk" }));
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await query("SELECT outcome FROM broadcast_replies")).toEqual([{ outcome: "nothing" }]);
  });

  it("sends an answer to a reply, showing the page afresh once it's gone, and nothing for a reply or draft it can't name", async () => {
    await connectTestGmail("hello@pauseai.uk");
    const id = await draft();
    await query("UPDATE mailings SET sent_from = 'hello@pauseai.uk', from_name = 'PauseAI UK' WHERE id = $1", [id]);
    const [{ copy }] = await query<{ copy: number }>(
      "INSERT INTO broadcast_messages (mailing_id, status) VALUES ($1, 'sent') RETURNING id::int AS copy",
      [id],
    );
    const [{ reply }] = await query<{ reply: number }>(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, account, gmail_message_id,
         gmail_thread_id, blob_key, automatic)
       VALUES ($1, now(), 'jane@example.com', 'Re', 'hello@pauseai.uk', 'g1', 't1', 'k', false) RETURNING id::int AS reply`,
      [copy],
    );
    const body = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Thanks!" }] }] };
    const DRAFT = "6f1c2a0e-5b7d-4c1e-9a3f-2d8e4b6c0a11";
    expect(await answerReplyNow(reply, "not-a-uuid", body)).toEqual({ sent: false, reason: "gone" });
    expect(await answerReplyNow(1.5, DRAFT, body)).toEqual({ sent: false, reason: "gone" });
    expect(await answerReplyNow(reply, DRAFT, { type: "doc", content: [] })).toEqual({ sent: false, reason: "blank" });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await answerReplyNow(reply, DRAFT, body)).toEqual({ sent: true });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/broadcasts", "layout");
    expect(await query("SELECT outcome, dealt_by FROM broadcast_replies")).toEqual([
      { outcome: "answered", dealt_by: JO },
    ]);
  });

  it("keeps who it's to from the list, and goes back to the draft", async () => {
    const id = await draft();
    await expect(expectRedirect(() => keepFilterForBroadcast(id, form({ ...EMAIL, nation: "england" })))).resolves.toBe(
      `/staff/broadcasts/${id}`,
    );
    expect((await getWrittenBroadcast(id))!.filter.params).toEqual({ ...EMAIL, nation: "england" });
  });

  it("saves a draft's changes, by its channel, and none that aren't allowed or to no broadcast", async () => {
    const id = await draft();
    expect(await saveBroadcast(id, 1, { subject: "Events" })).toEqual({ saved: true, version: 2 });
    expect(await saveBroadcast(id, 2, { templateId: 1 })).toBeUndefined();
    expect(await saveBroadcast(999, 1, { subject: "Events" })).toBeUndefined();
  });

  it("attaches a file, takes it off, and refuses what isn't one or isn't a broadcast's", async () => {
    const id = await draft();
    const file = new File(["x"], "brief.txt");
    expect(await attachToBroadcast(form({ id: String(id), version: "1" }))).toBeUndefined();
    expect(await attachToBroadcast(form({ id: "999", version: "1", file }))).toBeUndefined();
    const added = await attachToBroadcast(form({ id: String(id), version: "1", file }));
    expect(added).toMatchObject({
      saved: true,
      attachments: [{ filename: "brief.txt", contentType: "application/octet-stream" }],
    });
    expect(await detachFromBroadcast(id, 2, added!.attachments[0].id)).toMatchObject({ saved: true, attachments: [] });
    expect(await detachFromBroadcast(999, 1, 1)).toEqual({ saved: false, reason: "gone", attachments: [] });
  });

  it("sends a test copy for someone made up: an email to you with no address given, a text only to a number", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const meets = ["has:firstName"];
    const email = await draft();
    await saveBroadcast(email, 1, { subject: "Hi", body: EVENT_WORDS });
    expect(await sendBroadcastTestNow(email, meets)).toMatchObject({ sent: true, to: JO });
    expect(await sendBroadcastTestNow(email, meets, "not an address")).toBeUndefined();
    expect(await sendBroadcastTestNow(email, "has:firstName", "me@pauseai.uk")).toBeUndefined();
    expect(await sendBroadcastTestNow(email, [1], "me@pauseai.uk")).toBeUndefined();
    expect(await sendBroadcastTestNow(999, meets, "me@pauseai.uk")).toBeUndefined();
    const text = await draft(TEXT);
    expect(await sendBroadcastTestNow(text, meets)).toBeUndefined();
    await saveBroadcast(text, 1, { templateId: await addTemplate("March day") });
    expect(await sendBroadcastTestNow(text, meets, " +447700900002 ")).toMatchObject({
      sent: true,
      to: "+447700900002",
    });
  });

  it("schedules, changes the time, and stops", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    const id = await draft();
    await saveBroadcast(id, 1, { subject: "Hi", body: EVENT_WORDS, dueAt: FUTURE });
    expect(await scheduleBroadcastNow(id, 2)).toEqual({ scheduled: true });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/broadcasts");
    await rescheduleBroadcastNow(form({ id: String(id), day: "2099-02-03", hour: "9", minute: "33" }));
    expect((await getWrittenBroadcast(id))!.dueAt).toEqual(new Date("2099-02-03T09:33:00.000Z"));
    const moved = (await getWrittenBroadcast(id))!.dueAt;
    await rescheduleBroadcastNow(form({ id: "", day: "2099-02-03", hour: "9", minute: "3" }));
    await rescheduleBroadcastNow(form({ id: String(id), day: "soon", hour: "9", minute: "3" }));
    await rescheduleBroadcastNow(form({ id: String(id), day: "2099-02-04", hour: "25", minute: "3" }));
    await rescheduleBroadcastNow(form({ id: "999", day: "2099-02-04", hour: "9", minute: "3" }));
    expect((await getWrittenBroadcast(id))!.dueAt).toEqual(moved);
    await stopBroadcastNow(form({ id: "" }));
    expect((await getWrittenBroadcast(id))!.state).toBe("scheduled");
    // Stopped as it hadn't all gone in time, it resumes.
    await query(
      "UPDATE mailings SET state = 'cancelled', gave_up = true, waiting_since = now(), wait_reason = 'limit' WHERE id = $1",
      [id],
    );
    await resumeBroadcastNow(form({ id: "" }));
    expect((await getWrittenBroadcast(id))!.state).toBe("cancelled");
    await resumeBroadcastNow(form({ id: String(id) }));
    expect((await getWrittenBroadcast(id))!.state).toBe("scheduled");
    await stopBroadcastNow(form({ id: String(id) }));
    expect((await getWrittenBroadcast(id))!.state).toBe("draft");
  });

  it("deletes a draft, and only a broadcast's", async () => {
    const id = await draft();
    await expect(expectRedirect(() => deleteBroadcastDraft(form({ id: String(id) })))).resolves.toBe(
      "/staff/broadcasts",
    );
    expect(await getWrittenBroadcast(id)).toBeUndefined();
    const { id: mailing } = await createDraft(JO, { list: "politicians", params: {} }, {});
    await expectRedirect(() => deleteBroadcastDraft(form({ id: String(mailing) })));
    expect(await getWrittenMailing(mailing)).toBeDefined();
    await expectRedirect(() => deleteBroadcastDraft(form({})));
  });

  it("sends new words for approval, and withdraws them, only for a text", async () => {
    const id = await draft();
    expect(await submitTemplateNow(id)).toBe("not-text");
    expect(await withdrawTemplateNow(id)).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/broadcasts/${id}`);
  });

  it("gives the writer each of its actions", () => {
    expect(broadcastWriterActions).toMatchObject({
      submitTemplate: submitTemplateNow,
      withdrawTemplate: withdrawTemplateNow,
      schedule: scheduleBroadcastNow,
    });
  });

  it("leaves a mailing to politicians alone", async () => {
    const { id } = await createDraft(JO, { list: "politicians", params: {} }, {});
    await saveDraft(id, 1, { subject: "Mine" });
    expect(await saveBroadcast(id, 2, { subject: "Theirs" })).toBeUndefined();
    await stopBroadcastNow(form({ id: String(id) }));
    expect((await getWrittenMailing(id))!.subject).toBe("Mine");
  });
});
