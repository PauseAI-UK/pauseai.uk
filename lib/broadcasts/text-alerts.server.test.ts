import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { notifications, NOTIFICATIONS } from "@/tests/notifications";
import { query } from "@/lib/server/db.server";
import { alertWaitingTexts } from "./text-alerts.server";
import { broadcastsCopy } from "./copy";

const NOW = "2026-11-20T12:00:00Z";
const email = broadcastsCopy.notifications.textsWaiting;

/** A text broadcast titled `title`, made by `by`, and a copy of it to `number`, named `name`: their IDs. */
async function texted(title: string, by: string, number: string, name: string | null) {
  const [{ mailing }] = await query<{ mailing: number }>(
    `INSERT INTO mailings (title, audience, channel, topic, filter, created_by, state)
     VALUES ($1, 'supporters', 'text', 'events', '{}', $2, 'sent') RETURNING id::int AS mailing`,
    [title, by],
  );
  const [{ copy }] = await query<{ copy: number }>(
    `WITH s AS (INSERT INTO supporters DEFAULT VALUES RETURNING id)
     INSERT INTO broadcast_messages (mailing_id, supporter_id, status, address, merge_values)
     SELECT $1, s.id, 'sent', $2, $3 FROM s RETURNING id::int AS copy`,
    [mailing, number, JSON.stringify(name ? { name } : {})],
  );
  return { mailing, copy };
}

/** A reply to copy `copy`, `hours` before now: by text unless `email`, and waiting unless `outcome`. */
async function reply(
  copy: number,
  hours: number,
  { email = false, automatic = false, outcome = null as string | null } = {},
) {
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, provider_message_id, body,
       account, gmail_message_id, gmail_thread_id, blob_key, automatic, outcome, dealt_by, dealt_at)
     SELECT $1, $2::timestamptz - make_interval(mins => $3), CASE WHEN $4 THEN 'jane@example.com' ELSE address END, '',
       CASE WHEN $4 THEN NULL ELSE g END, CASE WHEN $4 THEN NULL ELSE 'Hello' END,
       CASE WHEN $4 THEN 'hello@pauseai.uk' END, CASE WHEN $4 THEN g END, CASE WHEN $4 THEN g END, CASE WHEN $4 THEN g END,
       $5, $6, CASE WHEN $6::text IS NOT NULL THEN 'jo@pauseai.uk' END, CASE WHEN $6::text IS NOT NULL THEN now() END
     FROM broadcast_messages, (SELECT gen_random_uuid()::text AS g) n WHERE id = $1 RETURNING id::int AS id`,
    [copy, NOW, Math.round(hours * 60), email, automatic, outcome],
  );
  return id;
}

describeWithDatabase("the email about replies to texts left waiting", () => {
  useTestDatabase();

  beforeEach(() => {
    vi.stubEnv("FIXTURE_NOW", NOW);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("names, once, each text reply waiting two hours or more that WhatsApp would still let us answer, a broadcast an email", async () => {
    const sent = notifications();
    const march = await texted("March", "jo@pauseai.uk", "+447700900001", "Jane Example");
    const news = await texted("News", "sam@pauseai.uk", "+447700900002", null);
    // Waiting long enough, and a day nearly gone.
    await reply(march.copy, 3);
    await reply(march.copy, 23.5);
    await reply(news.copy, 2);
    // Too new, past WhatsApp's day, dealt with, automatic, or an email's.
    await reply(march.copy, 1);
    await reply(march.copy, 25);
    await reply(march.copy, 5, { outcome: "nothing" });
    await reply(march.copy, 5, { automatic: true });
    await reply(march.copy, 5, { email: true });
    expect(await alertWaitingTexts()).toBe(3);
    expect(sent).toEqual([
      expect.objectContaining({
        To: expect.stringContaining(`<${NOTIFICATIONS}>`),
        Cc: "jo@pauseai.uk",
        Subject: email.subject(2, "March"),
        // The oldest first, as it has least time left; under an hour left, it says one.
        TextBody: email.body("March", [
          email.line("Jane Example", 1, `https://pauseai.uk/staff/broadcasts/${march.mailing}/${march.copy}`),
          email.line("Jane Example", 21, `https://pauseai.uk/staff/broadcasts/${march.mailing}/${march.copy}`),
        ]),
      }),
      expect.objectContaining({
        Cc: "sam@pauseai.uk",
        Subject: email.subject(1, "News"),
        // With no name, their number.
        TextBody: email.body("News", [
          email.line("07700 900002", 22, `https://pauseai.uk/staff/broadcasts/${news.mailing}/${news.copy}`),
        ]),
      }),
    ]);
    // Named once.
    expect(await alertWaitingTexts()).toBe(0);
    expect(sent).toHaveLength(2);
  });

  it("names them again next time when the email doesn't go", async () => {
    notifications();
    server.use(
      http.post("https://api.postmarkapp.com/email", () => HttpResponse.json({ ErrorCode: 300 }, { status: 422 })),
    );
    const march = await texted("March", "jo@pauseai.uk", "+447700900001", "Jane Example");
    await reply(march.copy, 3);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await alertWaitingTexts()).toBe(0);
    expect(await query("SELECT alerted_at FROM broadcast_replies")).toEqual([{ alerted_at: null }]);
  });
});
