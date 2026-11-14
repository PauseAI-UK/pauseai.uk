import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { query } from "@/lib/server/db.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { copyAnswered, dealWithReply, keepBroadcastReply, repliesTo, repliesWaiting } from "./replies.server";
import { saveLetterReply } from "@/lib/server/outside-services/blobs.server";
import type { GmailMessageHeaders } from "@/lib/server/outside-services/gmail.server";

const JO = "jo@pauseai.uk";

/** A copy of a newsletter to Jane, sent with Message-ID copy-1@pauseai.uk; its ID. */
async function copy(topics = ["newsletter", "events"]): Promise<number> {
  const [{ id: mailing }] = await query<{ id: number }>(
    `INSERT INTO mailings (title, audience, channel, topic, filter, body, created_by, state)
     VALUES ('', 'supporters', 'email', 'newsletter', '{}', '{}', 'staff@pauseai.uk', 'draft') RETURNING id::int AS id`,
  );
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO broadcast_messages (mailing_id, status, rfc_message_id, topics) VALUES ($1, 'sent', 'copy-1@pauseai.uk', $2)
     RETURNING id::int AS id`,
    [mailing, topics],
  );
  // Its address, which a copy has only with a supporter.
  const [{ id: supporter }] = await query<{ id: number }>(
    "INSERT INTO supporters DEFAULT VALUES RETURNING id::int AS id",
  );
  await query("UPDATE broadcast_messages SET supporter_id = $2, address = 'jane@example.com' WHERE id = $1", [
    id,
    supporter,
  ]);
  return id;
}

/** A reply kept as Gmail would bring it: its ID. */
async function reply(
  copyId: number,
  gmailId: string,
  automatic = false,
  text = "Please stop.\r\n\r\n> Our news",
): Promise<number> {
  const key = `${JO}/${gmailId}.eml.gz`;
  await saveLetterReply(
    key,
    gzipSync(Buffer.from(`Subject: Re: News\r\nContent-Type: text/plain\r\n\r\n${text}`, "latin1")),
  );
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, account, gmail_message_id,
       gmail_thread_id, rfc_message_id, blob_key, automatic)
     VALUES ($1, '2026-11-02T10:00:00Z', 'jane@example.com', 'Re: News', $2, $3, 'thread-' || $3, $3 || '@mail.example.com',
       $4, $5) RETURNING id::int AS id`,
    [copyId, JO, gmailId, key, automatic],
  );
  return id;
}

const headers = (fields: Record<string, string>): GmailMessageHeaders => ({
  id: "g1",
  threadId: "t1",
  labelIds: [],
  internalDate: String(Date.parse("2026-11-02T10:00:00Z")),
  headers: new Map(Object.entries(fields).map(([name, value]) => [name.toLowerCase(), value])),
});

beforeEach(() => {
  vi.stubEnv(
    "NETLIFY_BLOBS_CONTEXT",
    Buffer.from(JSON.stringify({ edgeURL: "https://blobs.fixture.invalid", siteID: "fixture", token: "t" })).toString(
      "base64",
    ),
  );
});
afterEach(() => vi.unstubAllEnvs());

describeWithDatabase("replies to broadcasts", () => {
  useTestDatabase();

  it("finds the copy a message answers by the Message-IDs it names, and none for none", async () => {
    const id = await copy();
    expect(await copyAnswered(headers({ "In-Reply-To": "<copy-1@pauseai.uk>" }))).toBe(id);
    expect(await copyAnswered(headers({ References: "<a@x> <copy-1@pauseai.uk>" }))).toBe(id);
    expect(await copyAnswered(headers({ "In-Reply-To": "<other@x>" }))).toBeUndefined();
    expect(await copyAnswered(headers({}))).toBeUndefined();
    // A reply to our answer to a reply joins the same copy.
    const answered = await reply(id, "g1");
    await query(
      `INSERT INTO broadcast_answers (reply_id, draft_id, sent_by, body, status, sent_at, rfc_message_id)
       VALUES ($1, gen_random_uuid(), $2, '{}', 'sent', now(), 'answer-1@pauseai.uk')`,
      [answered, JO],
    );
    expect(await copyAnswered(headers({ "In-Reply-To": "<answer-1@pauseai.uk>" }))).toBe(id);
  });

  it("keeps a reply once", async () => {
    server.use(
      http.get("https://gmail.googleapis.com/gmail/v1/users/me/messages/:id", () =>
        HttpResponse.json({ raw: Buffer.from("Subject: Re\r\n\r\nHi").toString("base64url") }),
      ),
    );
    const id = await copy();
    const message = headers({ From: "Jane <jane@example.com>", "Message-ID": "<r1@mail.example.com>" });
    expect(await keepBroadcastReply(JO, "token", id, message)).toBe("reply");
    expect(await keepBroadcastReply(JO, "token", id, message)).toBe("already");
    // With its thread and Message-ID, which an answer joins and names; one without a Message-ID has none.
    expect(await keepBroadcastReply(JO, "token", id, { ...headers({}), id: "g2" })).toBe("reply");
    expect(await query("SELECT subject, gmail_thread_id, rfc_message_id FROM broadcast_replies ORDER BY id")).toEqual([
      { subject: "", gmail_thread_id: "t1", rfc_message_id: "r1@mail.example.com" },
      { subject: "", gmail_thread_id: "t1", rfc_message_id: null },
    ]);
  });

  it("gives each reply's words without what it quotes, and what staff made of it", async () => {
    const id = await copy();
    const waiting = await reply(id, "g1");
    await reply(id, "g2", true, "");
    expect(await repliesTo(id)).toEqual([
      expect.objectContaining({
        id: waiting,
        from: "jane@example.com",
        text: "Please stop.",
        automatic: false,
        outcome: null,
      }),
      expect.objectContaining({ automatic: true, text: "" }),
    ]);
    expect(await repliesWaiting()).toBe(1);
  });

  it("records a reply as an opt-out of what its copy went under, or of all bulk email, or as nothing, once", async () => {
    const id = await copy();
    const first = await reply(id, "g1");
    const second = await reply(id, "g2");
    const third = await reply(id, "g3");
    const automatic = await reply(id, "g4", true);
    // On the live site, an opt-out of events or every bulk email takes the address off our Luma calendar.
    vi.stubEnv("DEPLOY_CONTEXT", "production");
    vi.stubEnv("LUMA_API_KEY", "k");
    const removed: unknown[] = [];
    server.use(
      http.post("https://public-api.luma.com/v1/calendars/contacts/remove", async ({ request }) => {
        removed.push(await request.json());
        return HttpResponse.json({});
      }),
    );
    expect(await dealWithReply(first, "topics", JO)).toBe(true);
    expect(await dealWithReply(first, "nothing", JO)).toBe(false);
    expect(await dealWithReply(automatic, "nothing", JO)).toBe(false);
    expect(await dealWithReply(second, "bulk", "Sam@PauseAI.uk")).toBe(true);
    expect(await dealWithReply(third, "nothing", JO)).toBe(true);
    expect(await query("SELECT list, source, recorded_by, message_id::int AS copy FROM opt_outs ORDER BY id")).toEqual([
      { list: "newsletter", source: "reply", recorded_by: JO, copy: id },
      { list: "events", source: "reply", recorded_by: JO, copy: id },
      { list: "bulk", source: "reply", recorded_by: "sam@pauseai.uk", copy: id },
    ]);
    expect(await query("SELECT outcome, dealt_by FROM broadcast_replies ORDER BY id")).toEqual([
      { outcome: "opted-out", dealt_by: JO },
      { outcome: "opted-out", dealt_by: "sam@pauseai.uk" },
      { outcome: "nothing", dealt_by: JO },
      { outcome: null, dealt_by: null },
    ]);
    expect(await query("SELECT details FROM audit_log WHERE action = 'deal with reply' ORDER BY id")).toEqual([
      { details: { replyId: first, outcome: "opted-out" } },
      { details: { replyId: second, outcome: "opted-out" } },
      { details: { replyId: third, outcome: "nothing" } },
    ]);
    expect(await repliesWaiting()).toBe(0);
    const [{ address }] = await query<{ address: string }>("SELECT address FROM broadcast_messages WHERE id = $1", [
      id,
    ]);
    // Once for the events of the first, once for the second's every bulk email; nothing for the third.
    expect(removed).toEqual([{ email: address }, { email: address }]);
  });

  it("records an answered reply as an opt-out, but not as nothing to do", async () => {
    const id = await copy(["newsletter"]);
    const answered = await reply(id, "g1");
    await query("UPDATE broadcast_replies SET outcome = 'answered', dealt_by = $1, dealt_at = now()", [JO]);
    expect(await dealWithReply(answered, "nothing", JO)).toBe(false);
    expect(await dealWithReply(answered, "topics", JO)).toBe(true);
    expect(await query("SELECT outcome FROM broadcast_replies")).toEqual([{ outcome: "opted-out" }]);
  });

  it("records nothing for a reply to a copy whose address was erased", async () => {
    const id = await copy();
    const waiting = await reply(id, "g1");
    await query("UPDATE broadcast_messages SET supporter_id = NULL, address = NULL, merge_values = NULL");
    expect(await dealWithReply(waiting, "bulk", JO)).toBe(true);
    expect(await query("SELECT * FROM opt_outs")).toEqual([]);
  });
});

describeWithDatabase("replies to texts", () => {
  useTestDatabase();

  /** A text to Jane's number under events, and her reply to it by WhatsApp `ago` ago; the reply's ID. */
  async function textReply(ago: string): Promise<number> {
    const [{ id: mailing }] = await query<{ id: number }>(
      `INSERT INTO mailings (title, subject, audience, channel, topic, filter, body, created_by, sent_from, from_name,
         due_at, state)
       VALUES ('News', '', 'supporters', 'text', 'events', '{"list": "supporters", "params": {}}',
         '{"type": "doc", "content": []}', $1, '+447700900000', 'PauseAI UK', now(), 'sent')
       RETURNING id::int AS id`,
      [JO],
    );
    const [{ id: copyId }] = await query<{ id: number }>(
      `WITH s AS (INSERT INTO supporters DEFAULT VALUES RETURNING id)
       INSERT INTO broadcast_messages (mailing_id, supporter_id, status, topics, address)
       SELECT $1, s.id, 'sent', '{events}', '+447700900123' FROM s RETURNING id::int AS id`,
      [mailing],
    );
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, provider_message_id, body, automatic)
       VALUES ($1, now() - $2::interval, '+447700900123', '', $3, 'Please stop', false) RETURNING id::int AS id`,
      [copyId, ago, `wamid.${copyId}`],
    );
    return id;
  }

  it("gives a text's words as kept, answerable only within a day", async () => {
    const recent = await textReply("1 hour");
    const old = await textReply("2 days");
    const copyOf = async (id: number) =>
      (await query<{ copy: number }>("SELECT message_id::int AS copy FROM broadcast_replies WHERE id = $1", [id]))[0]
        .copy;
    expect(await repliesTo(await copyOf(recent))).toMatchObject([
      { id: recent, text: "Please stop", answerable: true },
    ]);
    expect(await repliesTo(await copyOf(old))).toMatchObject([{ id: old, text: "Please stop", answerable: false }]);
  });

  it("records a text's reply as a stop of texts: of what it went under, or of every text", async () => {
    const one = await textReply("1 hour");
    expect(await dealWithReply(one, "topics", JO)).toBe(true);
    const every = await textReply("1 hour");
    expect(await dealWithReply(every, "bulk", JO)).toBe(true);
    expect(await query("SELECT list, way, source FROM opt_outs ORDER BY list")).toEqual([
      { list: "events", way: "text", source: "reply" },
      { list: "newsletter", way: "text", source: "reply" },
      { list: "volunteering", way: "text", source: "reply" },
    ]);
  });
});
