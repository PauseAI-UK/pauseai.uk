import { expect, it } from "vitest";
import { addTestLetter, addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { IMPORT_JOBS, type ImportJob } from "@/lib/import-runs";
import { query } from "@/lib/server/db.server";
import { HEALTH_GROUP_NAMES, type HealthCheck, type HealthGroup } from "./health";
import { checkAllHealth, checkHealth } from "./health.server";

const NOW = new Date("2026-11-26T12:00:00Z");
/** `hours` before NOW, for a row's time. */
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

/** What one check of a group found. */
async function found(group: HealthGroup, check: HealthCheck) {
  return (await checkHealth(group, NOW)).checks[check];
}

/** A run of `job` at `at`: one that went right, failed, or recorded a problem. */
async function ran(job: ImportJob, at: string, how: "ok" | "failed" | "problem" = "ok") {
  await query(
    `INSERT INTO import_runs (job, at, started_by, status, failure, problems) VALUES ($1, $2, 'nightly', $3, $4, $5)`,
    [
      job,
      at,
      how === "failed" ? "failed" : "ok",
      how === "failed" ? JSON.stringify({ said: "It broke" }) : null,
      JSON.stringify(how === "problem" ? [{ code: "jobs.couldntRead", values: {}, what: "Couldn't read" }] : []),
    ],
  );
}

/** Every job run at its last time before NOW, so none is late. */
async function allRanOnTime() {
  for (const job of IMPORT_JOBS) {
    const frequent = job === "import-luma" || job === "read-gmail" || job === "send-mailings";
    await ran(
      job,
      frequent ? "2026-11-26T11:58:00Z" : job === "import-civicrm" ? "2026-11-26T11:49:10Z" : "2026-11-26T06:30:00Z",
    );
  }
}

/** An email the site tried to send, `minutes` before NOW. */
async function tried(outcome: "sent" | "failed" | "refused", minutes: number, imported = false) {
  await query(
    `INSERT INTO email_sends (at, purpose, address, outcome, message_id, imported)
     VALUES ($1, 'staff-alert', 'jo@pauseai.uk', $2, $3, $4)`,
    [ago(minutes / 60), outcome, outcome === "sent" ? `m-${minutes}` : null, imported],
  );
}

/** A broadcast to supporters on `channel`, with `copies` sent `hours` before NOW, `delivered` of them marked so: its ID. */
async function broadcast(channel: "text" | "email", copies: number, hours: number, delivered = 0): Promise<number> {
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO mailings (title, audience, channel, topic, filter, body, created_by, state)
     VALUES ('', 'supporters', $1, 'newsletter', '{}', '{}', 'staff@pauseai.uk', 'draft') RETURNING id::int AS id`,
    [channel],
  );
  await query(
    `INSERT INTO broadcast_messages (mailing_id, status, sent_at)
     SELECT $1, CASE WHEN n <= $4 THEN 'delivered' ELSE 'sent' END, $3 FROM generate_series(1, $2::int) n`,
    [id, copies, ago(hours), delivered],
  );
  return id;
}

/** A mailing to politicians, with `letters` sent `hours` before NOW: its ID and its first letter's. */
async function mailing(letters: number, hours: number): Promise<{ id: number; letter: number }> {
  const polly = await addTestPolitician({ airtableId: null, name: `Polly ${hours}` });
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO mailings (title, audience, channel, filter, body, created_by, state)
     VALUES ('', 'politicians', 'email', '{}', '{}', 'staff@pauseai.uk', 'draft') RETURNING id::int AS id`,
  );
  const sent = await query<{ id: number }>(
    `INSERT INTO letters (kind, notable_person_id, status, sent_at)
     SELECT 'pauseai', $1, 'sent', $3 FROM generate_series(1, $2::int) RETURNING id::int AS id`,
    [polly, letters, ago(hours)],
  );
  await query("INSERT INTO letters_from_pauseai (id, mailing_id) SELECT unnest($1::bigint[]), $2", [
    sent.map((letter) => letter.id),
    id,
  ]);
  return { id, letter: sent[0].id };
}

/** A reply to `letter`, `hours` before NOW, from the politician's side unless said. */
async function reply(letter: number, hours: number, from: "politician" | "us" | "supporter" = "politician") {
  await query(
    `INSERT INTO letter_replies (letter_id, account, gmail_message_id, gmail_thread_id, from_address, at, from_us,
       from_supporter, blob_key, size)
     VALUES ($1, 'policy@pauseai.uk', $2, 't', 'polly.placeholder.mp@parliament.uk', $3, $4, $5, $2, 1)`,
    [letter, `g-${letter}-${hours}`, ago(hours), from === "us", from === "supporter"],
  );
  return `g-${letter}-${hours}`;
}

describeWithDatabase("the health checks", () => {
  useTestDatabase();

  it("answers every group, each with its checks", async () => {
    const groups = await checkAllHealth(NOW);
    expect(groups.map((group) => group.group)).toEqual(HEALTH_GROUP_NAMES);
    expect(Object.keys(groups[4].checks)).toEqual(["letter-replies", "mailing-replies", "broadcast-replies"]);
  });

  it("finds the database answering", async () => {
    expect(await found("technical/database-and-jobs", "database")).toEqual({ status: "ok" });
  });

  it("finds the jobs good when each ran when it was due, and before any has run", async () => {
    expect(await found("technical/database-and-jobs", "jobs")).toEqual({ status: "ok", late: [], goingWrong: [] });
    await allRanOnTime();
    expect(await checkHealth("technical/database-and-jobs", NOW)).toEqual({
      group: "technical/database-and-jobs",
      status: "ok",
      checks: { database: { status: "ok" }, jobs: { status: "ok", late: [], goingWrong: [] } },
    });
  });

  it("finds a job late by its newest run", async () => {
    await allRanOnTime();
    await query("UPDATE import_runs SET at = '2026-11-26T11:15:13Z' WHERE job = 'read-gmail'");
    // An older run doesn't make it later.
    await ran("read-gmail", "2026-11-26T09:00:00Z");
    expect(await checkHealth("technical/database-and-jobs", NOW)).toMatchObject({
      status: "bad",
      checks: {
        jobs: {
          status: "bad",
          late: [
            {
              job: "read-gmail",
              lastRan: "2026-11-26T11:15:13.000Z",
              nextRunWasDue: "2026-11-26T11:20:00.000Z",
              minutesOverdue: 40,
            },
          ],
          goingWrong: [],
        },
      },
    });
  });

  it("finds a job going wrong after three times in a row, failed or with a problem", async () => {
    await allRanOnTime();
    await query("DELETE FROM import_runs WHERE job = 'import-civicrm'");
    await ran("import-civicrm", "2026-11-26T11:49:10Z", "failed");
    await ran("import-civicrm", "2026-11-26T10:49:10Z", "problem");
    expect(await found("technical/database-and-jobs", "jobs")).toMatchObject({ status: "ok", goingWrong: [] });
    await ran("import-civicrm", "2026-11-26T09:49:10Z", "failed");
    expect(await found("technical/database-and-jobs", "jobs")).toEqual({
      status: "bad",
      late: [],
      goingWrong: [{ job: "import-civicrm", runs: 3 }],
    });
  });

  it("doesn't count one failure tried again at once as three", async () => {
    await allRanOnTime();
    await ran("import-civicrm", "2026-11-26T11:49:11Z", "failed");
    await ran("import-civicrm", "2026-11-26T11:49:12Z", "failed");
    await ran("import-civicrm", "2026-11-26T11:49:14Z", "failed");
    expect(await found("technical/database-and-jobs", "jobs")).toMatchObject({ status: "ok", goingWrong: [] });
  });

  it("finds email sending good until the three newest tries all failed", async () => {
    expect(await found("technical/sending", "email-sending")).toEqual({ status: "ok", failedInARow: 0 });
    await tried("sent", 30);
    await tried("failed", 20);
    await tried("failed", 10);
    expect(await found("technical/sending", "email-sending")).toEqual({ status: "ok", failedInARow: 2 });
    await tried("failed", 5);
    expect(await found("technical/sending", "email-sending")).toEqual({ status: "bad", failedInARow: 3 });
    // One refused for a blocked address was never tried, and an imported one wasn't ours to send.
    await tried("refused", 2);
    await tried("sent", 1, true);
    expect(await found("technical/sending", "email-sending")).toEqual({ status: "bad", failedInARow: 3 });
    await tried("sent", 0);
    expect(await found("technical/sending", "email-sending")).toEqual({ status: "ok", failedInARow: 0 });
  });

  it("finds WhatsApp sending bad when fewer than half of enough texts arrived", async () => {
    expect(await found("technical/sending", "whatsapp-sending")).toEqual({ status: "ok", handed: 0, delivered: 0 });
    await broadcast("text", 50, 24, 24);
    expect(await checkHealth("technical/sending", NOW)).toMatchObject({
      status: "bad",
      checks: { "whatsapp-sending": { status: "bad", handed: 50, delivered: 24 } },
    });
  });

  it("counts only texts, handed over long enough ago to have arrived, and not long ago", async () => {
    await broadcast("text", 30, 24, 30);
    // Too new, too old, and an email broadcast.
    await broadcast("text", 100, 1);
    await broadcast("text", 100, 73);
    await broadcast("email", 100, 24);
    expect(await found("technical/sending", "whatsapp-sending")).toEqual({ status: "ok", handed: 30, delivered: 30 });
  });

  it("finds the sign-ups quiet when no one new has come from CiviCRM or Luma for a day", async () => {
    expect(await checkHealth("product/sign-ups", NOW)).toEqual({
      group: "product/sign-ups",
      status: "bad",
      checks: {
        "new-civicrm-people": { status: "bad", hoursSinceLast: null, limitHours: 24 },
        "new-luma-sign-ups": { status: "bad", hoursSinceLast: null, limitHours: 24 },
      },
    });
    await query(
      `INSERT INTO civicrm_contacts (contact_id, email, on_hold, no_bulk_email, do_not_email, do_not_phone, do_not_sms,
         newsletter, volunteer_updates, on_hold_since, no_bulk_email_since, do_not_email_since, do_not_phone_since,
         do_not_sms_since, newsletter_since, volunteer_updates_since, first_seen_at)
       SELECT n, 'jane' || n || '@example.com', false, false, false, false, false, 'subscribed', 'not_on_list',
         now(), now(), now(), now(), now(), now(), now(), t FROM unnest($1::timestamptz[]) WITH ORDINALITY AS x(t, n)`,
      [[ago(30), ago(2)]],
    );
    await query(
      "INSERT INTO luma_events (id, name, url, start_at, access) VALUES ('evt', 'A march', 'evt', now(), 'manage')",
    );
    await query("INSERT INTO luma_people (user_id, email, name) VALUES ('usr', 'jane@example.com', 'Jane')");
    await query(
      `INSERT INTO luma_guests (id, event_id, user_id, approval_status, registered_at) VALUES ('gst', 'evt', 'usr', 'approved', $1)`,
      [ago(25)],
    );
    expect(await checkHealth("product/sign-ups", NOW)).toMatchObject({
      status: "bad",
      checks: {
        "new-civicrm-people": { status: "ok", hoursSinceLast: 2 },
        "new-luma-sign-ups": { status: "bad", hoursSinceLast: 25 },
      },
    });
    await query("UPDATE luma_guests SET registered_at = $1", [ago(1)]);
    expect((await checkHealth("product/sign-ups", NOW)).status).toBe("ok");
  });

  it("finds the letters quiet when no supporter has written for four days", async () => {
    const polly = await addTestPolitician();
    await addTestLetter({ politicianId: polly, createdAt: ago(97).toISOString() });
    // A letter of a mailing isn't one a supporter wrote.
    await mailing(1, 1);
    expect(await found("product/letters-written", "letters-written")).toEqual({
      status: "bad",
      hoursSinceLast: 97,
      limitHours: 96,
    });
    await addTestLetter({ politicianId: polly, createdAt: ago(5).toISOString(), senderEmail: "sam2@example.com" });
    expect(await found("product/letters-written", "letters-written")).toMatchObject({
      status: "ok",
      hoursSinceLast: 5,
    });
  });

  it("finds the replies to supporters' letters quiet when no politician has replied for three days", async () => {
    const letter = await addTestLetter({ politicianId: await addTestPolitician() });
    await reply(letter, 80);
    // Ours, the supporter's own, and a reply to a mailing's letter aren't a politician answering a supporter.
    await reply(letter, 3, "us");
    await reply(letter, 2, "supporter");
    await reply((await mailing(1, 100)).letter, 1);
    expect(await found("product/replies", "letter-replies")).toEqual({
      status: "bad",
      hoursSinceLast: 80,
      limitHours: 72,
    });
    await reply(letter, 10);
    expect(await found("product/replies", "letter-replies")).toMatchObject({ status: "ok", hoursSinceLast: 10 });
  });

  it("finds a mailing unanswered when it went to enough, days ago, and no politician has replied", async () => {
    const sent = await mailing(20, 5 * 24);
    expect(await found("product/replies", "mailing-replies")).toEqual({
      status: "bad",
      unanswered: [{ id: sent.id, sent: ago(5 * 24).toISOString() }],
    });
    // Our own message in the thread, and an automatic reply, aren't an answer.
    await reply(sent.letter, 100, "us");
    const auto = await reply(sent.letter, 99);
    await query(
      "INSERT INTO letter_events (letter_id, status, details) VALUES ($1, 'auto_reply', jsonb_build_object('gmailMessageId', $2::text))",
      [sent.letter, auto],
    );
    expect(await found("product/replies", "mailing-replies")).toMatchObject({ status: "bad" });
    await reply(sent.letter, 50);
    expect(await found("product/replies", "mailing-replies")).toEqual({ status: "ok", unanswered: [] });
  });

  it("doesn't ask of a mailing that's small, new or old", async () => {
    await mailing(19, 5 * 24);
    await mailing(20, 2 * 24);
    await mailing(20, 15 * 24);
    expect(await found("product/replies", "mailing-replies")).toEqual({ status: "ok", unanswered: [] });
  });

  it("finds a broadcast unanswered when it went to enough for its channel, days ago, and nothing came back", async () => {
    const text = await broadcast("text", 200, 3 * 24);
    const email = await broadcast("email", 2000, 3 * 24);
    // Too small for its channel, too new and too old.
    await broadcast("text", 199, 3 * 24);
    await broadcast("email", 1999, 3 * 24);
    await broadcast("text", 200, 24);
    await broadcast("text", 200, 15 * 24);
    expect(await checkHealth("product/replies", NOW)).toMatchObject({
      status: "bad",
      checks: {
        "broadcast-replies": {
          status: "bad",
          unanswered: [
            { id: text, sent: ago(3 * 24).toISOString() },
            { id: email, sent: ago(3 * 24).toISOString() },
          ],
        },
      },
    });
    // Anything that came back counts, an automatic reply too.
    await query(
      `INSERT INTO broadcast_replies (message_id, received_at, from_address, subject, account, gmail_message_id,
         gmail_thread_id, blob_key, automatic)
       SELECT min(id), now(), 'jane@example.com', 'Out of office', 'policy@pauseai.uk', 'g' || mailing_id, 't', 'k', true
       FROM broadcast_messages WHERE mailing_id = ANY($1) GROUP BY mailing_id`,
      [[text, email]],
    );
    expect(await found("product/replies", "broadcast-replies")).toEqual({ status: "ok", unanswered: [] });
  });
});
