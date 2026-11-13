import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { staffCopy } from "@/lib/content/staff-interface";
import { query } from "@/lib/server/db";
import { addFollower, addTemplate } from "@/tests/broadcast-fixtures";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { notifications, type Notification } from "@/tests/notifications";
import { createBroadcastDraft } from "./broadcast-drafts";
import { recordWhatsAppWebhook } from "./whatsapp-webhooks";

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
    expect(await stops()).toEqual(["refused", "refused", "refused"]);
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
    expect(await recordWhatsAppWebhook(message({ id: "wamid.in-2", type: "image" }))).toBe(1);
    expect(await query("SELECT body FROM broadcast_replies WHERE message_id = $1", [newest])).toEqual([
      { body: staffCopy.broadcastPages.replies.notWords("image") },
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

  it("takes the Stop button, or a reply saying stop, as a stop of every text", async () => {
    const id = await sentCopy();
    const button = { type: "button", button: { text: emailSettingsCopy.stopButton, payload: "Stop" } };
    expect(await recordWhatsAppWebhook(message({ ...button, context: { id: "wamid.out-1" } }))).toBe(1);
    expect(await stops()).toEqual(["button", "button", "button"]);
    expect((await copyOf(id)).events).toEqual([{ kind: "opted-out", details: {} }]);
    await query("UPDATE opt_outs SET resubscribed_at = now()");
    expect(await recordWhatsAppWebhook(message({ id: "wamid.in-2", text: { body: " STOP " } }))).toBe(1);
    expect(await stops()).toEqual(["reply", "reply", "reply"]);
    expect(await query("SELECT 1 FROM broadcast_replies")).toEqual([]);
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
        Subject: staffCopy.notifications.whatsAppMessage.subject("+447700900999"),
        TextBody: expect.stringContaining("Hello, is this PauseAI?"),
      }),
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
    expect(await stops()).toEqual(["setting", "setting", "setting"]);
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
      { reason: staffCopy.notifications.templateRejectedWhy.reasons.INVALID_FORMAT },
    ]);
    await query("UPDATE whatsapp_templates SET status = 'pending', rejected_at = NULL, rejected_reason = NULL");
    expect(await recordWhatsAppWebhook(decided("REJECTED", undefined))).toBe(1);
    expect(await query("SELECT rejected_reason AS reason FROM whatsapp_templates")).toEqual([
      { reason: staffCopy.notifications.templateRejectedWhy.other("NONE") },
    ]);
    const category = hook("template_category_update", {
      message_template_name: "march_day_1",
      new_category: "UTILITY",
      previous_category: "MARKETING",
    });
    expect(await recordWhatsAppWebhook(category)).toBe(0);
    expect(await query("SELECT category FROM whatsapp_templates")).toEqual([{ category: "UTILITY" }]);
  });

  it("emails staff what WhatsApp says of our number, a template's quality or our account", async () => {
    const value = { display_phone_number: "447700900000", event: "DOWNGRADE", current_limit: "TIER_250" };
    expect(await recordWhatsAppWebhook(hook("phone_number_quality_update", value))).toBe(1);
    expect(sent).toEqual([
      expect.objectContaining({
        Subject: staffCopy.notifications.whatsAppAlert.subject("phone_number_quality_update"),
        TextBody: expect.stringContaining('"event": "DOWNGRADE"'),
      }),
    ]);
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
