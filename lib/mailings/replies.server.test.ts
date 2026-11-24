import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import {
  addTestLetter,
  addTestPolitician,
  connectTestGmail,
  describeWithDatabase,
  refuseWrites,
  useTestDatabase,
} from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { stubBlobsEnv } from "@/tests/gmail-sends";
import { query } from "@/lib/server/db.server";
import { threadMessages } from "@/lib/letters/threads.server";
import { answerLetterReply, canAnswerFrom, markNothingToDo, replyWaiting } from "./replies.server";
import { mailingProblems } from "./copy";

const POLICY = "policy@pauseai.uk";
const JO = "jo@pauseai.uk";
const SAM = "sam@pauseai.uk";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const DRAFT = "6f1c2a0e-5b7d-4c1e-9a3f-2d8e4b6c0a11";
const words = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

/**
 * Polly's letter in the Edinburgh mailing, sent from `account` as PauseAI UK
 * with Message-ID letter-1@pauseai.uk, and her reply to it there, in Gmail
 * thread t-1: the letter's and the reply's IDs.
 */
async function replied(account = POLICY): Promise<{ letter: number; reply: number }> {
  const polly = await addTestPolitician();
  const [{ id: letter }] = await query<{ id: number }>(
    `INSERT INTO letters (kind, notable_person_id, status, sent_at, replied_at)
     VALUES ('pauseai', $1, 'sent', '2026-10-01', '2026-10-02') RETURNING id::int AS id`,
    [polly],
  );
  await query(
    `UPDATE mailings SET sent_from = $1, from_name = 'PauseAI UK' WHERE title = 'Edinburgh Conference Nov 26 Invitation'`,
    [account],
  );
  await query(
    `INSERT INTO letters_from_pauseai (id, mailing_id)
     SELECT $1, id FROM mailings WHERE title = 'Edinburgh Conference Nov 26 Invitation'`,
    [letter],
  );
  await query(
    `INSERT INTO email_sends (purpose, letter_id, address, outcome, backend, sender, rfc_message_id, message_id)
     VALUES ('mailing', $1, 'polly.placeholder.mp@parliament.uk', 'sent', 'gmail', $2, 'letter-1@pauseai.uk', 'g-letter')`,
    [letter, account],
  );
  const [{ id: reply }] = await query<{ id: number }>(
    `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, rfc_message_id, from_address,
       from_name, subject, at, from_us, blob_key, size)
     VALUES ($1, $2, 'g-reply', 't-1', 'reply-1@parliament.uk', 'polly.placeholder.mp@parliament.uk',
       'Polly Placeholder', 'Re: Edinburgh', '2026-10-02', false, 'k-reply', 1)
     RETURNING id::int AS id`,
    [letter, account],
  );
  return { letter, reply };
}

/** Gmail taking each send as g-answer, in the reply's thread, then giving it back as sent: what each send asked for. */
function gmailTakes(): { raw: string; threadId?: string }[] {
  const sends: { raw: string; threadId?: string }[] = [];
  server.use(
    http.post(`${GMAIL}/send`, async ({ request }) => {
      const body = (await request.json()) as { raw: string; threadId?: string };
      sends.push({ raw: Buffer.from(body.raw, "base64url").toString(), threadId: body.threadId });
      return HttpResponse.json({ id: "g-answer", threadId: body.threadId });
    }),
    http.get(`${GMAIL}/g-answer`, ({ request }) =>
      new URL(request.url).searchParams.get("format") === "raw"
        ? HttpResponse.json({ raw: Buffer.from(sends.at(-1)!.raw, "latin1").toString("base64url") })
        : HttpResponse.json({
            id: "g-answer",
            threadId: "t-1",
            internalDate: String(Date.parse("2026-10-03T09:00:00Z")),
            payload: {
              headers: [
                { name: "From", value: `PauseAI UK <${POLICY}>` },
                { name: "Subject", value: "Re: Edinburgh" },
                { name: "Message-ID", value: "<answer-1@mail.gmail.com>" },
              ],
            },
          }),
    ),
  );
  return sends;
}

describeWithDatabase("replies to mailings", () => {
  useTestDatabase();

  beforeEach(() => {
    stubBlobsEnv();
    vi.stubEnv("POLICY_INBOX", POLICY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("can be answered from the policy team's mailbox by anyone, and from a person's own only by them", () => {
    expect(canAnswerFrom(POLICY, SAM)).toBe(true);
    expect(canAnswerFrom("Jo@PauseAI.uk", JO)).toBe(true);
    expect(canAnswerFrom(JO, SAM)).toBe(false);
    vi.stubEnv("POLICY_INBOX", "");
    expect(canAnswerFrom(POLICY, SAM)).toBe(false);
  });

  it("wait under their latest, with the mailbox it came to, until something deals with them", async () => {
    const { letter, reply } = await replied(JO);
    expect(await replyWaiting(letter, JO)).toEqual({ waiting: { id: reply, account: JO }, canAnswer: true });
    expect(await replyWaiting(letter, SAM)).toEqual({ waiting: { id: reply, account: JO }, canAnswer: false });
    expect(await markNothingToDo(reply, SAM)).toBe(true);
    expect(await replyWaiting(letter, JO)).toEqual({ waiting: null, canAnswer: false });
  });

  it("are marked as needing nothing once, by whom and when, never ours or a supporter's letter's", async () => {
    const { letter, reply } = await replied();
    expect(await markNothingToDo(reply, "Sam@PauseAI.uk")).toBe(true);
    expect(await markNothingToDo(reply, JO)).toBe(false);
    expect(await query("SELECT dealt_by, dealt_at IS NOT NULL AS dealt FROM letter_replies")).toEqual([
      { dealt_by: SAM, dealt: true },
    ]);
    expect(await query("SELECT actor, details FROM audit_log WHERE action = 'nothing to do on letter reply'")).toEqual([
      { actor: "Sam@PauseAI.uk", details: { replyId: reply, letterId: letter } },
    ]);
    // Ours, or on a supporter's letter.
    await query("UPDATE letter_replies SET dealt_by = NULL, dealt_at = NULL, from_us = true");
    expect(await markNothingToDo(reply, SAM)).toBe(false);
    const theirs = await addTestLetter({ politicianId: await addTestPolitician({ airtableId: "recOther" }) });
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO letter_replies (letter_id, account, from_address, at, from_us, blob_key, size)
       VALUES ($1, $2, 'office@parliament.uk', now(), false, 'k-other', 1) RETURNING id::int AS id`,
      [theirs, POLICY],
    );
    expect(await markNothingToDo(id, SAM)).toBe(false);
  });

  it("go by Gmail from the mailbox the reply came to, as the mailing's name, in its thread, and are kept on the letter", async () => {
    await connectTestGmail(POLICY);
    const sends = gmailTakes();
    const { letter, reply } = await replied();
    expect(await answerLetterReply(reply, DRAFT, words("Thank you, Polly."), SAM)).toEqual({ sent: true });
    expect(sends).toHaveLength(1);
    expect(sends[0].threadId).toBe("t-1");
    expect(sends[0].raw).toContain(`From: PauseAI UK <${POLICY}>`);
    expect(sends[0].raw).toContain("To: Polly Placeholder <polly.placeholder.mp@parliament.uk>");
    expect(sends[0].raw).toContain("Subject: Re: Edinburgh");
    expect(sends[0].raw).toContain("In-Reply-To: <reply-1@parliament.uk>");
    expect(sends[0].raw).toContain("References: <letter-1@pauseai.uk> <reply-1@parliament.uk>");
    expect(await query("SELECT purpose, sender FROM email_sends WHERE purpose = 'mailing-answer'")).toEqual([
      { purpose: "mailing-answer", sender: POLICY },
    ]);
    // Kept on the letter as ours, saying who sent it, which deals with the reply.
    const messages = await threadMessages(letter);
    expect(messages.map((m) => [m.fromUs, m.sentBy, m.text])).toEqual([
      [false, null, null],
      [true, SAM, "Thank you, Polly."],
    ]);
    expect(await replyWaiting(letter, SAM)).toEqual({ waiting: null, canAnswer: false });
    expect(await query("SELECT details FROM audit_log WHERE action = 'answer letter reply'")).toEqual([
      { details: { replyId: reply, letterId: letter, answerId: expect.any(Number) } },
    ]);
    // Once for each draft, however often Send is pressed.
    expect(await answerLetterReply(reply, DRAFT, words("Thank you, Polly."), SAM)).toEqual({ sent: true });
    expect(sends).toHaveLength(1);
  });

  it("go in the Gmail's name with no From name of the mailing's, and name what they can with no Message-IDs", async () => {
    await connectTestGmail(POLICY);
    await query("UPDATE staff_accounts SET gmail_name = 'PauseAI Policy' WHERE email = $1", [POLICY]);
    const sends = gmailTakes();
    const { reply } = await replied();
    await query("UPDATE mailings SET from_name = ''");
    await query("UPDATE letter_replies SET rfc_message_id = NULL, from_name = ''");
    await query("UPDATE email_sends SET rfc_message_id = NULL");
    await answerLetterReply(reply, DRAFT, words("Hi"), SAM);
    expect(sends[0].raw).toContain(`From: PauseAI Policy <${POLICY}>`);
    expect(sends[0].raw).toContain("To: polly.placeholder.mp@parliament.uk");
    expect(sends[0].raw).not.toContain("In-Reply-To");
  });

  it("aren't sent without words, to a reply that's gone or ours, or from someone else's mailbox", async () => {
    await connectTestGmail(JO);
    const { reply } = await replied(JO);
    expect(await answerLetterReply(reply, DRAFT, words("  "), JO)).toEqual({ sent: false, reason: "blank" });
    expect(await answerLetterReply(reply, DRAFT, { type: "nonsense" }, JO)).toEqual({ sent: false, reason: "blank" });
    expect(await answerLetterReply(reply + 1, DRAFT, words("Hi"), JO)).toEqual({ sent: false, reason: "gone" });
    expect(await answerLetterReply(reply, DRAFT, words("Hi"), SAM)).toEqual({ sent: false, reason: "gone" });
    await query("UPDATE letter_replies SET from_us = true");
    expect(await answerLetterReply(reply, DRAFT, words("Hi"), JO)).toEqual({ sent: false, reason: "gone" });
    expect(await query("SELECT * FROM letter_answers")).toEqual([]);
  });

  it("are forgotten when they don't go, and kept as sent when keeping them on the letter fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await connectTestGmail(POLICY);
    const { letter, reply } = await replied();
    // Gmail refusing it: forgotten, so it can be sent again, and the reply still waits.
    server.use(http.post(`${GMAIL}/send`, () => HttpResponse.json({ error: { message: "no" } }, { status: 500 })));
    expect(await answerLetterReply(reply, DRAFT, words("Hi"), SAM)).toEqual({ sent: false, reason: "failed" });
    expect(await query("SELECT * FROM letter_answers")).toEqual([]);
    // And then logging that failing, so the send throws: forgotten too.
    await refuseWrites("email_sends", "NEW.outcome = 'failed'", "INSERT");
    expect(await answerLetterReply(reply, DRAFT, words("Hi"), SAM)).toEqual({ sent: false, reason: "failed" });
    expect(await query("SELECT * FROM letter_answers")).toEqual([]);
    expect(error.mock.calls.map(([what]) => what)).toContain(mailingProblems.answerNotSentYet({ reply }).what);
    // It goes, but Gmail won't give it back to keep: sent, the reply still waiting, and staff told.
    gmailTakes();
    server.use(http.get(`${GMAIL}/g-answer`, () => HttpResponse.json({ error: { message: "no" } }, { status: 500 })));
    expect(await answerLetterReply(reply, DRAFT, words("Hi"), SAM)).toEqual({ sent: true });
    expect(await query("SELECT kept_id FROM letter_answers")).toEqual([{ kept_id: null }]);
    expect((await replyWaiting(letter, SAM)).waiting).not.toBeNull();
    expect(error.mock.calls.map(([what]) => what)).toContain(mailingProblems.answerSentUnrecorded({ reply }).what);
  });
});
