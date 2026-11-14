import { afterEach, expect, it, vi } from "vitest";
import { staffCopy } from "@/lib/content/staff-interface";
import { http, HttpResponse } from "msw";
import { connectTestGmail, describeWithDatabase, refuseWrites, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { query } from "./db.server";
import { answerReply, answersTo } from "./broadcast-answers.server";
import { recordProblem } from "./email.server";

const HELLO = "hello@pauseai.uk";
const JO = "jo@pauseai.uk";
const SEND = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const DRAFT = "6f1c2a0e-5b7d-4c1e-9a3f-2d8e4b6c0a11";
const words = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const textOf = words;

/** A copy of a broadcast from PauseAI UK at hello@, and Jane's reply to it, with the Message-IDs given; the copy's and reply's IDs. */
async function replied({
  copyMessageId = "copy-1@pauseai.uk" as string | null,
  replyMessageId = "reply-1@mail.example.com" as string | null,
  automatic = false,
} = {}): Promise<{ copy: number; reply: number }> {
  const [{ id: mailing }] = await query<{ id: number }>(
    `INSERT INTO mailings (title, subject, audience, channel, topic, filter, body, created_by, sent_from, from_name, due_at,
       state)
     VALUES ('News', 'News', 'supporters', 'email', 'newsletter', '{"list": "supporters", "params": {}}',
       '{"type": "doc", "content": []}', $1, $2, 'PauseAI UK', now(), 'sent')
     RETURNING id::int AS id`,
    [JO, HELLO],
  );
  const [{ id: copy }] = await query<{ id: number }>(
    `WITH s AS (INSERT INTO supporters DEFAULT VALUES RETURNING id)
     INSERT INTO broadcast_messages (mailing_id, supporter_id, status, rfc_message_id, topics, address)
     SELECT $1, s.id, 'sent', $2, '{newsletter}', 'jane@example.com' FROM s RETURNING id::int AS id`,
    [mailing, copyMessageId],
  );
  const [{ id: reply }] = await query<{ id: number }>(
    `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, account, gmail_message_id,
       gmail_thread_id, rfc_message_id, blob_key, automatic)
     VALUES ($1, now(), 'jane@example.com', 'Re: News', $2, 'g-reply', 't-reply', $3, 'k', $4) RETURNING id::int AS id`,
    [copy, HELLO, replyMessageId, automatic],
  );
  return { copy, reply };
}

/** Gmail taking each send, as g-answer in the reply's thread: what each send asked for. */
function gmailTakes(): { raw: string; threadId?: string }[] {
  const sends: { raw: string; threadId?: string }[] = [];
  server.use(
    http.post(SEND, async ({ request }) => {
      const body = (await request.json()) as { raw: string; threadId?: string };
      sends.push({ raw: Buffer.from(body.raw, "base64url").toString(), threadId: body.threadId });
      return HttpResponse.json({ id: "g-answer", threadId: body.threadId });
    }),
  );
  return sends;
}

describeWithDatabase("answers to replies", () => {
  useTestDatabase();

  it("go by Gmail from the mailbox the reply came to, in its thread, naming our email and the reply", async () => {
    await connectTestGmail(HELLO);
    const sends = gmailTakes();
    const { copy, reply } = await replied();
    await query(`UPDATE broadcast_messages SET merge_values = '{"name": "Jane Smith"}'`);
    expect(await answerReply(reply, DRAFT, words("Thanks, Jane."), "Jo@PauseAI.uk")).toEqual({ sent: true });
    expect(sends).toHaveLength(1);
    expect(sends[0].threadId).toBe("t-reply");
    expect(sends[0].raw).toContain("From: PauseAI UK <hello@pauseai.uk>");
    // To them by name, as their copy had it.
    expect(sends[0].raw).toContain("To: Jane Smith <jane@example.com>");
    expect(sends[0].raw).toContain("Subject: Re: News");
    expect(sends[0].raw).toContain("In-Reply-To: <reply-1@mail.example.com>");
    expect(sends[0].raw).toContain("References: <copy-1@pauseai.uk> <reply-1@mail.example.com>");
    expect(await query("SELECT purpose, sender, address FROM email_sends")).toEqual([
      { purpose: "broadcast-answer", sender: HELLO, address: "jane@example.com" },
    ]);
    // Sent, it settles the reply, and is shown in the thread.
    expect(await query("SELECT outcome, dealt_by FROM broadcast_replies")).toEqual([
      { outcome: "answered", dealt_by: JO },
    ]);
    expect(await answersTo(copy)).toEqual([
      { id: expect.any(Number), replyId: reply, sentBy: JO, sentAt: expect.any(Date), body: words("Thanks, Jane.") },
    ]);
    expect(await query("SELECT gmail_message_id, rfc_message_id IS NOT NULL AS named FROM broadcast_answers")).toEqual([
      { gmail_message_id: "g-answer", named: true },
    ]);
    expect(await query("SELECT details FROM audit_log WHERE action = 'answer reply'")).toEqual([
      { details: { replyId: reply, answerId: expect.any(Number) } },
    ]);
  });

  it("go once for each draft, however often Send is pressed", async () => {
    await connectTestGmail(HELLO);
    const sends = gmailTakes();
    const { reply } = await replied();
    expect(await answerReply(reply, DRAFT, words("Hi"), JO)).toEqual({ sent: true });
    expect(await answerReply(reply, DRAFT, words("Hi"), JO)).toEqual({ sent: true });
    expect(sends).toHaveLength(1);
  });

  it("name what they can when the copy or the reply had no Message-ID, and nothing when neither had", async () => {
    await connectTestGmail(HELLO);
    const sends = gmailTakes();
    const { reply } = await replied({ replyMessageId: null });
    await answerReply(reply, DRAFT, words("Hi"), JO);
    expect(sends[0].raw).toContain("In-Reply-To: <copy-1@pauseai.uk>");
    expect(sends[0].raw).toContain("References: <copy-1@pauseai.uk>\r\n");
    await query("DELETE FROM mailings");
    const bare = await replied({ copyMessageId: null, replyMessageId: null });
    await answerReply(bare.reply, "7f1c2a0e-5b7d-4c1e-9a3f-2d8e4b6c0a11", words("Hi"), JO);
    expect(sends[1].raw).not.toContain("In-Reply-To");
    expect(sends[1].raw).not.toContain("References");
  });

  it("leave a reply recorded as an opt-out as one, and settle one said to need nothing", async () => {
    await connectTestGmail(HELLO);
    gmailTakes();
    const { reply } = await replied();
    await query("UPDATE broadcast_replies SET outcome = 'opted-out', dealt_by = $1, dealt_at = now()", [JO]);
    await answerReply(reply, DRAFT, words("Done."), "sam@pauseai.uk");
    expect(await query("SELECT outcome, dealt_by FROM broadcast_replies")).toEqual([
      { outcome: "opted-out", dealt_by: JO },
    ]);
    await query("UPDATE broadcast_replies SET outcome = 'nothing'");
    await answerReply(reply, "7f1c2a0e-5b7d-4c1e-9a3f-2d8e4b6c0a11", words("And again."), "sam@pauseai.uk");
    expect(await query("SELECT outcome, dealt_by FROM broadcast_replies")).toEqual([
      { outcome: "answered", dealt_by: "sam@pauseai.uk" },
    ]);
  });

  it("are forgotten when something goes wrong before they go, and kept as they are once they went", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const words = staffCopy.problems.anywhere;
    await connectTestGmail(HELLO);
    const { reply } = await replied();
    // Gmail refusing it, then logging that failing: nothing went, so it can be sent again.
    server.use(http.post(SEND, () => HttpResponse.json({ error: { message: "no" } }, { status: 500 })));
    await refuseWrites("email_sends", "NEW.outcome = 'failed'", "INSERT");
    expect(await answerReply(reply, DRAFT, textOf("Hi"), JO)).toEqual({
      sent: false,
      reason: "failed",
    });
    expect(await query("SELECT * FROM broadcast_answers")).toEqual([]);
    expect(error.mock.calls.map(([what]) => what)).toContain(words.notSentYet(words.answerTo(reply)));
    // It goes, but recording that fails: left sending, as its page says, never sent twice.
    gmailTakes();
    await refuseWrites("broadcast_answers", "NEW.status = 'sent'");
    expect(await answerReply(reply, DRAFT, textOf("Hi"), JO)).toEqual({ sent: true });
    expect(await query("SELECT status FROM broadcast_answers")).toEqual([{ status: "sending" }]);
    expect(error.mock.calls.map(([what]) => what)).toContain(words.sentUnrecorded(words.answerTo(reply)));
  });

  it("aren't sent without words, to a reply that's gone or automatic, or kept when they don't go", async () => {
    await connectTestGmail(HELLO);
    const { reply } = await replied();
    expect(await answerReply(reply, DRAFT, words("  "), JO)).toEqual({ sent: false, reason: "blank" });
    expect(await answerReply(reply, DRAFT, { type: "nonsense" }, JO)).toEqual({ sent: false, reason: "blank" });
    expect(await answerReply(reply + 1, DRAFT, words("Hi"), JO)).toEqual({ sent: false, reason: "gone" });
    await query("UPDATE broadcast_replies SET automatic = true");
    expect(await answerReply(reply, DRAFT, words("Hi"), JO)).toEqual({ sent: false, reason: "gone" });
    await query("UPDATE broadcast_replies SET automatic = false");
    // Gmail refusing it: forgotten, so it can be sent again, and the reply still waits.
    server.use(http.post(SEND, () => HttpResponse.json({ error: { message: "no" } }, { status: 500 })));
    expect(await answerReply(reply, DRAFT, words("Hi"), JO)).toEqual({ sent: false, reason: "failed" });
    expect(await query("SELECT * FROM broadcast_answers")).toEqual([]);
    expect(await query("SELECT outcome FROM broadcast_replies")).toEqual([{ outcome: null }]);
    // A blocked address.
    await recordProblem({ address: "jane@example.com", messageId: null, kind: "hard", reason: "No", canReset: true });
    expect(await answerReply(reply, DRAFT, words("Hi"), JO)).toEqual({ sent: false, reason: "blocked" });
  });
});

describeWithDatabase("answers to replies to texts", () => {
  useTestDatabase();
  afterEach(() => vi.unstubAllEnvs());

  /** A text to Jane's number, and her reply to it by WhatsApp `ago` ago; the reply's ID. */
  async function textReplied(ago = "1 hour"): Promise<number> {
    const [{ id: mailing }] = await query<{ id: number }>(
      `INSERT INTO mailings (title, subject, audience, channel, topic, filter, body, created_by, sent_from, from_name,
         due_at, state)
       VALUES ('News', '', 'supporters', 'text', 'events', '{"list": "supporters", "params": {}}',
         '{"type": "doc", "content": []}', $1, '+447700900000', 'PauseAI UK', now(), 'sent')
       RETURNING id::int AS id`,
      [JO],
    );
    const [{ id: copy }] = await query<{ id: number }>(
      `WITH s AS (INSERT INTO supporters DEFAULT VALUES RETURNING id)
       INSERT INTO broadcast_messages (mailing_id, supporter_id, status, topics, address, provider_message_id)
       SELECT $1, s.id, 'sent', '{events}', '+447700900123', $2 FROM s RETURNING id::int AS id`,
      [mailing, `wamid.copy-${mailing}`],
    );
    const [{ id: reply }] = await query<{ id: number }>(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, provider_message_id, body, automatic)
       VALUES ($1, now() - $2::interval, '+447700900123', '', $3, 'When is it?', false)
       RETURNING id::int AS id`,
      [copy, ago, `wamid.reply-${copy}`],
    );
    return reply;
  }

  /** WhatsApp taking each send, or refusing it; what each send asked for. */
  function whatsAppTakes(refuse = false): unknown[] {
    const sends: unknown[] = [];
    server.use(
      http.post(/graph\.facebook\.com\/.*\/messages$/, async ({ request }) => {
        sends.push(await request.json());
        return refuse
          ? HttpResponse.json({ error: { code: 131047, message: "Too late" } }, { status: 400 })
          : HttpResponse.json({ messages: [{ id: "wamid.answer" }] });
      }),
    );
    return sends;
  }

  const keys = () => {
    vi.stubEnv("WHATSAPP_TOKEN", "token");
    vi.stubEnv("WHATSAPP_ACCOUNT_ID", "fixture-account");
  };

  it("go by WhatsApp, as words of our own, within a day of their reply", async () => {
    keys();
    const sends = whatsAppTakes();
    const reply = await textReplied();
    expect(await answerReply(reply, DRAFT, words("Saturday at 11."), JO)).toEqual({ sent: true });
    expect(sends).toEqual([
      expect.objectContaining({
        to: "447700900123",
        type: "text",
        text: { body: "Saturday at 11.", preview_url: false },
      }),
    ]);
    expect(
      await query("SELECT status, provider_message_id AS id, gmail_message_id AS gmail FROM broadcast_answers"),
    ).toEqual([{ status: "sent", id: "wamid.answer", gmail: null }]);
    expect(await query("SELECT outcome FROM broadcast_replies")).toEqual([{ outcome: "answered" }]);
  });

  it("aren't sent more than a day after their reply, nor where WhatsApp doesn't send, nor when it refuses", async () => {
    keys();
    const sends = whatsAppTakes(true);
    expect(await answerReply(await textReplied("25 hours"), DRAFT, words("Hi"), JO)).toEqual({
      sent: false,
      reason: "window",
    });
    expect(sends).toEqual([]);
    const reply = await textReplied();
    expect(await answerReply(reply, DRAFT, words("Hi"), JO)).toEqual({ sent: false, reason: "failed" });
    expect(sends).toHaveLength(1);
    vi.stubEnv("WHATSAPP_TOKEN", "");
    expect(await answerReply(reply, "6f1c2a0e-5b7d-4c1e-9a3f-2d8e4b6c0a12", words("Hi"), JO)).toEqual({
      sent: false,
      reason: "failed",
    });
    // Each that didn't go is forgotten, to send again.
    expect(await query("SELECT 1 FROM broadcast_answers")).toEqual([]);
  });
});
