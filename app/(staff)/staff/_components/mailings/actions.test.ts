import { afterEach, beforeEach, expect, it, vi } from "vitest";
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
} from "./actions";

vi.mock("next/headers", () => import("@/tests/next-headers"));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const JO = "jo@pauseai.uk";
const LETTER = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };

/** A draft by Jo, with no one ticked, and its first changes. */
const draft = (changes: MailingChanges = {}) =>
  createDraft(JO, { list: "politicians", params: {}, picked: { ids: [] } }, changes);

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

  it("copies a mailing to a new draft and opens it, and nothing for a form that names none", async () => {
    const { id } = await draft({ subject: "Hello", body: LETTER as MailingChanges["body"] });
    const to = await expectRedirect(() => copyMailingNow(form({ id: String(id) })));
    const copy = Number(to.match(/^\/staff\/mailings\/(\d+)$/)![1]);
    expect(copy).not.toBe(id);
    expect(await getWrittenMailing(copy)).toMatchObject({ subject: "Hello", body: LETTER, createdBy: JO });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/mailings");
    await copyMailingNow(form({ id: "x" }));
    await copyMailingNow(form({ id: "99999" }));
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

  it("saves a draft's changes, and refuses what isn't a change", async () => {
    const { id } = await draft({ subject: "Hi", body: LETTER as MailingChanges["body"] });
    expect(await saveMailing(id, 1, { sentFrom: "Jo@PauseAI.uk", dueAt: new Date("2026-12-01T09:00:00Z") })).toEqual({
      saved: true,
      version: 2,
    });
    expect(await getWrittenMailing(id)).toMatchObject({ sentFrom: JO, dueAt: new Date("2026-12-01T09:00:00Z") });
    expect(await saveMailing(id, 2, { subject: 3 })).toBeUndefined();
    expect(await saveMailing(id, 2, { filter: { list: "politicians", params: {} } })).toBeUndefined();
  });

  it("ticks and unticks a politician, and everyone the list's filter finds", async () => {
    const polly = await addTestPolitician();
    const lord = await addTestPolitician({ name: "Lord Sample", airtableId: "rec2", house: "lords" });
    const { id } = await draft();
    const ticked = async () => (await getWrittenMailing(id))!.filter.picked!.ids;
    await pickPolitician(id, lord, true);
    expect(await ticked()).toEqual([lord]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/politicians");
    await pickFound(id, { house: "commons" }, true);
    expect(await ticked()).toEqual([lord, polly]);
    await pickPolitician(id, lord, false);
    expect(await ticked()).toEqual([polly]);
    await pickFound(id, { house: "commons" }, false);
    expect(await ticked()).toEqual([]);
    // Everyone unticked, and the group they were ticked from forgotten, to start again.
    await pickFound(id, { house: "commons" }, true);
    await untickAll(id);
    expect((await getWrittenMailing(id))!.filter.picked).toEqual({ ids: [] });
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
    // Back somewhere that isn't a staff page goes to the list, and with no draft there, there's nothing to keep.
    expect(await expectRedirect(() => pasteNames(form({ back: "https://example.org", names: "x" })))).toBe(
      "/staff/politicians",
    );
    expect(await expectRedirect(() => pasteNames(form({ back: "/staff/politicians?mailing=0", names: "x" })))).toBe(
      "/staff/politicians?mailing=0",
    );
    expect(
      await expectRedirect(() => pasteNames(form({ back: "/staff/politicians?mailing=999999", names: "x" }))),
    ).toBe("/staff/politicians?mailing=999999");
    // No names, nowhere.
    await pasteNames(form({}));
    await pickMany(id, [polly], true);
    expect((await getWrittenMailing(id))!.filter.picked!.ids).toEqual([polly]);
    await pickMany(id, [polly], false);
    expect((await getWrittenMailing(id))!.filter.picked!.ids).toEqual([]);
  });

  it("leaves out of a draft those a warning names, and shows it afresh", async () => {
    const [polly, lord] = [
      await addTestPolitician(),
      await addTestPolitician({ name: "Lord Sample", airtableId: "rec2" }),
    ];
    const { id } = await draft();
    await pickMany(id, [polly, lord], true);
    revalidatePath.mockClear();
    await leaveOutOfMailing(id, [lord]);
    expect((await getWrittenMailing(id))!.filter.picked!.ids).toEqual([polly]);
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/mailings/${id}`);
  });

  it("attaches a file and takes it off, saying what's attached", async () => {
    const { id } = await draft({ subject: "Hi" });
    const file = new File(["%PDF"], "brief.pdf", { type: "application/pdf" });
    const attached = await attachToMailing(withFile(id, 1, file));
    expect(attached).toMatchObject({ saved: true, version: 2, attachments: [{ filename: "brief.pdf", size: 4 }] });
    const untyped = await attachToMailing(withFile(id, 2, new File(["x"], "notes")));
    expect(untyped).toMatchObject({ saved: true, attachments: [{}, { filename: "notes" }] });
    expect(await query("SELECT content_type FROM mailing_attachments ORDER BY id")).toEqual([
      { content_type: "application/pdf" },
      { content_type: "application/octet-stream" },
    ]);
    // No file, or no draft to say.
    expect(await attachToMailing(form({ id: String(id), version: "3" }))).toBeUndefined();
    expect(await attachToMailing(withFile(0, 3, file))).toBeUndefined();
    expect(await attachToMailing(withFile(999, 3, file))).toMatchObject({ saved: false, attachments: [] });
    const [first] = attached!.attachments;
    expect(await detachFromMailing(id, 3, first.id)).toMatchObject({
      saved: true,
      attachments: [{ filename: "notes" }],
    });
    expect(await detachFromMailing(999, 1, first.id)).toMatchObject({ saved: false, attachments: [] });
  });

  it("sends a test copy of one recipient's email to the staff member, and none to someone it doesn't go to", async () => {
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
    expect(await sendMailingTest(id, polly)).toMatchObject({ sent: true, id: "m", to: JO });
    // To the recipient's name, at the staff member's address.
    expect(to).toBe(`"Polly Placeholder" <${JO}>`);
    // To another address given; nothing to one that isn't one.
    expect(await sendMailingTest(id, polly, " sam@example.org ")).toMatchObject({ sent: true, to: "sam@example.org" });
    expect(to).toBe('"Polly Placeholder" <sam@example.org>');
    expect(await sendMailingTest(id, polly, "not an address")).toBeUndefined();
    expect(await sendMailingTest(id, polly + 1)).toBeUndefined();
    expect(await sendMailingTest(999, polly)).toBeUndefined();
  });

  it("won't schedule while anything stops it, and says why", async () => {
    const { id } = await draft({ subject: "Hi" });
    expect(await scheduleMailingNow(id, 1)).toMatchObject({
      scheduled: false,
      problems: expect.arrayContaining(["no-sender", "no-letter"]),
    });
  });

  it("deletes a draft and goes to the list; a bad form only goes to the list", async () => {
    const { id } = await draft({ subject: "Hi" });
    expect(await expectRedirect(() => deleteMailingDraft(form({ id: "x" })))).toBe("/staff/mailings");
    expect(await getWrittenMailing(id)).toBeDefined();
    expect(await expectRedirect(() => deleteMailingDraft(form({ id: String(id) })))).toBe("/staff/mailings");
    expect(await getWrittenMailing(id)).toBeUndefined();
  });

  it("stops a scheduled mailing and changes its time, in London's hours; a bad form changes nothing", async () => {
    const { id } = await draft({ subject: "Hi" });
    await saveDraft(id, 1, { sentFrom: JO, fromName: "Jo", dueAt: new Date("2099-01-01T09:00:00Z") });
    await query("UPDATE mailings SET state = 'scheduled' WHERE id = $1", [id]);
    for (const bad of [
      { id: "x" },
      { id: String(id), day: "soon", hour: "9", minute: "3" },
      { id: String(id), day: "2099-07-01", hour: "24", minute: "3" },
    ] as Record<string, string>[]) {
      await rescheduleMailingNow(form(bad));
    }
    expect((await getWrittenMailing(id))!.dueAt).toEqual(new Date("2099-01-01T09:00:00Z"));
    await rescheduleMailingNow(form({ id: String(id), day: "2099-07-01", hour: "10", minute: "3" }));
    expect((await getWrittenMailing(id))!.dueAt).toEqual(new Date("2099-07-01T09:03:00Z"));
    expect(revalidatePath).toHaveBeenCalledWith(`/staff/mailings/${id}`);

    await stopMailingNow(form({ id: "x" }));
    expect((await getWrittenMailing(id))!.state).toBe("scheduled");
    await stopMailingNow(form({ id: String(id) }));
    expect((await getWrittenMailing(id))!.state).toBe("draft");
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

  it("marks a politician's reply as needing nothing, showing the pages afresh, and nothing for one it can't name", async () => {
    const reply = await pollyReplied();
    await nothingToDoNow(form({}));
    expect(revalidatePath).not.toHaveBeenCalled();
    await nothingToDoNow(form({ replyId: String(reply) }));
    expect(revalidatePath).toHaveBeenCalledWith("/staff/mailings", "layout");
    expect(await query("SELECT dealt_by FROM letter_replies")).toEqual([{ dealt_by: JO }]);
    // Marked already.
    revalidatePath.mockClear();
    await nothingToDoNow(form({ replyId: String(reply) }));
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sends an answer to a politician's reply, showing the pages afresh once it's gone, and nothing for a reply or draft it can't name", async () => {
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
    expect(await answerLetterReplyNow(reply, "not-a-uuid", LETTER)).toEqual({ sent: false, reason: "gone" });
    expect(await answerLetterReplyNow(1.5, DRAFT, LETTER)).toEqual({ sent: false, reason: "gone" });
    expect(await answerLetterReplyNow(reply, DRAFT, { type: "doc", content: [] })).toEqual({
      sent: false,
      reason: "blank",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await answerLetterReplyNow(reply, DRAFT, LETTER)).toEqual({ sent: true });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/mailings", "layout");
    expect(await query("SELECT sent_by FROM letter_answers")).toEqual([{ sent_by: JO }]);
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
