import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { query } from "@/lib/server/db.server";
import { SITE_ACTOR } from "./broadcasts";
import { stopAnswer } from "./whatsapp-template";
import { addFollower, addTemplate } from "@/tests/broadcast-fixtures";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { notifications, type Notification } from "@/tests/notifications";
import { createBroadcastDraft } from "./drafts.server";
import { linkPage } from "@/lib/supporters/email-settings.server";
import { recordWhatsAppWebhook } from "./whatsapp-webhooks.server";
import { broadcastProblems, broadcastsCopy } from "./copy";

/** A webhook carrying one change. */
const hook = (field: string, value: Record<string, unknown>) => ({ entry: [{ changes: [{ field, value }] }] });

/** WhatsApp's time for AT, in seconds. */
const AT = new Date("2026-11-02T10:00:00Z");
const SECONDS = String(AT.getTime() / 1000);

/** A status WhatsApp reports of message `id`. */
const status = (id: string, kind: string, more: Record<string, unknown> = {}) =>
  hook("messages", { statuses: [{ id, status: kind, timestamp: SECONDS, recipient_id: "447700900123", ...more }] });

/** A message to us from `from`. */
const message = (fields: Record<string, unknown>, from = "447700900123") =>
  hook("messages", { messages: [{ id: "wamid.in-1", from, timestamp: SECONDS, type: "text", ...fields }] });

let sent: Notification[];
beforeEach(() => {
  sent = notifications();
  vi.stubEnv("WHATSAPP_TOKEN", "token");
  vi.stubEnv("WHATSAPP_ACCOUNT_ID", "fixture-account");
});
afterEach(() => vi.unstubAllEnvs());

/**
 * A copy of a text, sent to Jane's number as WhatsApp's message `wamid`,
 * its text in `state`; its ID.
 */
async function sentCopy(wamid = "wamid.out-1", state = "sending"): Promise<number> {
  const [known] = await query<{ id: number }>(
    "SELECT supporter_id::int AS id FROM supporter_links WHERE luma_user_id = 'usr-jane'",
  );
  const jane =
    known?.id ?? (await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: "+447700900123" }));
  const text = (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!;
  await query("UPDATE mailings SET title = 'March day', template_id = $2, due_at = now(), state = $3 WHERE id = $1", [
    text,
    await addTemplate("March day"),
    state,
  ]);
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO broadcast_messages (mailing_id, supporter_id, address, status, provider_message_id, sent_at)
     VALUES ($1, $2, '+447700900123', 'sent', $3, now()) RETURNING id::int AS id`,
    [text, jane, wamid],
  );
  return id;
}

/** A copy as kept: its status, why it was skipped, and its history's kinds. */
const copyOf = async (id: number) => {
  const [copy] = await query<{ status: string; skip: string | null; held: boolean }>(
    `SELECT status, skip_reason AS skip, not_before IS NOT NULL AS held FROM broadcast_messages WHERE id = $1`,
    [id],
  );
  const events = await query<{ kind: string; details: Record<string, unknown> }>(
    "SELECT kind, details FROM broadcast_message_events WHERE message_id = $1 ORDER BY id",
    [id],
  );
  return { ...copy, events };
};

/** WhatsApp taking each text we send, or refusing it; what each send asked for. */
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

/** The number's open opt-outs, by how they were given. */
const stops = async () =>
  (
    await query<{ ref: string }>(
      "SELECT source_ref AS ref FROM opt_outs WHERE address = '+447700900123' AND resubscribed_at IS NULL ORDER BY id",
    )
  ).map((row) => row.ref.split(" ")[0]);

describeWithDatabase("WhatsApp's webhook", () => {
  useTestDatabase();

  it("keeps a text delivered and read, each once, and nothing of one it doesn't know", async () => {
    const id = await sentCopy();
    expect(await recordWhatsAppWebhook(status("wamid.out-1", "sent"))).toBe(0);
    expect(await recordWhatsAppWebhook(status("wamid.out-1", "read"))).toBe(1);
    expect(await recordWhatsAppWebhook(status("wamid.out-1", "delivered"))).toBe(1);
    expect(await recordWhatsAppWebhook(status("wamid.out-1", "read"))).toBe(1);
    expect(await copyOf(id)).toEqual({
      status: "delivered",
      skip: null,
      held: false,
      events: [
        { kind: "delivered", details: {} },
        { kind: "read", details: {} },
      ],
    });
    expect(await recordWhatsAppWebhook(status("wamid.nobody", "read"))).toBe(0);
  });

  it("skips from then on a number that isn't on WhatsApp", async () => {
    const id = await sentCopy();
    const failed = status("wamid.out-1", "failed", { errors: [{ code: 131026, title: "Message undeliverable" }] });
    expect(await recordWhatsAppWebhook(failed)).toBe(1);
    expect(await copyOf(id)).toEqual({
      status: "skipped",
      skip: "not-on-whatsapp",
      held: false,
      events: [{ kind: "failed", details: { code: 131026, title: "Message undeliverable" } }],
    });
    expect(await query("SELECT number, message_id::int AS copy FROM whatsapp_unreachable")).toEqual([
      { number: "+447700900123", copy: id },
    ]);
  });

  it("stops every text to someone who stopped marketing messages", async () => {
    const id = await sentCopy();
    expect(await recordWhatsAppWebhook(status("wamid.out-1", "failed", { errors: [{ code: 131050 }] }))).toBe(1);
    expect(await copyOf(id)).toMatchObject({
      status: "skipped",
      skip: "unsubscribed",
      events: [{ kind: "opted-out" }],
    });
    expect(await stops()).toEqual(["refused"]);
  });

  it("holds a day one WhatsApp held back while its text is sending, and fails it once the text has finished", async () => {
    const id = await sentCopy();
    expect(await recordWhatsAppWebhook(status("wamid.out-1", "failed", { errors: [{ code: 131049 }] }))).toBe(1);
    expect(await copyOf(id)).toEqual({ status: "scheduled", skip: null, held: true, events: [] });
    const done = await sentCopy("wamid.out-2", "sent");
    expect(await recordWhatsAppWebhook(status("wamid.out-2", "failed", { errors: [{ code: 131049 }] }))).toBe(1);
    expect(await copyOf(done)).toMatchObject({
      status: "failed",
      events: [{ kind: "failed", details: { code: 131049, title: null } }],
    });
  });

  it("fails one that failed for any other reason, or none given, each failure in its history", async () => {
    const id = await sentCopy();
    expect(await recordWhatsAppWebhook(status("wamid.out-1", "failed"))).toBe(1);
    expect(await recordWhatsAppWebhook(status("wamid.out-1", "failed", { errors: [{ code: 131000 }] }))).toBe(1);
    expect(await copyOf(id)).toMatchObject({
      status: "failed",
      events: [
        { kind: "failed", details: { code: null, title: null } },
        { kind: "failed", details: { code: 131000, title: null } },
      ],
    });
  });

  it("keeps a reply, once, under the text it quotes, or else the newest sent to the number", async () => {
    const quoted = await sentCopy("wamid.out-1");
    expect(
      await recordWhatsAppWebhook(message({ text: { body: "See you there!" }, context: { id: "wamid.out-1" } })),
    ).toBe(1);
    expect(
      await recordWhatsAppWebhook(message({ text: { body: "See you there!" }, context: { id: "wamid.out-1" } })),
    ).toBe(0);
    expect(
      await query(
        "SELECT message_id::int AS copy, from_address AS from, body, received_at AS at FROM broadcast_replies",
      ),
    ).toEqual([{ copy: quoted, from: "+447700900123", body: "See you there!", at: AT }]);
    expect((await copyOf(quoted)).events).toEqual([{ kind: "replied", details: {} }]);
    await query("UPDATE broadcast_messages SET sent_at = now() - interval '1 day' WHERE id = $1", [quoted]);
    const newest = await sentCopy("wamid.out-2");
    // One that's more than words is kept as its kind, with the words it came with.
    expect(
      await recordWhatsAppWebhook(message({ id: "wamid.in-2", type: "image", image: { caption: "Our banner" } })),
    ).toBe(1);
    expect(await query("SELECT kind, body FROM broadcast_replies WHERE message_id = $1", [newest])).toEqual([
      { kind: "image", body: "Our banner" },
    ]);
    // One with no words at all, a voice note, is kept as its kind alone.
    expect(await recordWhatsAppWebhook(message({ id: "wamid.in-3", type: "audio", audio: { voice: true } }))).toBe(1);
    expect(await query("SELECT kind, body FROM broadcast_replies WHERE provider_message_id = 'wamid.in-3'")).toEqual([
      { kind: "voice", body: null },
    ]);
  });

  /** The reactions kept, oldest first. */
  const reactions = () =>
    query(
      `SELECT message_id::int AS copy, body, reaction_to AS to, removed_at AS removed, outcome
       FROM broadcast_replies WHERE kind = 'reaction' ORDER BY id`,
    );
  /** A reaction to our message `to`, with `emoji`, or none for one taken back. */
  const reaction = (id: string, to: string, emoji?: string, seconds = SECONDS) =>
    message({ id, type: "reaction", timestamp: seconds, reaction: { message_id: to, ...(emoji && { emoji }) } });

  it("keeps a reaction, once, as a reply to the text it's to, not the newest, its emoji its words", async () => {
    const reacted = await sentCopy("wamid.out-1");
    await sentCopy("wamid.out-2");
    expect(await recordWhatsAppWebhook(reaction("wamid.in-1", "wamid.out-1", "👍"))).toBe(1);
    expect(await recordWhatsAppWebhook(reaction("wamid.in-1", "wamid.out-1", "👍"))).toBe(0);
    expect(await reactions()).toEqual([{ copy: reacted, body: "👍", to: "wamid.out-1", removed: null, outcome: null }]);
    // A reply as any other: in the copy's history, and waiting for staff.
    expect((await copyOf(reacted)).events).toEqual([{ kind: "replied", details: {} }]);
  });

  it("marks a reaction removed when they take it back, or put another in its place, which is kept too", async () => {
    const copy = await sentCopy("wamid.out-1");
    const later = (minutes: number) => String(Number(SECONDS) + minutes * 60);
    const at = (minutes: number) => new Date(AT.getTime() + minutes * 60 * 1000);
    await recordWhatsAppWebhook(reaction("wamid.in-1", "wamid.out-1", "👍"));
    // Another in its place: the first is removed from then.
    expect(await recordWhatsAppWebhook(reaction("wamid.in-2", "wamid.out-1", "❤️", later(1)))).toBe(1);
    expect(await reactions()).toMatchObject([
      { copy, body: "👍", removed: at(1) },
      { copy, body: "❤️", removed: null },
    ]);
    // Taken back, which has no emoji: marked removed, once, and nothing new kept.
    expect(await recordWhatsAppWebhook(reaction("wamid.in-3", "wamid.out-1", undefined, later(2)))).toBe(1);
    expect(await recordWhatsAppWebhook(reaction("wamid.in-3", "wamid.out-1", undefined, later(2)))).toBe(0);
    expect(await reactions()).toMatchObject([
      { body: "👍", removed: at(1) },
      { body: "❤️", removed: at(2) },
    ]);
    // One taken back that was never kept, or that names no message, changes nothing.
    expect(await recordWhatsAppWebhook(reaction("wamid.in-4", "wamid.unknown"))).toBe(0);
    expect(await recordWhatsAppWebhook(message({ id: "wamid.in-5", type: "reaction" }))).toBe(0);
    expect(await reactions()).toHaveLength(2);
  });

  it("keeps a reaction to our answer under the text the answer's reply was to, and one to no message of ours under the newest", async () => {
    const copy = await sentCopy();
    const [{ reply }] = await query<{ reply: number }>(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, provider_message_id, body, automatic)
       VALUES ($1, now(), '+447700900123', '', 'wamid.in-0', 'When is it?', false) RETURNING id::int AS reply`,
      [copy],
    );
    await query(
      `INSERT INTO broadcast_answers (reply_id, draft_id, sent_by, body, status, sent_at, provider_message_id)
       VALUES ($1, gen_random_uuid(), 'jo@pauseai.uk', '{}', 'sent', now(), 'wamid.answer')`,
      [reply],
    );
    await query("UPDATE broadcast_messages SET sent_at = now() - interval '1 day' WHERE id = $1", [copy]);
    const newest = await sentCopy("wamid.out-2");
    await recordWhatsAppWebhook(reaction("wamid.in-1", "wamid.answer", "🙏"));
    await recordWhatsAppWebhook(reaction("wamid.in-2", "wamid.gone", "👀"));
    expect(await reactions()).toMatchObject([
      { copy, body: "🙏", to: "wamid.answer" },
      { copy: newest, body: "👀", to: "wamid.gone" },
    ]);
  });

  it("keeps a reply to our answer under the text the answer's reply was to", async () => {
    const copy = await sentCopy();
    const [{ reply }] = await query<{ reply: number }>(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, provider_message_id, body, automatic)
       VALUES ($1, now(), '+447700900123', '', 'wamid.in-0', 'When is it?', false) RETURNING id::int AS reply`,
      [copy],
    );
    await query(
      `INSERT INTO broadcast_answers (reply_id, draft_id, sent_by, body, status, sent_at, provider_message_id)
       VALUES ($1, gen_random_uuid(), 'jo@pauseai.uk', '{}', 'sent', now(), 'wamid.answer')`,
      [reply],
    );
    // A newer text to them, which a reply quoting our answer isn't to.
    await sentCopy("wamid.out-2");
    expect(await recordWhatsAppWebhook(message({ text: { body: "Thanks!" }, context: { id: "wamid.answer" } }))).toBe(
      1,
    );
    expect(await query("SELECT message_id::int AS copy FROM broadcast_replies WHERE body = 'Thanks!'")).toEqual([
      { copy },
    ]);
  });

  it("keeps our reply delivered, read and failed, each once, in its own history and not the copy's", async () => {
    const copy = await sentCopy();
    const [{ reply }] = await query<{ reply: number }>(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, provider_message_id, body, automatic)
       VALUES ($1, now(), '+447700900123', '', 'wamid.in-0', 'When is it?', false) RETURNING id::int AS reply`,
      [copy],
    );
    const [{ answer }] = await query<{ answer: number }>(
      `INSERT INTO broadcast_answers (reply_id, draft_id, sent_by, body, status, sent_at, provider_message_id)
       VALUES ($1, gen_random_uuid(), 'jo@pauseai.uk', '{}', 'sent', now(), 'wamid.answer') RETURNING id::int AS answer`,
      [reply],
    );
    const ours = () =>
      query("SELECT kind, details FROM broadcast_message_events WHERE answer_id = $1 ORDER BY id", [answer]);
    expect(await recordWhatsAppWebhook(status("wamid.answer", "sent"))).toBe(0);
    // Read before delivered, as webhooks can come out of order: read is delivered too.
    expect(await recordWhatsAppWebhook(status("wamid.answer", "read"))).toBe(1);
    expect(await recordWhatsAppWebhook(status("wamid.answer", "delivered"))).toBe(1);
    expect(await recordWhatsAppWebhook(status("wamid.answer", "read"))).toBe(1);
    const failed = status("wamid.answer", "failed", { errors: [{ code: 131047, title: "Re-engagement message" }] });
    expect(await recordWhatsAppWebhook(failed)).toBe(1);
    expect(await recordWhatsAppWebhook(failed)).toBe(1);
    expect(await recordWhatsAppWebhook(status("wamid.answer", "failed"))).toBe(1);
    expect(await ours()).toEqual([
      { kind: "delivered", details: {} },
      { kind: "read", details: {} },
      { kind: "failed", details: { code: 131047, title: "Re-engagement message" } },
    ]);
    expect(await copyOf(copy)).toMatchObject({ status: "sent", events: [] });
  });

  it("puts a reply back for staff when our newest reply to it fails, but not an opt-out, nor for an older reply", async () => {
    const copy = await sentCopy();
    /** Their reply, dealt with as `outcome`, and our replies to it, sent `ago` each; theirs, and ours' IDs. */
    const replied = async (wamid: string, outcome: string, ago: string[]) => {
      const [{ reply }] = await query<{ reply: number }>(
        `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, provider_message_id, body,
           automatic, outcome, dealt_by, dealt_at)
         VALUES ($1, now(), '+447700900123', '', $2, 'When is it?', false, $3, 'jo@pauseai.uk', now())
         RETURNING id::int AS reply`,
        [copy, wamid, outcome],
      );
      for (const [i, interval] of ago.entries()) {
        await query(
          `INSERT INTO broadcast_answers (reply_id, draft_id, sent_by, body, status, sent_at, provider_message_id)
           VALUES ($1, gen_random_uuid(), 'jo@pauseai.uk', '{}', 'sent', now() - $2::interval, $3)`,
          [reply, interval, `${wamid}.ours-${i}`],
        );
      }
      return reply;
    };
    const outcome = async (reply: number) =>
      (await query("SELECT outcome, dealt_by, dealt_at FROM broadcast_replies WHERE id = $1", [reply]))[0];
    const answered = await replied("wamid.in-1", "answered", ["1 hour", "5 minutes"]);
    // The older of our two replies failing: the newer went, so the reply stays answered.
    expect(await recordWhatsAppWebhook(status("wamid.in-1.ours-0", "failed"))).toBe(1);
    expect(await outcome(answered)).toMatchObject({ outcome: "answered" });
    expect(await recordWhatsAppWebhook(status("wamid.in-1.ours-1", "failed"))).toBe(1);
    expect(await outcome(answered)).toEqual({ outcome: null, dealt_by: null, dealt_at: null });
    const stop = await replied("wamid.in-2", "opted-out", ["1 minute"]);
    expect(await recordWhatsAppWebhook(status("wamid.in-2.ours-0", "failed"))).toBe(1);
    expect(await outcome(stop)).toMatchObject({ outcome: "opted-out" });
  });

  it("keeps a failure of our reply with no why given", async () => {
    const copy = await sentCopy();
    const [{ reply }] = await query<{ reply: number }>(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, provider_message_id, body, automatic)
       VALUES ($1, now(), '+447700900123', '', 'wamid.in-0', 'When is it?', false) RETURNING id::int AS reply`,
      [copy],
    );
    await query(
      `INSERT INTO broadcast_answers (reply_id, draft_id, sent_by, body, status, sent_at, provider_message_id)
       VALUES ($1, gen_random_uuid(), 'jo@pauseai.uk', '{}', 'sent', now(), 'wamid.answer')`,
      [reply],
    );
    expect(await recordWhatsAppWebhook(status("wamid.answer", "failed"))).toBe(1);
    expect(await query("SELECT kind, details FROM broadcast_message_events WHERE answer_id IS NOT NULL")).toEqual([
      { kind: "failed", details: { code: null, title: null } },
    ]);
  });

  it("takes a reply saying stop, whatever its case, as a stop of the copy it answers, kept as an opt-out", async () => {
    const id = await sentCopy();
    expect(await recordWhatsAppWebhook(message({ text: { body: " STOP " }, context: { id: "wamid.out-1" } }))).toBe(1);
    expect(await stops()).toEqual(["reply"]);
    expect((await copyOf(id)).events).toEqual([{ kind: "opted-out", details: {} }]);
    expect(
      await query("SELECT message_id::int AS copy, body, outcome, dealt_by AS by, automatic FROM broadcast_replies"),
    ).toEqual([{ copy: id, body: " STOP ", outcome: "opted-out", by: SITE_ACTOR, automatic: false }]);
  });

  it("answers a stop once, saying what it stopped, with a link to the page for the number", async () => {
    const sends = whatsAppTakes();
    const id = await sentCopy();
    await query("UPDATE broadcast_messages SET topics = '{events}' WHERE id = $1", [id]);
    await recordWhatsAppWebhook(message({ text: { body: "stop" }, context: { id: "wamid.out-1" } }));
    await recordWhatsAppWebhook(message({ id: "wamid.in-2", text: { body: "stop" }, context: { id: "wamid.out-1" } }));
    expect(sends).toEqual([
      expect.objectContaining({
        to: "447700900123",
        type: "text",
        text: expect.objectContaining({ body: expect.any(String) }),
      }),
    ]);
    const body = (sends[0] as { text: { body: string } }).text.body;
    const link = body.match(/https:\/\/pauseai\.uk\/contact-preferences\/\S+/)![0];
    expect(body).toBe(stopAnswer(["events"], link));
    const page = await linkPage(link.split("/").at(-1)!);
    expect(page).toMatchObject({ number: true, view: { address: "+447700900123", numbers: ["+447700900123"] } });
    // The answer, kept under the stop's reply, so the copy's thread shows it.
    expect(
      await query(`SELECT a.sent_by AS by, a.status, a.provider_message_id AS id, a.body #>> '{content,0,content,0,text}' AS words
                   FROM broadcast_answers a JOIN broadcast_replies r ON r.id = a.reply_id`),
    ).toEqual([{ by: SITE_ACTOR, status: "sent", id: "wamid.answer", words: body }]);
  });

  it("answers a stop from a number we never texted, keeping no reply, as there's no thread for it", async () => {
    const sends = whatsAppTakes();
    await recordWhatsAppWebhook(message({ text: { body: "stop" } }, "447700900999"));
    expect(sends).toEqual([expect.objectContaining({ to: "447700900999", type: "text" })]);
    expect(await query("SELECT 1 FROM broadcast_replies")).toEqual([]);
    expect(await query("SELECT 1 FROM broadcast_answers")).toEqual([]);
  });

  it("keeps a stop whose answer doesn't go, reporting it, and answers none without WhatsApp's keys", async () => {
    whatsAppTakes(true);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await sentCopy();
    await recordWhatsAppWebhook(message({ text: { body: "stop" }, context: { id: "wamid.out-1" } }));
    expect(await stops()).toEqual(["reply"]);
    expect(error).toHaveBeenCalledWith(broadcastProblems.stopNotAnswered().what, expect.anything());
    expect(await query("SELECT 1 FROM broadcast_answers")).toEqual([]);
    error.mockClear();
    vi.unstubAllEnvs();
    await recordWhatsAppWebhook(message({ id: "wamid.in-2", text: { body: "stop" } }, "447700900124"));
    expect(error).not.toHaveBeenCalled();
  });

  it("keeps any other button pressed, or words that aren't a stop, as a reply", async () => {
    await sentCopy();
    expect(await recordWhatsAppWebhook(message({ type: "button", button: { text: "Count me in" } }))).toBe(1);
    expect(await recordWhatsAppWebhook(message({ id: "wamid.in-2", text: { body: "Please stop by the stall" } }))).toBe(
      1,
    );
    expect(await stops()).toEqual([]);
    expect(await query("SELECT body FROM broadcast_replies ORDER BY id")).toEqual([
      { body: "Count me in" },
      { body: "Please stop by the stall" },
    ]);
  });

  it("emails staff a message that answers no text of ours", async () => {
    expect(await recordWhatsAppWebhook(message({ text: { body: "Hello, is this PauseAI?" } }, "447700900999"))).toBe(1);
    expect(sent).toEqual([
      expect.objectContaining({
        Subject: broadcastsCopy.notifications.whatsAppMessage.subject("+447700900999"),
        TextBody: expect.stringContaining("Hello, is this PauseAI?"),
      }),
    ]);
  });

  it("emails staff one that's more than words as what it was, then its words", async () => {
    const replies = broadcastsCopy.broadcastPages.replies;
    await recordWhatsAppWebhook(message({ type: "image", image: { caption: "Our banner" } }, "447700900999"));
    await recordWhatsAppWebhook(
      message(
        { id: "wamid.in-2", type: "reaction", reaction: { message_id: "wamid.gone", emoji: "👍" } },
        "447700900999",
      ),
    );
    expect(sent.map((email) => email.TextBody)).toEqual([
      expect.stringContaining(`${replies.kinds.image}\nOur banner`),
      expect.stringContaining(`${replies.reacted}\n👍`),
    ]);
  });

  it("takes WhatsApp's setting for marketing messages: off a stop, back on lifting only that stop", async () => {
    const preference = (value: string, more: Record<string, unknown> = {}) =>
      hook("user_preferences", {
        user_preferences: [
          { wa_id: "447700900123", category: "marketing_messages", value, timestamp: SECONDS, ...more },
        ],
      });
    expect(await recordWhatsAppWebhook(preference("stop"))).toBe(1);
    expect(await stops()).toEqual(["setting"]);
    expect(await recordWhatsAppWebhook(preference("resume"))).toBe(1);
    expect(await stops()).toEqual([]);
    expect(await recordWhatsAppWebhook(preference("something"))).toBe(0);
    expect(await recordWhatsAppWebhook(preference("stop", { category: "other" }))).toBe(0);
    // One with no time is kept from 1970: a resume after it lifts it.
    expect(await recordWhatsAppWebhook(preference("stop", { timestamp: undefined }))).toBe(1);
    expect(await query("SELECT DISTINCT unsubscribed_at AS at FROM opt_outs WHERE resubscribed_at IS NULL")).toEqual([
      { at: new Date(0) },
    ]);
  });

  it("applies what WhatsApp decided of a template, and the category it gave it", async () => {
    const id = await addTemplate("March day", { status: "pending" });
    await query("UPDATE whatsapp_templates SET meta_name = 'march_day_1' WHERE id = $1", [id]);
    const decided = (event: string, reason: unknown) =>
      hook("message_template_status_update", { event, message_template_name: "march_day_1", reason });
    expect(await recordWhatsAppWebhook(decided("REJECTED", "INVALID_FORMAT"))).toBe(1);
    expect(await query("SELECT rejected_reason AS reason FROM whatsapp_templates")).toEqual([
      { reason: "INVALID_FORMAT" },
    ]);
    await query("UPDATE whatsapp_templates SET status = 'pending', rejected_at = NULL, rejected_reason = NULL");
    expect(await recordWhatsAppWebhook(decided("REJECTED", undefined))).toBe(1);
    expect(await query("SELECT rejected_reason AS reason FROM whatsapp_templates")).toEqual([{ reason: "NONE" }]);
    const category = hook("template_category_update", {
      message_template_name: "march_day_1",
      new_category: "UTILITY",
      previous_category: "MARKETING",
    });
    expect(await recordWhatsAppWebhook(category)).toBe(0);
    expect(await query("SELECT category FROM whatsapp_templates")).toEqual([{ category: "UTILITY" }]);
  });

  it("emails staff what WhatsApp says of our number, a template's quality or our account, linking to it in WhatsApp Manager", async () => {
    vi.stubEnv("WHATSAPP_ACCOUNT_ID", "1234");
    const value = { display_phone_number: "447700900000", event: "DOWNGRADE", current_limit: "TIER_250" };
    expect(await recordWhatsAppWebhook(hook("phone_number_quality_update", value))).toBe(1);
    expect(sent).toEqual([
      expect.objectContaining({
        Subject: broadcastsCopy.notifications.whatsAppAlert.subject("phone_number_quality_update"),
        TextBody: expect.stringContaining('"event": "DOWNGRADE"'),
      }),
    ]);
    expect(sent[0]!.TextBody).toContain("https://business.facebook.com/wa/manage/home/?waba_id=1234");
    vi.unstubAllEnvs();
  });

  it("changes nothing for a field it doesn't read, or a webhook with nothing in it", async () => {
    expect(await recordWhatsAppWebhook(hook("security", { event: "PIN_CHANGED" }))).toBe(0);
    expect(await recordWhatsAppWebhook(hook("messages", {}))).toBe(0);
    expect(await recordWhatsAppWebhook(hook("user_preferences", {}))).toBe(0);
    expect(await recordWhatsAppWebhook({})).toBe(0);
    expect(await recordWhatsAppWebhook({ entry: [{}] })).toBe(0);
    expect(await recordWhatsAppWebhook({ entry: [{ changes: [{ field: "messages" }, { value: {} }] }] })).toBe(0);
    expect(sent).toEqual([]);
  });
});
