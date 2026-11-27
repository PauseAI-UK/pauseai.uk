import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { query } from "@/lib/server/db.server";
import {
  createDraft,
  getWrittenMailing,
  pastedFor,
  saveDraft,
  type MailingChanges,
} from "@/lib/mailings/drafts.server";
import { createBroadcastDraft, getWrittenBroadcast } from "@/lib/broadcasts/drafts.server";
import { createSession } from "@/lib/accounts/auth.server";
import { addTestPolitician, connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import {
  attachToMailing,
  copyMailingNow,
  deleteMailingDraft,
  detachFromMailing,
  leaveOutOfMailing,
  newMailing,
  pasteNames,
  pickFound,
  pickMany,
  pickPolitician,
  rescheduleMailingNow,
  untickAll,
  saveMailing,
  scheduleMailingNow,
  sendMailingTest,
  stopMailingNow,
  nothingToDoNow,
  answerLetterReplyNow,
  saveCampaignLetter,
  publishCampaignLetter,
  discardCampaignLetter,
} from "./actions";
import { campaignDraft, openDraft, publishedLetter } from "@/lib/mailings/campaign-letters.server";

vi.mock("next/headers", () => import("@/tests/next-headers"));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const JO = "jo@pauseai.uk";
const LETTER = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };
/** What an action answers for a mailing that's gone, or has moved on so the change can't be made. */
const GONE = { ok: false, reason: "gone" };
/** A value that isn't what a component passes, as a request made up could send. */
const madeUp = <T>(value: unknown) => value as T;

/** A draft by Jo, with no one ticked, and its first changes. */
const draft = (changes: MailingChanges = {}) =>
  createDraft(JO, { list: "politicians", params: {}, picked: { ids: [] } }, changes);

/** Marks draft `id` scheduled, from Jo, as someone else's Schedule would leave it. */
const schedule = (id: number) =>
  query(
    `UPDATE mailings SET state = 'scheduled', sent_from = $2, from_name = 'Jo', due_at = '2099-01-01T09:00:00Z'
     WHERE id = $1`,
    [id, JO],
  );

function form(fields: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const one of [value].flat()) data.append(name, one);
  }
  return data;
}

describeWithDatabase("the mailing pages' Server Actions", () => {
  useTestDatabase();

  beforeEach(async () => {
    requestCookies.clear();
    revalidatePath.mockClear();
    requestCookies.set("staff_session", await createSession(JO));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("change nothing without a session", async () => {
    requestCookies.clear();
    const attempts = [
      () => newMailing(form({})),
      () => copyMailingNow(form({ id: "1" })),
      () => pickPolitician(1, 1, true),
      () => pickFound(1, {}, true),
      () => pasteNames(form({ names: "Jo" })),
      () => pickMany(1, [1], true),
      () => leaveOutOfMailing(1, [1]),
      () => untickAll(1),
      () => saveMailing(1, 1, { subject: "x" }),
      () => attachToMailing(form({ id: "1" })),
      () => detachFromMailing(1, 1, 1),
      () => sendMailingTest(1, 1),
      () => scheduleMailingNow(1, 1),
      () => deleteMailingDraft(form({ id: "1" })),
      () => stopMailingNow(form({ id: "1" })),
      () => rescheduleMailingNow(form({ id: "1", day: "2026-12-01", hour: "9" })),
    ];
    for (const attempt of attempts) expect(await expectRedirect(attempt)).toBe("/staff/login");
    expect(await query("SELECT 1 FROM mailings WHERE body IS NOT NULL")).toEqual([]);
  });

  it("copies a mailing to a new draft and opens it; one that's gone is refused, and a form without its ID thrown on", async () => {
    const { id } = await draft({ subject: "Hello", body: LETTER as MailingChanges["body"] });
    const to = await expectRedirect(() => copyMailingNow(form({ id: String(id) })));
    const copy = Number(to.match(/^\/staff\/mailings\/(\d+)$/)![1]);
    expect(copy).not.toBe(id);
    expect(await getWrittenMailing(copy)).toMatchObject({ subject: "Hello", body: LETTER, createdBy: JO });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/mailings");
    await expect(copyMailingNow(form({ id: "x" }))).rejects.toThrow(/isn't a row's ID/);
    expect(await copyMailingNow(form({ id: "99999" }))).toEqual(GONE);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/mailings/99999");
    expect(await query("SELECT id FROM mailings WHERE body IS NOT NULL")).toHaveLength(2);
  });

  it("makes a new mailing with no one ticked, opening it for its ask, or everyone the list's filter finds, choosing for it", async () => {
    const polly = await addTestPolitician();
    await addTestPolitician({ name: "Lord Sample", airtableId: "rec2", house: "lords" });
    const empty = await expectRedirect(() => newMailing(form({})));
    const id = Number(empty.match(/^\/staff\/mailings\/(\d+)$/)![1]);
    expect(await getWrittenMailing(id)).toMatchObject({ createdBy: JO, filter: { picked: { ids: [] } } });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/mailings");

    const found = await expectRedirect(() => newMailing(form({ house: "commons", sort: "name", found: "1" })));
    const ticked = Number(found.match(/^\/staff\/politicians\?house=commons&mailing=(\d+)$/)![1]);
    expect((await getWrittenMailing(ticked))!.filter).toEqual({
      list: "politicians",
      params: {},
      picked: { ids: [polly], from: { params: { house: "commons" }, at: expect.any(String), found: [polly] } },
    });
  });

  it("saves a draft's changes; refuses one saved since, scheduled or gone; and throws on what isn't a change, an ID or a version", async () => {
    const { id } = await draft({ subject: "Hi", body: LETTER as MailingChanges["body"] });
    expect(await saveMailing(id, 1, { sentFrom: "Jo@PauseAI.uk", dueAt: new Date("2026-12-01T09:00:00Z") })).toEqual({
      ok: true,
      version: 2,
    });
    expect(await getWrittenMailing(id)).toMatchObject({ sentFrom: JO, dueAt: new Date("2026-12-01T09:00:00Z") });
    await expect(saveMailing(id, 2, { subject: 3 })).rejects.toThrow(/changes that aren't a mailing's/);
    await expect(saveMailing(id, 2, { filter: { list: "politicians", params: {} } })).rejects.toThrow(/changes/);
    await expect(saveMailing(0, 2, { subject: "x" })).rejects.toThrow(/without its ID/);
    await expect(saveMailing(madeUp("7"), 2, { subject: "x" })).rejects.toThrow(/without its ID/);
    await expect(saveMailing(id, 1.5, { subject: "x" })).rejects.toThrow(/without its version/);
    expect((await getWrittenMailing(id))!.subject).toBe("Hi");
    // Someone else has saved it since, it's gone, or it's been scheduled.
    expect(await saveMailing(id, 1, { subject: "Late" })).toEqual({ ok: false, reason: "conflict" });
    expect(await saveMailing(99999, 1, { subject: "x" })).toEqual(GONE);
    await schedule(id);
    expect(await saveMailing(id, 2, { subject: "Late" })).toEqual({ ok: false, reason: "not-draft" });
    // A refused save leaves the page as it is, with what was typed.
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("ticks and unticks a politician, and everyone the list's filter finds; not for a draft that's gone, or no longer one", async () => {
    const polly = await addTestPolitician();
    const lord = await addTestPolitician({ name: "Lord Sample", airtableId: "rec2", house: "lords" });
    const { id } = await draft();
    const ticked = async () => (await getWrittenMailing(id))!.filter.picked!.ids;
    expect(await pickPolitician(id, lord, true)).toEqual({ ok: true });
    expect(await ticked()).toEqual([lord]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/politicians");
    expect(await pickFound(id, { house: "commons" }, true)).toEqual({ ok: true });
    expect(await ticked()).toEqual([lord, polly]);
    await pickPolitician(id, lord, false);
    expect(await ticked()).toEqual([polly]);
    await pickFound(id, { house: "commons" }, false);
    expect(await ticked()).toEqual([]);
    // Everyone unticked, and the group they were ticked from forgotten, to start again.
    await pickFound(id, { house: "commons" }, true);
    expect(await untickAll(id)).toEqual({ ok: true });
    expect((await getWrittenMailing(id))!.filter.picked).toEqual({ ids: [] });
    // What isn't a politician's ID, or the list's filters, is thrown on.
    await expect(pickPolitician(id, 0, true)).rejects.toThrow(/without its politician/);
    await expect(pickFound(id, madeUp(null), true)).rejects.toThrow(/without its filters/);
    await expect(pickFound(id, madeUp("house=commons"), true)).rejects.toThrow(/without its filters/);
    await expect(untickAll(madeUp(undefined))).rejects.toThrow(/without its ID/);
    // Scheduled since the list loaded, or gone: refused, and the list shown afresh.
    await schedule(id);
    revalidatePath.mockClear();
    expect(await pickPolitician(id, lord, true)).toEqual(GONE);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/politicians");
    expect(await pickFound(id, { house: "commons" }, true)).toEqual(GONE);
    expect(await pickFound(99999, { house: "commons" }, false)).toEqual(GONE);
    expect(await untickAll(99999)).toEqual(GONE);
    expect(await ticked()).toEqual([]);
  });

  it("keeps who the names pasted found, a line each, with the draft, ticking no one; and ticks many at once", async () => {
    const polly = await addTestPolitician();
    const { id } = await draft();
    const back = `/staff/politicians?q=pol&mailing=${id}`;
    // However many lines: the paste isn't in the page's address.
    const many = Array.from({ length: 300 }, (_, i) => `Nobody Number${i}`).join("\n");
    const to = await expectRedirect(() =>
      pasteNames(form({ back, names: `  Polly Placeholder MP \r\n\nNobody Atall\n${many}` })),
    );
    expect(to).toBe(`/staff/politicians?q=pol&mailing=${id}&tab=pasted`);
    expect(await pastedFor(id)).toEqual({
      lines: [
        expect.objectContaining({ line: "Polly Placeholder MP", matches: [expect.objectContaining({ id: polly })] }),
      ],
      skipped: 301,
    });
    expect((await getWrittenMailing(id))!.filter.picked!.ids).toEqual([]);
    // The form is on a list that's choosing for a draft, so one whose list isn't is thrown on: back somewhere that
    // isn't a staff page is the list, with no draft; and so is one without its names.
    for (const back of ["https://example.org", "/staff/politicians?mailing=0", "/staff/politicians?mailing=x"]) {
      await expect(pasteNames(form({ back, names: "x" }))).rejects.toThrow(/without the draft it's for/);
    }
    await expect(pasteNames(form({}))).rejects.toThrow(/without the names/);
    // A draft that's gone since the list loaded: refused, and the list shown afresh.
    revalidatePath.mockClear();
    expect(await pasteNames(form({ back: "/staff/politicians?mailing=999999", names: "x" }))).toEqual(GONE);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/politicians");
    expect(await pickMany(id, [polly], true)).toEqual({ ok: true });
    expect((await getWrittenMailing(id))!.filter.picked!.ids).toEqual([polly]);
    await pickMany(id, [polly], false);
    expect((await getWrittenMailing(id))!.filter.picked!.ids).toEqual([]);
    await expect(pickMany(id, madeUp(polly), true)).rejects.toThrow(/without its politicians/);
    await expect(pickMany(id, [polly, 0], true)).rejects.toThrow(/without its politician/);
    expect(await pickMany(999999, [polly], true)).toEqual(GONE);
  });

  it("leaves out of a draft those a warning names, and shows it afresh; not for a draft that's gone", async () => {
    const [polly, lord] = [
      await addTestPolitician(),
      await addTestPolitician({ name: "Lord Sample", airtableId: "rec2" }),
    ];
    const { id } = await draft();
    await pickMany(id, [polly, lord], true);
    revalidatePath.mockClear();
    expect(await leaveOutOfMailing(id, [lord])).toEqual({ ok: true });
    expect((await getWrittenMailing(id))!.filter.picked!.ids).toEqual([polly]);
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/mailings/${id}`);
    await expect(leaveOutOfMailing(id, madeUp("all"))).rejects.toThrow(/without its politicians/);
    expect(await leaveOutOfMailing(99999, [lord])).toEqual(GONE);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/mailings/99999");
  });

  it("attaches a file and takes it off, saying what's attached; refuses for a draft that's gone, and throws on a form without its file", async () => {
    const { id } = await draft({ subject: "Hi" });
    const file = new File(["%PDF"], "brief.pdf", { type: "application/pdf" });
    const attached = await attachToMailing(withFile(id, 1, file));
    expect(attached).toEqual({
      ok: true,
      version: 2,
      attachments: [expect.objectContaining({ filename: "brief.pdf", size: 4 })],
    });
    const untyped = await attachToMailing(withFile(id, 2, new File(["x"], "notes")));
    expect(untyped).toMatchObject({ ok: true, attachments: [{}, { filename: "notes" }] });
    expect(await query("SELECT content_type FROM mailing_attachments ORDER BY id")).toEqual([
      { content_type: "application/pdf" },
      { content_type: "application/octet-stream" },
    ]);
    // What the page's own form always has: the draft, its version, and a file with a name.
    await expect(attachToMailing(form({ id: String(id), version: "3" }))).rejects.toThrow(/without the file/);
    await expect(attachToMailing(withFile(id, 3, new File(["x"], "")))).rejects.toThrow(/without the file/);
    await expect(attachToMailing(withFile(0, 3, file))).rejects.toThrow(/"id" isn't a row's ID/);
    await expect(attachToMailing(withFile(id, 0, file))).rejects.toThrow(/"version" isn't a row's ID/);
    expect(await attachToMailing(withFile(999, 3, file))).toEqual(GONE);
    expect(await attachToMailing(withFile(id, 1, file))).toEqual({ ok: false, reason: "conflict" });
    const [first] = (attached as { attachments: { id: number }[] }).attachments;
    expect(await detachFromMailing(id, 3, first.id)).toEqual({
      ok: true,
      version: 4,
      attachments: [expect.objectContaining({ filename: "notes" })],
    });
    expect(await detachFromMailing(999, 1, first.id)).toEqual(GONE);
    await expect(detachFromMailing(id, 4, 0)).rejects.toThrow(/without its file/);
    await expect(detachFromMailing(id, 0, first.id)).rejects.toThrow(/without its version/);
  });

  it("sends a test copy of one recipient's email to the staff member; refuses for someone it doesn't go to, a draft that's gone, and an email that couldn't be sent", async () => {
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "server-token");
    let to = "";
    server.use(
      http.post("https://api.postmarkapp.com/email", async ({ request }) => {
        to = ((await request.json()) as { To: string }).To;
        return HttpResponse.json({ MessageID: "m", ErrorCode: 0 });
      }),
    );
    const polly = await addTestPolitician();
    const { id } = await createDraft(
      JO,
      { list: "politicians", params: {}, picked: { ids: [polly] } },
      { subject: "Hi", body: LETTER as MailingChanges["body"] },
    );
    expect(await sendMailingTest(id, polly)).toEqual({ ok: true, to: JO });
    // To the recipient's name, at the staff member's address.
    expect(to).toBe(`"Polly Placeholder" <${JO}>`);
    // To another address given.
    expect(await sendMailingTest(id, polly, " sam@example.org ")).toEqual({ ok: true, to: "sam@example.org" });
    expect(to).toBe('"Polly Placeholder" <sam@example.org>');
    expect(revalidatePath).not.toHaveBeenCalled();
    // The page sends only an address that looks like one, and a politician's and a draft's IDs.
    await expect(sendMailingTest(id, polly, "not an address")).rejects.toThrow(/doesn't look like one/);
    await expect(sendMailingTest(id, 0)).rejects.toThrow(/without its politician/);
    await expect(sendMailingTest(0, polly)).rejects.toThrow(/without its ID/);
    // Someone it no longer goes to, or a draft that's gone: refused, and its page shown afresh.
    expect(await sendMailingTest(id, polly + 1)).toEqual({ ok: false, reason: "not-recipient" });
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/mailings/${id}`);
    expect(await sendMailingTest(999, polly)).toEqual(GONE);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/mailings/999");
    // Postmark refuses it.
    server.use(
      http.post("https://api.postmarkapp.com/email", () =>
        HttpResponse.json({ ErrorCode: 300, Message: "Invalid email request" }, { status: 422 }),
      ),
    );
    expect(await sendMailingTest(id, polly)).toEqual({ ok: false, reason: "not-sent" });
  });

  it("schedules a draft; won't while anything stops it, or once it's changed elsewhere", async () => {
    const polly = await addTestPolitician();
    await connectTestGmail(JO);
    const { id } = await createDraft(JO, { list: "politicians", params: {}, picked: { ids: [polly] } }, {});
    await saveDraft(id, 1, { subject: "Hi" });
    // No letter, sender or time yet, which the page checks too.
    expect(await scheduleMailingNow(id, 2)).toEqual({ ok: false, reason: "problems" });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/mailings");
    await saveDraft(id, 2, {
      body: LETTER as MailingChanges["body"],
      sentFrom: JO,
      dueAt: new Date("2099-01-01T09:00:00Z"),
    });
    expect(await scheduleMailingNow(id, 2)).toEqual({ ok: false, reason: "conflict" });
    await expect(scheduleMailingNow(id, 0)).rejects.toThrow(/without its version/);
    expect(await scheduleMailingNow(id, 3)).toEqual({ ok: true });
    expect((await getWrittenMailing(id))!.state).toBe("scheduled");
    expect(await scheduleMailingNow(id, 4)).toEqual({ ok: false, reason: "not-draft" });
    expect(await scheduleMailingNow(99999, 1)).toEqual(GONE);
  });

  it("deletes a draft and goes to the list, as for one gone already; refuses one scheduled since; throws on a form without its ID", async () => {
    const { id } = await draft({ subject: "Hi" });
    await expect(deleteMailingDraft(form({ id: "x" }))).rejects.toThrow(/isn't a row's ID/);
    expect(await getWrittenMailing(id)).toBeDefined();
    expect(await expectRedirect(() => deleteMailingDraft(form({ id: String(id) })))).toBe("/staff/mailings");
    expect(await getWrittenMailing(id)).toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith("/staff/mailings");
    // Gone already, it's as deleted as was asked.
    expect(await expectRedirect(() => deleteMailingDraft(form({ id: String(id) })))).toBe("/staff/mailings");
    // Scheduled since the page loaded, it isn't deleted, and its page and the list choosing for it are shown afresh.
    const scheduled = await draft({ subject: "Going" });
    await schedule(scheduled.id);
    expect(await deleteMailingDraft(form({ id: String(scheduled.id) }))).toEqual({ ok: false, reason: "not-draft" });
    expect(await getWrittenMailing(scheduled.id)).toBeDefined();
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/mailings/${scheduled.id}`);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/politicians");
  });

  it("changes a scheduled mailing's time, in London's hours, and stops it; refuses a time that has passed, and a mailing no longer scheduled; throws on a form that isn't its own", async () => {
    const { id } = await draft({ subject: "Hi" });
    await saveDraft(id, 1, { sentFrom: JO, fromName: "Jo", dueAt: new Date("2099-01-01T09:00:00Z") });
    await query("UPDATE mailings SET state = 'scheduled' WHERE id = $1", [id]);
    const time = { day: "2099-07-01", hour: "10", minute: "3" };
    await expect(rescheduleMailingNow(form({ id: "x", ...time }))).rejects.toThrow(/isn't a row's ID/);
    for (const bad of [
      { day: "soon", hour: "9", minute: "3" },
      { day: "2099-07-01", hour: "24", minute: "3" },
    ]) {
      await expect(rescheduleMailingNow(form({ id: String(id), ...bad }))).rejects.toThrow(/none the form offers/);
    }
    // A time the form offered, which passed while it was open.
    expect(await rescheduleMailingNow(form({ id: String(id), ...time, day: "2020-07-01" }))).toEqual({
      ok: false,
      reason: "too-soon",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect((await getWrittenMailing(id))!.dueAt).toEqual(new Date("2099-01-01T09:00:00Z"));
    expect(await rescheduleMailingNow(form({ id: String(id), ...time }))).toEqual({ ok: true });
    expect((await getWrittenMailing(id))!.dueAt).toEqual(new Date("2099-07-01T09:03:00Z"));
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/mailings/${id}`);

    await expect(stopMailingNow(form({ id: "x" }))).rejects.toThrow(/isn't a row's ID/);
    expect((await getWrittenMailing(id))!.state).toBe("scheduled");
    expect(await stopMailingNow(form({ id: String(id) }))).toEqual({ ok: true });
    expect((await getWrittenMailing(id))!.state).toBe("draft");
    // A draft again, as someone else's Unschedule would leave it: there's nothing to stop, or to change the time of.
    revalidatePath.mockClear();
    expect(await stopMailingNow(form({ id: String(id) }))).toEqual(GONE);
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/mailings/${id}`);
    revalidatePath.mockClear();
    expect(await rescheduleMailingNow(form({ id: String(id), ...time }))).toEqual(GONE);
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/mailings/${id}`);
  });

  it("turns away a message to supporters, whose own actions ask for the permission", async () => {
    requestCookies.set("staff_session", await createSession(JO));
    const id = (await createBroadcastDraft(JO, { contact: "email:newsletter:yes" }))!;
    await expect(saveMailing(id, 1, { subject: "Mine" })).rejects.toThrow();
    expect((await getWrittenBroadcast(id))!.subject).toBe("");
  });

  /** Polly's reply, to a letter in the Edinburgh mailing from the policy team's mailbox: its ID. */
  async function pollyReplied(): Promise<number> {
    vi.stubEnv("POLICY_INBOX", "policy@pauseai.uk");
    const polly = await addTestPolitician();
    const [{ letter }] = await query<{ letter: number }>(
      "INSERT INTO letters (kind, notable_person_id, status, sent_at) VALUES ('pauseai', $1, 'sent', now()) RETURNING id::int AS letter",
      [polly],
    );
    await query(
      `INSERT INTO letters_from_pauseai (id, mailing_id)
       SELECT $1, id FROM mailings WHERE title = 'Edinburgh Conference Nov 26 Invitation'`,
      [letter],
    );
    const [{ reply }] = await query<{ reply: number }>(
      `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, from_address, subject, at,
         from_us, blob_key, size)
       VALUES ($1, 'policy@pauseai.uk', 'g1', 't1', 'polly@parliament.uk', 'Re', now(), false, 'k', 1)
       RETURNING id::int AS reply`,
      [letter],
    );
    return reply;
  }

  it("marks a politician's reply as needing nothing, showing the pages afresh; refuses one dealt with already; throws on a form without its reply", async () => {
    const reply = await pollyReplied();
    await expect(nothingToDoNow(form({}))).rejects.toThrow(/"replyId" isn't a row's ID/);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await nothingToDoNow(form({ replyId: String(reply) }))).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/mailings", "layout");
    expect(await query("SELECT dealt_by FROM letter_replies")).toEqual([{ dealt_by: JO }]);
    // Marked already, as by someone else since the page loaded: refused, and the pages shown afresh.
    revalidatePath.mockClear();
    expect(await nothingToDoNow(form({ replyId: String(reply) }))).toEqual(GONE);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/mailings", "layout");
  });

  it("sends an answer to a politician's reply, showing the pages afresh once it's gone; says why one didn't go; throws on a reply or draft it can't name", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await connectTestGmail("policy@pauseai.uk");
    const reply = await pollyReplied();
    server.use(
      http.post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", () =>
        HttpResponse.json({ id: "g-answer", threadId: "t1" }),
      ),
      // Gmail not giving it back leaves it sent all the same.
      http.get("https://gmail.googleapis.com/gmail/v1/users/me/messages/g-answer", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    const DRAFT = "6f1c2a0e-5b7d-4c1e-9a3f-2d8e4b6c0a11";
    await expect(answerLetterReplyNow(reply, "not-a-uuid", LETTER)).rejects.toThrow(/without its draft's ID/);
    await expect(answerLetterReplyNow(1.5, DRAFT, LETTER)).rejects.toThrow(/without its reply/);
    expect(await answerLetterReplyNow(reply, DRAFT, { type: "doc", content: [] })).toEqual({
      ok: false,
      reason: "blank",
    });
    // A reply that's gone leaves the page as it is, with what was typed.
    expect(await answerLetterReplyNow(reply + 1, DRAFT, LETTER)).toEqual(GONE);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await answerLetterReplyNow(reply, DRAFT, LETTER)).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/mailings", "layout");
    expect(await query("SELECT sent_by FROM letter_answers")).toEqual([{ sent_by: JO }]);
  });

  describe("writing a campaign's letter", () => {
    const BILL = "support-sobel-bill";
    beforeEach(() => query("UPDATE staff_accounts SET permissions = ARRAY['supporters'] WHERE email = $1", [JO]));

    it("asks for the supporters permission", async () => {
      const { id } = await openDraft(BILL, JO, "Dear");
      await query("UPDATE staff_accounts SET permissions = '{}' WHERE email = $1", [JO]);
      for (const attempt of [
        () => saveCampaignLetter(id, 1, { subject: "x" }),
        () => publishCampaignLetter(BILL, id, 1),
        () => discardCampaignLetter(BILL, form({ id: String(id) })),
      ]) {
        expect(await expectRedirect(attempt)).toBe("/staff");
      }
      expect((await campaignDraft(BILL))!.version).toBe(1);
    });

    it("saves the draft's changes by whom; refuses one saved since; throws on what isn't a change, an ID or a version", async () => {
      const { id } = await openDraft(BILL, "sam@pauseai.uk", "Dear");
      expect(await saveCampaignLetter(id, 1, { subject: "Come", body: LETTER })).toEqual({ ok: true, version: 2 });
      expect(await campaignDraft(BILL)).toMatchObject({ subject: "Come", body: LETTER, updatedBy: JO });
      expect(await saveCampaignLetter(id, 1, { subject: "Old" })).toEqual({ ok: false, reason: "conflict" });
      await expect(saveCampaignLetter(id, 2, { dueAt: null })).rejects.toThrow();
      await expect(saveCampaignLetter(madeUp(String(id)), 2, { subject: "x" })).rejects.toThrow();
      await expect(saveCampaignLetter(id, 0, { subject: "x" })).rejects.toThrow();
    });

    it("publishes the draft and goes to the campaign's page; refuses one changed since or with no subject; throws on a campaign not in the code", async () => {
      const { id } = await openDraft(BILL, JO, "Dear");
      expect(await publishCampaignLetter(BILL, id, 2)).toEqual({ ok: false, reason: "conflict" });
      await saveCampaignLetter(id, 1, { subject: "" });
      expect(await publishCampaignLetter(BILL, id, 2)).toEqual({ ok: false, reason: "no-subject" });
      await saveCampaignLetter(id, 2, { subject: "Come" });
      await expect(publishCampaignLetter("pauseai-info-liability", id, 3)).rejects.toThrow();
      expect(await expectRedirect(() => publishCampaignLetter(BILL, id, 3))).toBe(`/staff/campaigns/${BILL}`);
      expect(revalidatePath).toHaveBeenCalledWith(`/staff/campaigns/${BILL}`);
      expect(await publishedLetter(BILL)).toMatchObject({ id, subject: "Come" });
    });

    it("discards the draft and goes to the campaign's page, as for one gone already; throws on a form without its ID", async () => {
      const { id } = await openDraft(BILL, JO, "Dear");
      expect(await expectRedirect(() => discardCampaignLetter(BILL, form({ id: String(id) })))).toBe(
        `/staff/campaigns/${BILL}`,
      );
      expect(await campaignDraft(BILL)).toBeUndefined();
      expect(await expectRedirect(() => discardCampaignLetter(BILL, form({ id: String(id) })))).toBe(
        `/staff/campaigns/${BILL}`,
      );
      await expect(discardCampaignLetter(BILL, form({}))).rejects.toThrow();
      await expect(discardCampaignLetter(madeUp(5), form({ id: String(id) }))).rejects.toThrow();
    });
  });
});

/** The form that attaches `file` to draft `id` at `version`. */
function withFile(id: number, version: number, file: File) {
  const data = new FormData();
  data.set("id", String(id));
  data.set("version", String(version));
  data.set("file", file);
  return data;
}
