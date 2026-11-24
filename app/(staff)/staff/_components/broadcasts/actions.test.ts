import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { query } from "@/lib/server/db.server";
import { createDraft, getWrittenMailing, saveDraft } from "@/lib/mailings/drafts.server";
import {
  createBroadcastDraft,
  getWrittenBroadcast,
  scheduleBroadcast,
  sendBroadcastTest,
  submitTemplate,
} from "@/lib/broadcasts/drafts.server";
import { createSession } from "@/lib/accounts/auth.server";
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
  reactToReplyNow,
  answerReplyNow,
  newBroadcastWith,
  rescheduleBroadcastNow,
  saveBroadcast,
  scheduleBroadcastNow,
  sendBroadcastTestNow,
  copyBroadcastNow,
  resumeBroadcastNow,
  stopBroadcastNow,
  deleteTemplateNow,
  submitTemplateNow,
  withdrawTemplateNow,
  linkCardFor,
  findPlacesFor,
} from "./actions";
import { broadcastWriterActions } from "./writer-actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
// The real ones, but for an answer a test gives in their place, for what only a race or WhatsApp's failing answers.
vi.mock("@/lib/broadcasts/drafts.server", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/broadcasts/drafts.server")>();
  return {
    ...real,
    scheduleBroadcast: vi.fn(real.scheduleBroadcast),
    sendBroadcastTest: vi.fn(real.sendBroadcastTest),
    submitTemplate: vi.fn(real.submitTemplate),
  };
});

const JO = "jo@pauseai.uk";
const EMAIL = { contact: "email:events:yes" };
const TEXT = { contact: "text:events:yes" };
const FUTURE = new Date("2099-01-01T09:18:00.000Z");
const GONE = { ok: false, reason: "gone" };
/** An answer's draft, by the ID its page made it. */
const DRAFT = "6f1c2a0e-5b7d-4c1e-9a3f-2d8e4b6c0a11";
const WORDS = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Thanks!" }] }] };

function form(fields: Record<string, string | string[] | File>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const one of [value].flat()) data.append(name, one);
  }
  return data;
}

const draft = async (params: Record<string, string> = EMAIL) => (await createBroadcastDraft(JO, params))!;

/** A reply to a copy of a broadcast, an email's or, with WhatsApp's ID for it, a text's; its ID. */
async function replyTo(broadcast: number, text = false): Promise<number> {
  const [{ copy }] = await query<{ copy: number }>(
    "INSERT INTO broadcast_messages (mailing_id, status) VALUES ($1, 'sent') RETURNING id::int AS copy",
    [broadcast],
  );
  const [{ reply }] = text
    ? await query<{ reply: number }>(
        `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, provider_message_id, body, automatic)
         VALUES ($1, now(), '+447700900123', '', 'wamid.reply', 'Thanks!', false) RETURNING id::int AS reply`,
        [copy],
      )
    : await query<{ reply: number }>(
        `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, account, gmail_message_id,
           gmail_thread_id, blob_key, automatic)
         VALUES ($1, now(), 'jane@example.com', 'Re', 'hello@pauseai.uk', 'g1', 't1', 'k', false) RETURNING id::int AS reply`,
        [copy],
      );
  return reply;
}

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

  it("throw on an ID or a version a component passes that isn't one", async () => {
    const id = await draft();
    const meets = ["has:firstName"];
    for (const attempt of [
      () => changeBroadcastConsentNow(0, EMAIL.contact),
      () => keepFilterForBroadcast("3" as unknown as number, form(EMAIL)),
      () => saveBroadcast(1.5, 1, {}),
      () => detachFromBroadcast(-1, 1, 1),
      () => sendBroadcastTestNow(0, meets),
      () => scheduleBroadcastNow(0, 1),
      () => submitTemplateNow(0),
      () => withdrawTemplateNow(0),
    ]) {
      await expect(attempt()).rejects.toThrow("without its ID");
    }
    for (const attempt of [
      () => saveBroadcast(id, 0, {}),
      () => detachFromBroadcast(id, 0, 1),
      () => scheduleBroadcastNow(id, 0),
    ]) {
      await expect(attempt()).rejects.toThrow("without its version");
    }
    await expect(detachFromBroadcast(id, 1, 0)).rejects.toThrow("without a file's ID");
    await expect(deleteTemplateNow(0)).rejects.toThrow("without a template's ID");
    await expect(answerReplyNow(1.5, DRAFT, WORDS)).rejects.toThrow("without a reply's ID");
    await expect(reactToReplyNow(1.5, "👍")).rejects.toThrow("without a reply's ID");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throw on a form without its own ID", async () => {
    const id = String(await draft());
    const file = new File(["x"], "brief.txt");
    for (const attempt of [
      () => attachToBroadcast(form({ version: "1", file })),
      () => deleteBroadcastDraft(form({})),
      () => stopBroadcastNow(form({ id: "" })),
      () => copyBroadcastNow(form({ id: "x" })),
      () => resumeBroadcastNow(form({ id: "0" })),
      () =>
        rescheduleBroadcastNow(form({ id: "", day: "2099-02-03", hour: "9", minute: "3", "finish-minutes": "720" })),
    ]) {
      await expect(attempt()).rejects.toThrow(`"id" isn't a row's ID`);
    }
    await expect(attachToBroadcast(form({ id, file }))).rejects.toThrow(`"version" isn't a row's ID`);
    await expect(dealWithReplyNow(form({ decision: "nothing" }))).rejects.toThrow(`"replyId" isn't a row's ID`);
    expect((await getWrittenBroadcast(Number(id)))!.state).toBe("draft");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throw on anything else a form or a component fills in itself that isn't what it fills in", async () => {
    const id = await draft();
    const meets = ["has:firstName"];
    await expect(newBroadcastWith("email:newsletter:unsure")).rejects.toThrow("none answered yes");
    expect(await query("SELECT id FROM mailings WHERE body IS NOT NULL")).toHaveLength(1);
    await expect(changeBroadcastConsentNow(id, "nonsense")).rejects.toThrow("none of its lists'");
    await expect(dealWithReplyNow(form({ replyId: "1", decision: "maybe" }))).rejects.toThrow("what to record it as");
    await expect(answerReplyNow(1, "not-a-uuid", WORDS)).rejects.toThrow("without its draft's ID");
    await expect(reactToReplyNow(1, "🎉")).rejects.toThrow("isn't one of ours");
    await expect(reactToReplyNow(1, 7 as unknown as string)).rejects.toThrow("isn't one of ours");
    // An email's draft takes no template.
    await expect(saveBroadcast(id, 1, { templateId: 1 })).rejects.toThrow("changes its writer doesn't make");
    await expect(attachToBroadcast(form({ id: String(id), version: "1" }))).rejects.toThrow("without the file");
    await expect(attachToBroadcast(form({ id: String(id), version: "1", file: new File([], "") }))).rejects.toThrow(
      "without the file",
    );
    await expect(sendBroadcastTestNow(id, "has:firstName", "me@pauseai.uk")).rejects.toThrow(
      "what its recipient meets",
    );
    await expect(sendBroadcastTestNow(id, [1], "me@pauseai.uk")).rejects.toThrow("what its recipient meets");
    await expect(sendBroadcastTestNow(id, meets, "not an address")).rejects.toThrow("an address it can go to");
    // A text's has no address to fall back on.
    await expect(sendBroadcastTestNow(await draft(TEXT), meets)).rejects.toThrow("an address it can go to");
    await expect(linkCardFor(7 as unknown as string)).rejects.toThrow("without its link");
    // No length, one that isn't minutes, or one that's no choice; a time that isn't one.
    const times = { id: String(id), day: "2099-02-04", hour: "9", minute: "3" };
    await expect(rescheduleBroadcastNow(form(times))).rejects.toThrow("how long it keeps trying");
    await expect(rescheduleBroadcastNow(form({ ...times, "finish-minutes": "x" }))).rejects.toThrow("how long");
    await expect(rescheduleBroadcastNow(form({ ...times, "finish-minutes": "100" }))).rejects.toThrow("how long");
    const finish = { "finish-minutes": "720" };
    await expect(rescheduleBroadcastNow(form({ ...times, ...finish, day: "soon" }))).rejects.toThrow(
      "a time that isn't",
    );
    await expect(rescheduleBroadcastNow(form({ ...times, ...finish, hour: "25" }))).rejects.toThrow(
      "a time that isn't",
    );
    expect(revalidatePath).not.toHaveBeenCalled();
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

  it("copies a broadcast to a new draft and opens it, and says one has gone", async () => {
    const id = await draft();
    const to = await expectRedirect(() => copyBroadcastNow(form({ id: String(id) })));
    expect(to).toMatch(/^\/staff\/broadcasts\/\d+$/);
    const copy = Number(to.split("/").at(-1));
    expect(copy).not.toBe(id);
    expect((await getWrittenBroadcast(copy))!.filter.params).toEqual(EMAIL);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/broadcasts");
    expect(await copyBroadcastNow(form({ id: "99999" }))).toEqual(GONE);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/broadcasts/99999");
    expect(await query("SELECT id FROM mailings WHERE body IS NOT NULL")).toHaveLength(2);
  });

  it("changes a draft's Consent, saying the version it made", async () => {
    const id = await draft();
    expect(await changeBroadcastConsentNow(id, "email:newsletter:yes")).toEqual({
      ok: true,
      version: (await getWrittenBroadcast(id))!.version,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/broadcasts/${id}`);
    expect((await getWrittenBroadcast(id))!.topics).toEqual(["newsletter"]);
  });

  it("changes a draft to several topics' yeses, and back to one", async () => {
    const id = await draft();
    expect(await changeBroadcastConsentNow(id, "email:newsletter:yes email:events:yes")).toMatchObject({ ok: true });
    expect((await getWrittenBroadcast(id))!.topics).toEqual(["newsletter", "events"]);
    expect(await changeBroadcastConsentNow(id, "email:events:yes")).toMatchObject({ ok: true });
    expect((await getWrittenBroadcast(id))!.topics).toEqual(["events"]);
  });

  it("refuses a Consent by another channel for a draft that has words now, and any for one that's gone or no longer a draft, showing its page afresh", async () => {
    const id = await draft();
    await saveBroadcast(id, 1, { subject: "Written meanwhile" });
    expect(await changeBroadcastConsentNow(id, TEXT.contact)).toEqual({ ok: false, reason: "conflict" });
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/broadcasts/${id}`);
    expect((await getWrittenBroadcast(id))!.channel).toBe("email");
    await query("UPDATE mailings SET state = 'scheduled', due_at = $2 WHERE id = $1", [id, FUTURE]);
    expect(await changeBroadcastConsentNow(id, "email:newsletter:yes")).toEqual(GONE);
    expect(await changeBroadcastConsentNow(999, "email:newsletter:yes")).toEqual(GONE);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/broadcasts/999");
  });

  it("records what a reply is, and says when it's been dealt with already", async () => {
    const reply = await replyTo(await draft());
    expect(await dealWithReplyNow(form({ replyId: String(reply), decision: "nothing" }))).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/broadcasts", "layout");
    vi.mocked(revalidatePath).mockClear();
    expect(await dealWithReplyNow(form({ replyId: String(reply), decision: "bulk" }))).toEqual(GONE);
    // The page is shown afresh, with what it was recorded as.
    expect(revalidatePath).toHaveBeenCalledWith("/staff/broadcasts", "layout");
    expect(await query("SELECT outcome FROM broadcast_replies")).toEqual([{ outcome: "nothing" }]);
  });

  it("sends an answer to a reply, showing the page afresh once it's gone, and says why one didn't go", async () => {
    await connectTestGmail("hello@pauseai.uk");
    const id = await draft();
    await query("UPDATE mailings SET sent_from = 'hello@pauseai.uk', from_name = 'PauseAI UK' WHERE id = $1", [id]);
    const reply = await replyTo(id);
    expect(await answerReplyNow(reply, DRAFT, { type: "doc", content: [] })).toEqual({ ok: false, reason: "blank" });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await answerReplyNow(reply, DRAFT, WORDS)).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/broadcasts", "layout");
    expect(await query("SELECT outcome, dealt_by FROM broadcast_replies")).toEqual([
      { outcome: "answered", dealt_by: JO },
    ]);
  });

  it("puts an emoji on a reply to a text, or takes ours away, showing the page afresh once it's gone, and says when the reply has gone", async () => {
    server.use(
      http.post(/graph\.facebook\.com\/.*\/messages$/, () =>
        HttpResponse.json({ messages: [{ id: "wamid.reaction" }] }),
      ),
    );
    const reply = await replyTo(await draft(), true);
    expect(await reactToReplyNow(reply + 1, "👍")).toEqual(GONE);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await reactToReplyNow(reply, "👍")).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/broadcasts", "layout");
    expect(await query("SELECT outcome, dealt_by FROM broadcast_replies")).toEqual([
      { outcome: "answered", dealt_by: JO },
    ]);
    expect(await reactToReplyNow(reply, "")).toEqual({ ok: true });
    expect(await query("SELECT removed_at IS NOT NULL AS removed FROM broadcast_answers")).toEqual([{ removed: true }]);
  });

  it("keeps who it's to from the list, and goes back to the draft", async () => {
    const id = await draft();
    await expect(expectRedirect(() => keepFilterForBroadcast(id, form({ ...EMAIL, nation: "england" })))).resolves.toBe(
      `/staff/broadcasts/${id}`,
    );
    expect((await getWrittenBroadcast(id))!.filter.params).toEqual({ ...EMAIL, nation: "england" });
  });

  it("saves a draft's changes, and says why not: someone else saved since, or it's no broadcast", async () => {
    const id = await draft();
    expect(await saveBroadcast(id, 1, { subject: "Events" })).toEqual({ ok: true, version: 2 });
    expect(await saveBroadcast(id, 1, { subject: "Too late" })).toEqual({ ok: false, reason: "conflict" });
    expect(await saveBroadcast(999, 1, { subject: "Events" })).toEqual(GONE);
    expect((await getWrittenBroadcast(id))!.subject).toBe("Events");
  });

  it("attaches a file and takes it off, and says why not: its version has passed, or it's no broadcast", async () => {
    const id = await draft();
    const file = new File(["x"], "brief.txt");
    expect(await attachToBroadcast(form({ id: "999", version: "1", file }))).toEqual(GONE);
    const added = await attachToBroadcast(form({ id: String(id), version: "1", file }));
    expect(added).toMatchObject({
      ok: true,
      version: 2,
      attachments: [{ filename: "brief.txt", contentType: "application/octet-stream" }],
    });
    expect(await attachToBroadcast(form({ id: String(id), version: "1", file }))).toEqual({
      ok: false,
      reason: "conflict",
    });
    const attachment = added.ok ? added.attachments[0].id : 0;
    expect(await detachFromBroadcast(id, 1, attachment)).toEqual({ ok: false, reason: "conflict" });
    expect(await detachFromBroadcast(id, 2, attachment)).toEqual({ ok: true, version: 3, attachments: [] });
    expect(await detachFromBroadcast(999, 1, 1)).toEqual(GONE);
  });

  it("sends a test copy for someone made up: an email to you with no address given, a text only to a number, and says when it didn't go", async () => {
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const meets = ["has:firstName"];
    const email = await draft();
    await saveBroadcast(email, 1, { subject: "Hi", body: EVENT_WORDS });
    expect(await sendBroadcastTestNow(email, meets)).toEqual({ ok: true, to: JO });
    // What sends it refused it.
    vi.mocked(sendBroadcastTest).mockResolvedValueOnce({ sent: false, reason: "failed" });
    expect(await sendBroadcastTestNow(email, meets)).toEqual({ ok: false, reason: "not-sent" });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await sendBroadcastTestNow(999, meets, "me@pauseai.uk")).toEqual(GONE);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/broadcasts/999");
    const text = await draft(TEXT);
    // A text with no approved template can't go.
    expect(await sendBroadcastTestNow(text, meets, "+447700900002")).toEqual({ ok: false, reason: "not-sent" });
    await saveBroadcast(text, 1, { templateId: await addTemplate("March day") });
    expect(await sendBroadcastTestNow(text, meets, " +447700900002 ")).toEqual({ ok: true, to: "+447700900002" });
  });

  it("schedules, and says why not, showing the draft's page afresh", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    const id = await draft();
    await saveBroadcast(id, 1, { subject: "Hi", body: EVENT_WORDS });
    // With no time yet: something wrong with it that its page would have said.
    expect(await scheduleBroadcastNow(id, 2)).toEqual({ ok: false, reason: "not-ready" });
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/broadcasts/${id}`);
    await saveBroadcast(id, 2, { dueAt: FUTURE });
    expect(await scheduleBroadcastNow(id, 2)).toEqual({ ok: false, reason: "conflict" });
    // A text's new words, which scheduling sends for approval: the site refused them, or WhatsApp didn't take them.
    vi.mocked(scheduleBroadcast).mockResolvedValueOnce({ scheduled: false, submit: "already" });
    expect(await scheduleBroadcastNow(id, 3)).toEqual({ ok: false, reason: "already" });
    vi.mocked(scheduleBroadcast).mockResolvedValueOnce({ scheduled: false, submit: { failed: "Bad" } });
    expect(await scheduleBroadcastNow(id, 3)).toEqual({ ok: true, scheduled: false, said: "Bad" });
    expect((await getWrittenBroadcast(id))!.state).toBe("draft");
    vi.mocked(revalidatePath).mockClear();
    expect(await scheduleBroadcastNow(id, 3)).toEqual({ ok: true, scheduled: true });
    expect(revalidatePath.mock.calls).toEqual([["/staff/broadcasts"]]);
    expect(await scheduleBroadcastNow(id, 3)).toEqual({ ok: false, reason: "not-draft" });
  });

  it("changes a scheduled broadcast's times, and says when they've passed or it's no longer scheduled", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    const id = await draft();
    await saveBroadcast(id, 1, { subject: "Hi", body: EVENT_WORDS, dueAt: FUTURE });
    await scheduleBroadcastNow(id, 2);
    const finish = { "finish-minutes": "720" };
    const times = { id: String(id), day: "2099-02-03", hour: "9", minute: "33" };
    expect(await rescheduleBroadcastNow(form({ ...times, ...finish }))).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/broadcasts/${id}`);
    expect(await getWrittenBroadcast(id)).toMatchObject({
      dueAt: new Date("2099-02-03T09:33:00.000Z"),
      finishMinutes: 720,
    });
    // Seven days, the most, is kept as none.
    expect(await rescheduleBroadcastNow(form({ ...times, "finish-minutes": "10080" }))).toEqual({ ok: true });
    expect((await getWrittenBroadcast(id))!.finishMinutes).toBeNull();
    const moved = (await getWrittenBroadcast(id))!.dueAt;
    expect(await rescheduleBroadcastNow(form({ ...times, ...finish, day: "2020-02-03" }))).toEqual({
      ok: false,
      reason: "too-soon",
    });
    expect((await getWrittenBroadcast(id))!.dueAt).toEqual(moved);
    // Sending, it has no time to send, only how long it keeps trying.
    await query("UPDATE mailings SET state = 'sending' WHERE id = $1", [id]);
    expect(await rescheduleBroadcastNow(form({ id: String(id), ...finish }))).toEqual({ ok: true });
    await query("UPDATE mailings SET state = 'sent' WHERE id = $1", [id]);
    expect(await rescheduleBroadcastNow(form({ ...times, ...finish }))).toEqual(GONE);
    expect(await rescheduleBroadcastNow(form({ ...times, ...finish, id: "999" }))).toEqual(GONE);
  });

  it("stops and resumes, and says when there's nothing to stop or to resume", async () => {
    await addFollower("usr-1", "jane@example.com", "Jane");
    const id = await draft();
    await saveBroadcast(id, 1, { subject: "Hi", body: EVENT_WORDS, dueAt: FUTURE });
    await scheduleBroadcastNow(id, 2);
    // Not stopped as it hadn't all gone in time, it has nothing to resume.
    expect(await resumeBroadcastNow(form({ id: String(id) }))).toEqual(GONE);
    await query(
      "UPDATE mailings SET state = 'cancelled', gave_up = true, waiting_since = now(), wait_reason = 'limit' WHERE id = $1",
      [id],
    );
    expect(await resumeBroadcastNow(form({ id: String(id) }))).toEqual({ ok: true });
    expect((await getWrittenBroadcast(id))!.state).toBe("scheduled");
    expect(await stopBroadcastNow(form({ id: String(id) }))).toEqual({ ok: true });
    expect((await getWrittenBroadcast(id))!.state).toBe("draft");
    vi.mocked(revalidatePath).mockClear();
    // A draft again, it has nothing to stop.
    expect(await stopBroadcastNow(form({ id: String(id) }))).toEqual(GONE);
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/broadcasts/${id}`);
  });

  it("deletes a draft, and only a broadcast's; one gone already is as deleted as was asked", async () => {
    const id = await draft();
    await expect(expectRedirect(() => deleteBroadcastDraft(form({ id: String(id) })))).resolves.toBe(
      "/staff/broadcasts",
    );
    expect(await getWrittenBroadcast(id)).toBeUndefined();
    const { id: mailing } = await createDraft(JO, { list: "politicians", params: {} }, {});
    await expectRedirect(() => deleteBroadcastDraft(form({ id: String(mailing) })));
    expect(await getWrittenMailing(mailing)).toBeDefined();
    await expect(expectRedirect(() => deleteBroadcastDraft(form({ id: String(id) })))).resolves.toBe(
      "/staff/broadcasts",
    );
  });

  it("sends new words for approval, saying whether WhatsApp took them, and only for a text", async () => {
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    const email = await draft();
    expect(await submitTemplateNow(email)).toEqual({ ok: false, reason: "not-text" });
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/broadcasts/${email}`);
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draft(TEXT);
    await saveBroadcast(id, 1, { body: EVENT_WORDS, title: "See you there.", dueAt: FUTURE });
    vi.mocked(submitTemplate).mockResolvedValueOnce({ failed: "Bad" });
    expect(await submitTemplateNow(id)).toEqual({ ok: true, taken: false, said: "Bad" });
    // As fixture builds' WhatsApp takes them.
    expect(await submitTemplateNow(id)).toEqual({ ok: true, taken: true });
    expect((await getWrittenBroadcast(id))!.template).toMatchObject({ status: "pending" });
  });

  it("withdraws words WhatsApp is reviewing, and says when there are none to take back", async () => {
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    await addFollower("usr-1", "jane@example.com", "Jane", { phone: "07700 900001" });
    const id = await draft(TEXT);
    await saveBroadcast(id, 1, { body: EVENT_WORDS, title: "See you there.", dueAt: FUTURE });
    expect(await withdrawTemplateNow(id)).toEqual(GONE);
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/broadcasts/${id}`);
    await submitTemplateNow(id);
    expect(await withdrawTemplateNow(id)).toEqual({ ok: true });
    expect((await getWrittenBroadcast(id))!.template).toBeNull();
  });

  it("deletes a template, as its writer's page asks, refreshing the broadcasts' pages, and says why not", async () => {
    // As fixture builds' WhatsApp takes it.
    expect(await deleteTemplateNow(await addTemplate("Old words"))).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/broadcasts", "layout");
    expect(await deleteTemplateNow(99999)).toEqual(GONE);
  });

  it("gives the card WhatsApp would show for a text's link", async () => {
    expect(await linkCardFor("https://pauseai.uk/march")).toMatchObject({
      ok: true,
      card: { title: "March Against AI Extinction & for a pause", site: "pauseai.uk" },
    });
  });

  it("finds the places some words name, for a text's map, only for staff", async () => {
    expect(await findPlacesFor("Parliament Square")).toEqual([expect.objectContaining({ name: "Parliament Square" })]);
    await query("UPDATE staff_accounts SET permissions = '{}' WHERE email = $1", [JO]);
    await expect(findPlacesFor("Parliament Square")).rejects.toThrow();
  });

  it("gives the writer each of its actions", () => {
    expect(broadcastWriterActions).toMatchObject({
      submitTemplate: submitTemplateNow,
      withdrawTemplate: withdrawTemplateNow,
      deleteTemplate: deleteTemplateNow,
      linkCard: linkCardFor,
      schedule: scheduleBroadcastNow,
    });
  });

  it("leaves a mailing to politicians alone", async () => {
    const { id } = await createDraft(JO, { list: "politicians", params: {} }, {});
    await saveDraft(id, 1, { subject: "Mine" });
    expect(await saveBroadcast(id, 2, { subject: "Theirs" })).toEqual(GONE);
    expect(await stopBroadcastNow(form({ id: String(id) }))).toEqual(GONE);
    expect((await getWrittenMailing(id))!.subject).toBe("Mine");
  });
});
