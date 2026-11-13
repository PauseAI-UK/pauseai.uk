import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { staffCopy } from "@/lib/content/staff-interface";
import { query } from "@/lib/server/db";
import { staffTime } from "@/lib/staff-time";
import { addFollower, addTemplate, EVENT_WORDS } from "@/tests/broadcast-fixtures";
import { connectTestGmail, describeWithDatabase, refuseWrites, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { recordGmail } from "@/tests/gmail-sends";
import { notifications, NOTIFICATIONS } from "@/tests/notifications";
import { createBroadcastDraft, resumeBroadcast } from "./broadcast-drafts";
import { sendDueBroadcasts, startDueBroadcasts } from "./broadcast-sending";
import { hashOf } from "./email-settings";
import { recordOptOut } from "./opt-outs";
import { recordProblem } from "./email";
import { inRun } from "./run-store";

const POSTMARK = "https://api.postmarkapp.com/email";
const HELLO = "hello@pauseai.uk";
const CHECK = "https://crm.pauseai.info/civicrm/ajax/api4/PauseaiChapterContact/checkSuppression";
const DUE = "2026-11-02T09:00:00Z";
const LATER = Date.parse("2099-01-01T00:00:00Z");

type Sent = {
  To: string;
  From: string;
  Subject: string;
  TextBody: string;
  HtmlBody: string;
  Headers: { Name: string; Value: string }[];
  MessageStream: string;
};

/**
 * Postmark taking every email on its broadcast stream, but those `refuse`
 * says no to, as an address it suppressed; each it got. Emails on its other
 * stream, staff's, it takes and leaves out.
 */
function postmark(refuse: (email: Sent) => boolean = () => false) {
  const sent: Sent[] = [];
  server.use(
    http.post(POSTMARK, async ({ request }) => {
      const email = (await request.json()) as Sent;
      if (email.MessageStream !== "broadcast") return HttpResponse.json({ ErrorCode: 0, MessageID: "staff" });
      sent.push(email);
      return refuse(email)
        ? HttpResponse.json({ ErrorCode: 406, Message: "Inactive" }, { status: 422 })
        : HttpResponse.json({ ErrorCode: 0, MessageID: `pm-${sent.length}` });
    }),
  );
  return sent;
}

/** A broadcast by email under `contact`, due at DUE, scheduled by jo, to go by Gmail unless `sendBy` says; its ID. */
async function broadcast(contact: string | string[] = "email:events:yes", sendBy = "gmail"): Promise<number> {
  const id = (await createBroadcastDraft("jo@pauseai.uk", { contact }))!;
  await query(
    `UPDATE mailings SET subject = 'See you there', body = $2, due_at = $3, state = 'scheduled', send_by = $4
     WHERE id = $1`,
    [id, JSON.stringify(EVENT_WORDS), DUE, sendBy],
  );
  await query("INSERT INTO audit_log (actor, action, details) VALUES ('sam@pauseai.uk', 'schedule broadcast', $1)", [
    JSON.stringify({ id, recipients: 1 }),
  ]);
  return id;
}

/** A complete CiviCRM pull, just now. */
const pulled = () =>
  query("INSERT INTO import_runs (job, status, started_by) VALUES ('import-civicrm', 'ok', 'nightly')");

const copies = () =>
  query<{ address: string; status: string; skip: string | null; topics: string[]; sent: boolean }>(
    `SELECT address, status, skip_reason AS skip, topics, sent_at IS NOT NULL AS sent FROM broadcast_messages ORDER BY address`,
  );

const stateOf = async (id: number) =>
  (
    await query<{ state: string; waiting: boolean; reason: string | null; gaveUp: boolean }>(
      `SELECT state, waiting_since IS NOT NULL AS waiting, wait_reason AS reason, gave_up AS "gaveUp" FROM mailings WHERE id = $1`,
      [id],
    )
  )[0];

beforeEach(() => {
  vi.stubEnv("CIVICRM_CHAPTER_KEY", "k");
  vi.stubEnv("POSTMARK_SERVER_TOKEN", "token");
  vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
  vi.setSystemTime(new Date("2026-11-02T10:18:00Z"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/** hello@ having sent `n` emails in the last day. */
const sentToday = (n: number) =>
  query(
    `INSERT INTO email_sends (purpose, address, outcome, message_id, backend, sender)
     SELECT 'broadcast', 'x' || i || '@example.com', 'sent', 'earlier-' || i, 'gmail', $2
     FROM generate_series(1, $1::int) i`,
    [n, HELLO],
  );

/** An hour on from the last failed try at a copy of each broadcast, so each is rested. */
const rested = () => query("UPDATE mailings SET try_failed_at = try_failed_at - interval '1 hour'");

describeWithDatabase("sending broadcasts", () => {
  useTestDatabase();
  beforeEach(() => connectTestGmail(HELLO));

  it("starts one that's due, a copy each, and sends them by hello@'s Gmail with their unsubscribe links and its files", async () => {
    const gmail = recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam Jones");
    await pulled();
    const id = await broadcast();
    await query(
      "INSERT INTO mailing_attachments (mailing_id, filename, content_type, content) VALUES ($1, 'map.txt', 'text/plain', 'Here')",
      [id],
    );
    expect(await startDueBroadcasts()).toEqual([id]);
    // At a pace, one after another.
    expect(await sendDueBroadcasts(LATER, 1)).toEqual({ sent: 2, skipped: 0, failed: 0, waiting: 0, left: 0 });
    expect(await copies()).toEqual([
      { address: "jane@example.com", status: "sent", skip: null, topics: ["events"], sent: true },
      { address: "sam@example.com", status: "sent", skip: null, topics: ["events"], sent: true },
    ]);
    const jane = gmail.find((email) => email.headers.get("to")!.includes("jane@"))!;
    const token = /\/api\/unsubscribe\/([\w-]+)>/.exec(jane.headers.get("list-unsubscribe")!)![1];
    const [{ hash, rfc }] = await query<{ hash: string; rfc: string }>(
      `SELECT link_token_hash AS hash, rfc_message_id AS rfc FROM broadcast_messages WHERE address = 'jane@example.com'`,
    );
    // Only the token's hash is kept.
    expect(hash).toBe(hashOf(token));
    expect(jane.account).toBe(HELLO);
    expect(Object.fromEntries(jane.headers)).toMatchObject({
      to: '"Jane Smith" <jane@example.com>',
      from: '"PauseAI UK" <hello@pauseai.uk>',
      subject: "See you there",
      "message-id": `<${rfc}>`,
      "list-unsubscribe": `<https://pauseai.uk/api/unsubscribe/${token}>`,
      "list-unsubscribe-post": "List-Unsubscribe=One-Click",
    });
    expect(jane.raw.match(/^Message-ID:/gim)).toHaveLength(1);
    expect(jane.raw).toContain("map.txt");
    expect(jane.text).toContain("Hi Jane, see you there.");
    expect(jane.text).toContain(emailSettingsCopy.footer.text(`https://pauseai.uk/contact-preferences/m/${token}`));
    expect(jane.html).toContain(`href="https://pauseai.uk/contact-preferences/m/${token}"`);
    expect(await stateOf(id)).toEqual({ state: "sent", waiting: false, reason: null, gaveUp: false });
    expect(await query("SELECT kind FROM broadcast_message_events ORDER BY id")).toEqual([
      { kind: "sent" },
      { kind: "sent" },
    ]);
    expect(
      await query("SELECT purpose, backend, sender, broadcast_message_id IS NOT NULL AS copy FROM email_sends"),
    ).toEqual([
      { purpose: "broadcast", backend: "gmail", sender: HELLO, copy: true },
      { purpose: "broadcast", backend: "gmail", sender: HELLO, copy: true },
    ]);
    expect(await query("SELECT action FROM audit_log WHERE actor = 'send-mailings' ORDER BY id")).toEqual([
      { action: "start mailing" },
      { action: "finish mailing" },
    ]);
  });

  it("sends by Postmark's broadcast stream one that says so, at no pace of ours", async () => {
    const sent = postmark();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await pulled();
    const id = await broadcast("email:events:yes", "postmark");
    await startDueBroadcasts();
    expect(await sendDueBroadcasts(LATER)).toEqual({ sent: 1, skipped: 0, failed: 0, waiting: 0, left: 0 });
    const [{ rfc }] = await query<{ rfc: string }>("SELECT rfc_message_id AS rfc FROM broadcast_messages");
    expect(sent).toEqual([
      expect.objectContaining({
        To: '"Jane Smith" <jane@example.com>',
        From: '"PauseAI UK" <hello@pauseai.uk>',
        MessageStream: "broadcast",
        Headers: [
          expect.objectContaining({ Name: "List-Unsubscribe" }),
          { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
          { Name: "Message-ID", Value: `<${rfc}>` },
        ],
      }),
    ]);
    expect(await query("SELECT backend, broadcast_message_id IS NOT NULL AS copy FROM email_sends")).toEqual([
      { backend: "postmark", copy: true },
    ]);
    expect((await stateOf(id)).state).toBe("sent");
  });

  it("starts none overnight, nor one not due", async () => {
    await pulled();
    await broadcast();
    vi.setSystemTime(new Date("2026-11-02T05:18:00Z"));
    expect(await startDueBroadcasts()).toEqual([]);
    vi.setSystemTime(new Date("2026-11-02T08:18:00Z"));
    expect(await startDueBroadcasts()).toEqual([]);
  });

  it("waits while no CiviCRM pull has finished for a day, telling staff once, and goes once one has", async () => {
    const sent = notifications();
    const gmail = recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    const id = await broadcast();
    expect(await startDueBroadcasts()).toEqual([]);
    expect(await startDueBroadcasts()).toEqual([]);
    expect(await stateOf(id)).toEqual({ state: "scheduled", waiting: true, reason: "pull", gaveUp: false });
    expect(sent).toEqual([
      expect.objectContaining({
        To: expect.stringContaining(`<${NOTIFICATIONS}>`),
        Cc: "sam@pauseai.uk",
        Subject: staffCopy.notifications.broadcastWaiting.subject("See you there"),
      }),
    ]);
    await pulled();
    expect(await startDueBroadcasts()).toEqual([id]);
    expect(await stateOf(id)).toEqual({ state: "sending", waiting: false, reason: null, gaveUp: false });
    await sendDueBroadcasts(LATER, 0);
    expect(gmail).toHaveLength(1);
  });

  it("stops one still waiting three days after its time, and tells whoever scheduled it", async () => {
    const sent = notifications();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    const id = await broadcast();
    await startDueBroadcasts();
    vi.setSystemTime(new Date("2026-11-05T10:17:00Z"));
    await startDueBroadcasts();
    expect(await stateOf(id)).toEqual({ state: "scheduled", waiting: true, reason: "pull", gaveUp: false });
    vi.setSystemTime(new Date("2026-11-05T10:18:00Z"));
    await startDueBroadcasts();
    expect(await stateOf(id)).toEqual({ state: "cancelled", waiting: true, reason: "pull", gaveUp: true });
    expect(sent.map((email) => email.Subject)).toEqual([
      staffCopy.notifications.broadcastWaiting.subject("See you there"),
      staffCopy.notifications.broadcastGaveUp.subject("See you there", "pull"),
    ]);
    // It says when it stops: three days from when it began to wait.
    expect(sent[0].TextBody).toContain(staffTime(new Date("2026-11-05T10:18:00Z")));
    // It never started, so who it didn't reach is everyone it would go to.
    expect(sent[1].TextBody).toContain(
      staffCopy.notifications.broadcastGaveUp.body("See you there", "pull", 1, "", "email").trim(),
    );
    expect(await query("SELECT details FROM audit_log WHERE action = 'stop broadcast'")).toEqual([
      { details: { id, was: "scheduled" } },
    ]);
  });

  it("checks each copy just before it goes: an opt-out since, a block, or CiviCRM's say skips it", async () => {
    recordGmail();
    for (const [n, email] of ["out", "blocked", "bulk", "bulklifted", "all", "fine"].entries()) {
      await addFollower(`usr-${n}`, `${email}@example.com`, email);
    }
    // bulklifted@ lifted "No bulk emails" on the settings page, and it hasn't reached CiviCRM yet.
    await query(
      `WITH c AS (INSERT INTO preference_choices (address, way, topic, wording)
                  VALUES ('bulklifted@example.com', 'email', 'bulk', 'Yes') RETURNING id)
       INSERT INTO civicrm_updates (choice_id, change, email, occurred_at, source, wording)
       SELECT id, 'allow_bulk_email', 'bulklifted@example.com', now(), 'pauseai.uk', 'Yes' FROM c`,
    );
    server.use(
      http.post(CHECK, async ({ request }) => {
        const { email } = JSON.parse(new URLSearchParams(await request.text()).get("params")!) as { email: string[] };
        return HttpResponse.json({
          values: email.map((address) => ({
            email: address,
            block: address.startsWith("bulk") ? "bulk" : address.startsWith("all") ? "all" : "none",
          })),
        });
      }),
    );
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    await recordOptOut({
      address: "out@example.com",
      list: "events",
      source: "link",
      sourceRef: "1",
      unsubscribedAt: new Date(),
    });
    await recordProblem({
      address: "blocked@example.com",
      messageId: null,
      kind: "hard",
      reason: "Gone",
      canReset: true,
    });
    expect(await sendDueBroadcasts(LATER, 0)).toEqual({ sent: 1, skipped: 5, failed: 0, waiting: 0, left: 0 });
    expect((await copies()).map((copy) => [copy.address, copy.status, copy.skip])).toEqual([
      ["all@example.com", "skipped", "suppressed"],
      ["blocked@example.com", "skipped", "blocked"],
      ["bulk@example.com", "skipped", "suppressed"],
      ["bulklifted@example.com", "skipped", "suppressed"],
      ["fine@example.com", "sent", null],
      ["out@example.com", "skipped", "unsubscribed"],
    ]);
    expect(
      await query("SELECT address, list, source FROM opt_outs WHERE source = 'civicrm-check' ORDER BY address"),
    ).toEqual([
      { address: "all@example.com", list: "all", source: "civicrm-check" },
      { address: "bulk@example.com", list: "bulk", source: "civicrm-check" },
    ]);
    expect((await stateOf(id)).state).toBe("sent");
  });

  it("sends nothing to those PauseAI Global says not to email at all", async () => {
    const gmail = recordGmail();
    await addFollower("usr-all", "all@example.com", "All");
    server.use(http.post(CHECK, () => HttpResponse.json({ values: [{ email: "all@example.com", block: "all" }] })));
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    expect(await sendDueBroadcasts(LATER, 0)).toMatchObject({ sent: 0, skipped: 1 });
    expect(gmail).toEqual([]);
  });

  it("skips a copy whose consent ended, as no permission", async () => {
    recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    await query("UPDATE luma_people SET contact_since = NULL");
    await sendDueBroadcasts(LATER, 0);
    expect((await copies()).map((copy) => copy.skip)).toEqual(["no-permission"]);
  });

  it("sends nothing unchecked: CiviCRM not answering has it wait, and say so", async () => {
    const sent = notifications();
    const gmail = recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    server.use(http.post(CHECK, () => new HttpResponse("Down", { status: 503 })));
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    const { run, problems } = await inRun(async (r) => ({
      run: await sendDueBroadcasts(LATER, 0),
      problems: r.problems,
    }));
    expect(run).toEqual({ sent: 0, skipped: 0, failed: 0, waiting: 1, left: 1 });
    expect(problems.map((p) => p.what)).toEqual([staffCopy.problems.job.civicrmCheckFailed]);
    expect(gmail).toEqual([]);
    expect(await stateOf(id)).toEqual({ state: "sending", waiting: true, reason: "civicrm", gaveUp: false });
    expect(sent.map((email) => email.Subject)).toEqual([
      staffCopy.notifications.broadcastWaiting.subject("See you there"),
    ]);
    // CiviCRM answers again: it goes, and waits no more.
    server.resetHandlers();
    recordGmail();
    await sendDueBroadcasts(LATER, 0);
    expect(await stateOf(id)).toEqual({ state: "sent", waiting: false, reason: null, gaveUp: false });
  });

  it("stops one that started but CiviCRM hasn't answered for three days, telling who it didn't reach", async () => {
    const sent = notifications();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    server.use(http.post(CHECK, () => new HttpResponse("Down", { status: 503 })));
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    await inRun(() => sendDueBroadcasts(LATER, 0));
    vi.setSystemTime(new Date("2026-11-05T10:18:00Z"));
    await inRun(() => sendDueBroadcasts(LATER, 0));
    expect(await stateOf(id)).toEqual({ state: "cancelled", waiting: true, reason: "civicrm", gaveUp: true });
    expect((await copies()).map((copy) => copy.status)).toEqual(["cancelled", "cancelled"]);
    expect(sent.at(-1)!.TextBody).toContain(
      staffCopy.notifications.broadcastGaveUp.body("See you there", "civicrm", 2, "", "email").trim(),
    );
  });

  it("goes on waiting, not stopping, when CiviCRM first fails days into sending: its three days run from then", async () => {
    const sent = notifications();
    recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    // One goes, and hello@ is at its limit for the day.
    await sentToday(1799);
    await sendDueBroadcasts(LATER, 0);
    // Three days on, still sending, CiviCRM doesn't answer: its three days of waiting end before its seven do.
    vi.setSystemTime(new Date("2026-11-05T10:18:00Z"));
    await query("UPDATE email_sends SET at = at - interval '1 day'");
    server.use(http.post(CHECK, () => new HttpResponse("Down", { status: 503 })));
    await inRun(() => sendDueBroadcasts(LATER, 0));
    expect(await stateOf(id)).toEqual({ state: "sending", waiting: true, reason: "civicrm", gaveUp: false });
    expect((await copies()).map((copy) => copy.status).sort()).toEqual(["scheduled", "sent"]);
    expect(sent.map((email) => email.Subject)).toEqual([
      staffCopy.notifications.broadcastWaiting.subject("See you there"),
    ]);
    expect(sent[0].TextBody).toContain(staffTime(new Date("2026-11-08T10:18:00Z")));
    // Three days of that stops it.
    vi.setSystemTime(new Date("2026-11-08T10:18:00Z"));
    await inRun(() => sendDueBroadcasts(LATER, 0));
    expect(await stateOf(id)).toEqual({ state: "cancelled", waiting: true, reason: "civicrm", gaveUp: true });
  });

  it("blocks an address Postmark says it suppressed, and fails a copy Postmark or Gmail won't take", async () => {
    postmark((email) => email.To.includes("gone@"));
    await addFollower("usr-gone", "gone@example.com", "Gone");
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await pulled();
    await broadcast("email:events:yes", "postmark");
    await startDueBroadcasts();
    expect(await sendDueBroadcasts(LATER)).toEqual({ sent: 1, skipped: 1, failed: 0, waiting: 0, left: 0 });
    expect(await query("SELECT address FROM email_blocks")).toEqual([{ address: "gone@example.com" }]);

    // Postmark refusing the email itself fails it.
    server.use(http.post(POSTMARK, () => HttpResponse.json({ ErrorCode: 300, Message: "Invalid" }, { status: 422 })));
    await broadcast("email:events:yes", "postmark");
    await startDueBroadcasts();
    // Jane alone, as the address that bounced isn't sent to.
    expect((await inRun(() => sendDueBroadcasts(LATER))).failed).toBe(1);

    // Postmark down: it waits, failed by nobody, as the next would fail the same.
    server.use(http.post(POSTMARK, () => new HttpResponse("Down", { status: 500 })));
    const down = await broadcast("email:events:yes", "postmark");
    await startDueBroadcasts();
    expect(await inRun(() => sendDueBroadcasts(LATER))).toMatchObject({ failed: 0, left: 1 });
    await query("UPDATE broadcast_messages SET status = 'cancelled' WHERE mailing_id = $1", [down]);

    // Gmail down: nothing more goes this run, and its copies wait for the next, none failed.
    recordGmail(() => new HttpResponse("Down", { status: 500 }));
    await addFollower("usr-sam", "sam@example.com", "Sam");
    await broadcast();
    await startDueBroadcasts();
    expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ sent: 0, failed: 0, left: 2 });
    const sams = async () =>
      (await copies()).filter((copy) => copy.address === "sam@example.com").map((copy) => copy.status);
    expect(await sams()).toEqual(["scheduled"]);
    // Nor does Gmail refusing the account, at a quota of its API, which the next copy would meet too.
    await rested();
    const refused = recordGmail(() => new HttpResponse("Quota", { status: 403 }));
    expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ sent: 0, failed: 0, left: 2 });
    expect(refused).toHaveLength(1);
    expect(await sams()).toEqual(["scheduled"]);
  });

  it("fails a copy Gmail refuses for itself and goes on with the rest, as one address's trouble is its own", async () => {
    let tries = 0;
    const gmail = recordGmail(() => (++tries === 1 ? new HttpResponse("Bad", { status: 400 }) : undefined));
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    await addFollower("usr-pat", "pat@example.com", "Pat");
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ sent: 2, failed: 1, left: 0 });
    expect(gmail).toHaveLength(3);
    expect((await stateOf(id)).state).toBe("sent");
  });

  it("rests a broadcast two of whose copies fail in a row, so nothing that fails every copy fails everyone", async () => {
    const refused = recordGmail(() => new HttpResponse("Bad", { status: 400 }));
    for (const name of ["jane", "sam", "pat", "ann"]) await addFollower(`usr-${name}`, `${name}@example.com`, name);
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ sent: 0, failed: 2, left: 2 });
    expect((await copies()).map((copy) => copy.status).sort()).toEqual(["failed", "failed", "scheduled", "scheduled"]);
    // Called again at once, as the background function does while anything is sending, it tries no other.
    expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ sent: 0, failed: 0, left: 2 });
    expect(refused).toHaveLength(2);
    // Another broadcast goes meanwhile.
    const gmail = recordGmail();
    const other = await broadcast();
    await startDueBroadcasts();
    expect(await sendDueBroadcasts(LATER, 0)).toMatchObject({ sent: 4, failed: 0, left: 2 });
    expect((await stateOf(other)).state).toBe("sent");
    // Rested, it goes on with the rest.
    await rested();
    expect(await sendDueBroadcasts(LATER, 0)).toMatchObject({ sent: 2, failed: 0, left: 0 });
    expect(gmail).toHaveLength(6);
  });

  it("stops one whose copies go on failing, five in a row across its rests, telling who scheduled it", async () => {
    const sent = notifications();
    const refused = recordGmail(() => new HttpResponse("Bad", { status: 400 }));
    for (const name of ["jane", "sam", "pat", "ann", "bo", "cy"]) {
      await addFollower(`usr-${name}`, `${name}@example.com`, name);
    }
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    // Two fail, and it rests; each rest after, one more fails, as the failures go on in a row.
    expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ failed: 2, left: 4 });
    for (const left of [3, 2]) {
      await rested();
      expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ failed: 1, left });
      expect((await stateOf(id)).state).toBe("sending");
    }
    // The fifth in a row stops it, and nobody else is tried.
    await rested();
    expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ failed: 1, left: 0 });
    expect(await stateOf(id)).toMatchObject({ state: "cancelled", reason: "failing", gaveUp: true });
    expect(refused).toHaveLength(5);
    expect((await copies()).map((copy) => copy.status).sort()).toEqual([
      "cancelled",
      "failed",
      "failed",
      "failed",
      "failed",
      "failed",
    ]);
    const words = staffCopy.notifications.broadcastGaveUp;
    expect(sent.at(-1)!.Subject).toBe(words.subject("See you there", "failing"));
    expect(sent.at(-1)!.TextBody).toContain(words.body("See you there", "failing", 6, "", "email").trim());
  });

  it("sends, on Resume after it kept failing, to those never tried before those refused, so they can't stop it first", async () => {
    notifications();
    const refused = recordGmail(() => new HttpResponse("Bad", { status: 400 }));
    for (const name of ["ann", "bo", "cy", "di", "ed", "fi", "gus"]) {
      await addFollower(`usr-${name}`, `${name}@example.com`, name);
    }
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    // Five fail, across its rests, and it stops with two never tried.
    await inRun(() => sendDueBroadcasts(LATER, 0));
    for (let rest = 0; rest < 3; rest++) {
      await rested();
      await inRun(() => sendDueBroadcasts(LATER, 0));
    }
    expect((await stateOf(id)).reason).toBe("failing");
    expect(refused).toHaveLength(5);
    const neverTried = await query<{ address: string }>(
      "SELECT address FROM broadcast_messages WHERE status = 'cancelled' ORDER BY id",
    );
    expect(neverTried).toHaveLength(2);
    // Resumed, with Gmail still refusing: the two never tried go first, then the five again.
    expect(await resumeBroadcast(id, "jo@pauseai.uk")).toBe(true);
    const order = recordGmail(() => new HttpResponse("Bad", { status: 400 }));
    await inRun(() => sendDueBroadcasts(LATER, 0));
    expect(order.map((email) => email.headers.get("to")!.match(/<(.*)>/)![1])).toEqual(
      neverTried.map((copy) => copy.address),
    );
  });

  it("counts tries the account or provider refuses towards stopping, as they'd never end, though nobody is failed", async () => {
    notifications();
    const tried = recordGmail(() => new HttpResponse("Insufficient Permission", { status: 403 }));
    for (const name of ["jane", "sam"]) await addFollower(`usr-${name}`, `${name}@example.com`, name);
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    await inRun(() => sendDueBroadcasts(LATER, 0));
    for (let rest = 0; rest < 4; rest++) {
      expect((await stateOf(id)).state).toBe("sending");
      await rested();
      await inRun(() => sendDueBroadcasts(LATER, 0));
    }
    expect(tried).toHaveLength(5);
    expect(await stateOf(id)).toMatchObject({ state: "cancelled", reason: "failing", gaveUp: true });
    // Nobody failed: Resume sends to both.
    expect((await copies()).map((copy) => copy.status)).toEqual(["cancelled", "cancelled"]);
  });

  it("never puts back one that may have gone when keeping its failure fails, so it's never sent twice", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    recordGmail(() => HttpResponse.error());
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    await refuseWrites("broadcast_messages", "NEW.status = 'failed'");
    await inRun(() => sendDueBroadcasts(LATER, 0));
    // Left sending, handed over, for a later run to fail as cut off.
    expect(await query("SELECT status, handed_at IS NOT NULL AS handed FROM broadcast_messages")).toEqual([
      { status: "sending", handed: true },
    ]);
  });

  it("counts failures in a row only: one that goes between them starts the count again", async () => {
    let tries = 0;
    // Every other try fails, so none fail in a row.
    const gmail = recordGmail(() => (++tries % 2 ? new HttpResponse("Bad", { status: 400 }) : undefined));
    for (const name of ["jane", "sam", "pat", "ann", "bo", "cy", "di", "ed", "fi", "gus", "hal", "ivy"]) {
      await addFollower(`usr-${name}`, `${name}@example.com`, name);
    }
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ sent: 6, failed: 6, left: 0 });
    expect(gmail).toHaveLength(12);
    expect((await stateOf(id)).state).toBe("sent");
  });

  it("sends to an address CiviCRM says it hasn't checked, as it may not look everyone up yet: our own records stand", async () => {
    const gmail = recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    server.use(
      http.post(CHECK, () =>
        HttpResponse.json({
          values: [
            { email: "jane@example.com", block: "unchecked" },
            { email: "sam@example.com", block: "none" },
          ],
        }),
      ),
    );
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    expect(await sendDueBroadcasts(LATER, 0)).toEqual({ sent: 2, skipped: 0, failed: 0, waiting: 0, left: 0 });
    expect(gmail).toHaveLength(2);
    expect(await query("SELECT 1 FROM opt_outs")).toEqual([]);
    expect(await stateOf(id)).toEqual({ state: "sent", waiting: false, reason: null, gaveUp: false });
  });

  it("waits, failing none, when CiviCRM's answer leaves an address out, which it says it never does", async () => {
    notifications();
    const gmail = recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    server.use(http.post(CHECK, () => HttpResponse.json({ values: [{ email: "jane@example.com", block: "none" }] })));
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    const { run, problems } = await inRun(async (r) => ({
      run: await sendDueBroadcasts(LATER, 0),
      problems: r.problems,
    }));
    expect(run).toEqual({ sent: 0, skipped: 0, failed: 0, waiting: 1, left: 2 });
    expect(gmail).toEqual([]);
    expect(problems.map((p) => p.what)).toEqual([staffCopy.problems.job.civicrmCheckFailed]);
    expect(await stateOf(id)).toEqual({ state: "sending", waiting: true, reason: "civicrm", gaveUp: false });
  });

  it("sends to someone with no name by their address alone", async () => {
    const gmail = recordGmail();
    await addFollower("usr-nobody", "nobody@example.com", "");
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    expect(await query("SELECT merge_values -> 'name' AS name FROM broadcast_messages")).toEqual([{ name: null }]);
    await sendDueBroadcasts(LATER, 0);
    expect(gmail.map((email) => email.headers.get("to"))).toEqual(["nobody@example.com"]);
  });

  it("puts back copies whose email can't be made, so they go next run, reporting it, failing none", async () => {
    const gmail = recordGmail();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    // A build that doesn't know its own address can't make the unsubscribe link, so nothing goes.
    vi.stubEnv("SITE_ORIGIN", "");
    expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ sent: 0, failed: 0, left: 2 });
    expect((await copies()).map((copy) => copy.status)).toEqual(["scheduled", "scheduled"]);
    expect(gmail).toEqual([]);
    const [{ first }] = await query<{ first: number }>("SELECT min(id)::int AS first FROM broadcast_messages");
    const words = staffCopy.problems.anywhere;
    expect(error.mock.calls.map(([what]) => what)).toContain(words.notSentYet(words.copyOf(first)));
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    expect(await sendDueBroadcasts(LATER, 0)).toMatchObject({ sent: 2, left: 0 });
  });

  it("leaves a copy that went sending when keeping it fails, reporting it, so it's never sent again", async () => {
    const gmail = recordGmail();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    await refuseWrites("broadcast_messages", "NEW.status = 'sent'");
    expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ sent: 0, failed: 0 });
    expect(gmail).toHaveLength(1);
    expect((await copies()).map((copy) => copy.status)).toEqual(["sending"]);
    const [{ id }] = await query<{ id: number }>("SELECT id::int AS id FROM broadcast_messages");
    const words = staffCopy.problems.anywhere;
    expect(error.mock.calls.map(([what]) => what)).toContain(words.sentUnrecorded(words.copyOf(id)));
  });

  it("puts back a copy that didn't go when keeping that fails, so it's tried again", async () => {
    recordGmail(() => new HttpResponse("Bad", { status: 400 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    await refuseWrites("broadcast_messages", "NEW.status = 'failed'");
    expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ sent: 0, failed: 0, left: 1 });
    expect((await copies()).map((copy) => copy.status)).toEqual(["scheduled"]);
  });

  it("sends by Gmail no more than hello@ can today, and the rest the next day", async () => {
    const gmail = recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    await sentToday(1799);
    expect(await sendDueBroadcasts(LATER, 0)).toEqual({ sent: 1, skipped: 0, failed: 0, waiting: 0, left: 1 });
    expect(await sendDueBroadcasts(LATER, 0)).toMatchObject({ sent: 0, left: 1 });
    expect((await stateOf(id)).state).toBe("sending");
    // A day on, what it sent today no longer counts.
    await query("UPDATE email_sends SET at = at - interval '1 day'");
    expect(await sendDueBroadcasts(LATER, 0)).toMatchObject({ sent: 1, left: 0 });
    expect(gmail).toHaveLength(2);
    expect((await stateOf(id)).state).toBe("sent");
  });

  it("sends none by Gmail while hello@'s isn't connected, and fails none", async () => {
    const gmail = recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    await query(
      "UPDATE staff_accounts SET gmail_token = NULL, gmail_connected_at = NULL, gmail_history_id = NULL, gmail_name = NULL",
    );
    expect(await sendDueBroadcasts(LATER, 0)).toEqual({ sent: 0, skipped: 0, failed: 0, waiting: 0, left: 1 });
    expect(gmail).toEqual([]);
  });

  it("stops one that hasn't all gone seven days after its time, not before, telling who it didn't reach and why", async () => {
    const sent = notifications();
    recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    await sentToday(1799);
    await sendDueBroadcasts(LATER, 0);
    // Three days on, though one waiting for CiviCRM would stop, it goes on.
    vi.setSystemTime(new Date("2026-11-05T09:00:00Z"));
    expect(await sendDueBroadcasts(LATER, 0)).toMatchObject({ sent: 0, left: 1 });
    expect((await stateOf(id)).state).toBe("sending");
    vi.setSystemTime(new Date("2026-11-09T09:00:00Z"));
    expect(await sendDueBroadcasts(LATER, 0)).toMatchObject({ sent: 0, left: 0 });
    expect(await stateOf(id)).toEqual({ state: "cancelled", waiting: true, reason: "limit", gaveUp: true });
    expect((await copies()).map((copy) => copy.status).sort()).toEqual(["cancelled", "sent"]);
    expect(sent.at(-1)!.TextBody).toContain(
      staffCopy.notifications.broadcastGaveUp.body("See you there", "limit", 1, "", "email").trim(),
    );
  });

  it("stops one whose seven days run out while CiviCRM is down, saying CiviCRM is why, not its size", async () => {
    const sent = notifications();
    recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    await sentToday(1799);
    await sendDueBroadcasts(LATER, 0);
    // Six days on, CiviCRM goes down, a day before its seven are up.
    vi.setSystemTime(new Date("2026-11-08T09:00:00Z"));
    await query("UPDATE email_sends SET at = at - interval '2 days'");
    server.use(http.post(CHECK, () => new HttpResponse("Down", { status: 503 })));
    await inRun(() => sendDueBroadcasts(LATER, 0));
    expect(await stateOf(id)).toEqual({ state: "sending", waiting: true, reason: "civicrm", gaveUp: false });
    // The email says it stops when its seven days are up, as that's before its three days of waiting are.
    expect(sent.at(-1)!.TextBody).toContain(staffTime(new Date("2026-11-09T09:00:00Z")));
    // Its seven days are up: it stops then, though it hasn't waited three, and CiviCRM is why.
    vi.setSystemTime(new Date("2026-11-09T09:00:00Z"));
    await inRun(() => sendDueBroadcasts(LATER, 0));
    expect(await stateOf(id)).toEqual({ state: "cancelled", waiting: true, reason: "late", gaveUp: true });
    const words = staffCopy.notifications.broadcastGaveUp;
    expect(sent.at(-1)!.Subject).toBe(words.subject("See you there", "late"));
    expect(sent.at(-1)!.TextBody).toContain(words.body("See you there", "late", 1, "", "email").trim());
  });

  it("puts back the copies it took and has no time left to send", async () => {
    const until = Date.now() + 60_000;
    // Sending the first takes the run past its time.
    const gmail = recordGmail(() => {
      vi.setSystemTime(new Date(until));
      return undefined;
    });
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    expect(await sendDueBroadcasts(until, 0)).toEqual({ sent: 1, skipped: 0, failed: 0, waiting: 0, left: 1 });
    expect(gmail).toHaveLength(1);
    expect((await copies()).map((copy) => copy.status).sort()).toEqual(["scheduled", "sent"]);
    expect((await stateOf(id)).state).toBe("sending");
  });

  it("stops sending at the run's end, leaving the rest for the next", async () => {
    recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    expect(await sendDueBroadcasts(0)).toEqual({ sent: 0, skipped: 0, failed: 0, waiting: 0, left: 1 });
    expect((await stateOf(id)).state).toBe("sending");
  });

  it("fails, not sends again, a copy a run handed to its channel and stopped before keeping the answer; one it only took goes", async () => {
    const gmail = recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    await addFollower("usr-pat", "pat@example.com", "Pat");
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    // A run took Jane's copy and Pat's, handed Jane's to Gmail, and stopped; another is taking Sam's now.
    await query(
      `UPDATE broadcast_messages SET status = 'sending',
         handed_at = CASE address WHEN 'jane@example.com' THEN now() - interval '40 minutes' END,
         sending_since = now() - CASE address WHEN 'sam@example.com' THEN interval '1 minute' ELSE interval '40 minutes' END`,
    );
    expect(await sendDueBroadcasts(LATER, 0)).toEqual({ sent: 1, skipped: 0, failed: 1, waiting: 0, left: 0 });
    expect(gmail.map((email) => email.headers.get("to"))).toEqual(['"Pat" <pat@example.com>']);
    expect((await copies()).map((copy) => [copy.address, copy.status])).toEqual([
      ["jane@example.com", "failed"],
      ["pat@example.com", "sent"],
      ["sam@example.com", "sending"],
    ]);
    expect((await stateOf(id)).state).toBe("sending");
  });

  it("sends a copy Gmail couldn't take once, though a later run took it and stopped before reaching it", async () => {
    recordGmail(() => new HttpResponse("Down", { status: 500 }));
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    await inRun(() => sendDueBroadcasts(LATER, 0));
    // Put back, it's as one never handed over.
    expect(await query("SELECT status, handed_at FROM broadcast_messages")).toEqual([
      { status: "scheduled", handed_at: null },
    ]);
    await query("UPDATE broadcast_messages SET status = 'sending', sending_since = now() - interval '40 minutes'");
    await rested();
    const gmail = recordGmail();
    expect(await sendDueBroadcasts(LATER, 0)).toMatchObject({ sent: 1, failed: 0 });
    expect(gmail).toHaveLength(1);
  });

  it("cancels, not sends, a copy a stopped run only took, when its broadcast has been stopped since", async () => {
    const gmail = recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    await query("UPDATE broadcast_messages SET status = 'sending', sending_since = now() - interval '40 minutes'");
    await query("UPDATE mailings SET state = 'cancelled' WHERE id = $1", [id]);
    expect(await sendDueBroadcasts(LATER, 0)).toMatchObject({ sent: 0, failed: 0, left: 0 });
    expect((await copies()).map((copy) => copy.status)).toEqual(["cancelled"]);
    expect(gmail).toEqual([]);
  });

  it("sends one to the newsletter's and events' yeses both under whichever each said yes to", async () => {
    const gmail = recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await query(
      `INSERT INTO form_entries (form, name, email, contact_consent) VALUES ('march-2026-11', 'Sam', 'sam@example.com', true)`,
    );
    await pulled();
    await broadcast(["email:newsletter:yes", "email:events:yes"]);
    await startDueBroadcasts();
    await sendDueBroadcasts(LATER, 0);
    expect((await copies()).map((copy) => [copy.address, copy.topics])).toEqual([["jane@example.com", ["events"]]]);
    expect(gmail).toHaveLength(1);
  });
});

describeWithDatabase("sending texts", () => {
  useTestDatabase();
  beforeEach(() => {
    vi.stubEnv("WHATSAPP_TOKEN", "token");
    vi.stubEnv("WHATSAPP_ACCOUNT_ID", "fixture-account");
  });

  const SEND = /graph\.facebook\.com\/.*\/messages$/;

  /** A text to events' yeses by text, due at DUE, on an approved template, or one `status` says; its ID. */
  async function text(status = "approved"): Promise<number> {
    const id = (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!;
    const template = await addTemplate("March day", { status });
    await query("UPDATE whatsapp_templates SET meta_name = 'march_day_' || id WHERE id = $1", [template]);
    await query(
      `UPDATE mailings SET title = 'March day', body = $2, due_at = $3, state = 'scheduled', sent_from = '+447700900000',
         from_name = 'PauseAI UK', template_id = $4
       WHERE id = $1`,
      [id, JSON.stringify(EVENT_WORDS), DUE, template],
    );
    await query("INSERT INTO audit_log (actor, action, details) VALUES ('sam@pauseai.uk', 'schedule broadcast', $1)", [
      JSON.stringify({ id, recipients: 1 }),
    ]);
    return id;
  }

  /** WhatsApp answering each send as `answer` says, by number; each send it got. */
  function whatsApp(answer: (to: string) => Response | undefined = () => undefined) {
    const sent: { to: string; template: { name: string; components: unknown[] } }[] = [];
    server.use(
      http.post(SEND, async ({ request }) => {
        const body = (await request.json()) as (typeof sent)[number];
        sent.push(body);
        return answer(body.to) ?? HttpResponse.json({ messages: [{ id: `wamid.${body.to}` }] });
      }),
    );
    return sent;
  }

  /** WhatsApp refusing a send with error `code`. */
  const refused = (code: number) => HttpResponse.json({ error: { code, message: "Refused" } }, { status: 400 });

  it("go by WhatsApp, the template filled in for each, and wait where nothing sends them", async () => {
    await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: "+447700900123" });
    const id = await text();
    // As an email does, it waits for a CiviCRM pull.
    expect(await startDueBroadcasts()).toEqual([]);
    expect((await stateOf(id)).reason).toBe("pull");
    await pulled();
    expect(await startDueBroadcasts()).toEqual([id]);
    vi.stubEnv("WHATSAPP_TOKEN", "");
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 0, waiting: 1 });
    vi.stubEnv("WHATSAPP_TOKEN", "token");
    // One whose words can't be made goes back, to go next run.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const values = await query("SELECT id, merge_values FROM broadcast_messages");
    await query("UPDATE broadcast_messages SET merge_values = NULL");
    expect(await inRun(() => sendDueBroadcasts(LATER))).toMatchObject({ sent: 0, failed: 0, left: 1 });
    await query("UPDATE broadcast_messages SET merge_values = $1", [values[0].merge_values]);
    const sent = whatsApp();
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 1, waiting: 0 });
    expect(sent).toEqual([
      expect.objectContaining({
        to: "447700900123",
        template: {
          name: expect.stringMatching(/^march_day_\d+$/),
          language: { code: "en_GB" },
          components: [{ type: "body", parameters: [{ type: "text", parameter_name: "first_name", text: "Jane" }] }],
        },
      }),
    ]);
    expect(await query("SELECT provider_message_id AS id FROM broadcast_messages")).toEqual([
      { id: "wamid.447700900123" },
    ]);
    expect((await stateOf(id)).state).toBe("sent");
  });

  it("checks each number just before it goes: an opt-out since, CiviCRM's Do not SMS, or not on WhatsApp skips it", async () => {
    await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: "+447700900123" });
    await addFollower("usr-sam", "sam@example.com", "Sam Jones", { phone: "+447700900124" });
    await addFollower("usr-ann", "ann@example.com", "Ann Lee", { phone: "+447700900125" });
    await addFollower("usr-bo", "bo@example.com", "Bo Kim", { phone: "+447700900126" });
    let asked: unknown;
    server.use(
      http.post(CHECK, async ({ request }) => {
        asked = JSON.parse(new URLSearchParams(await request.text()).get("params")!);
        return HttpResponse.json({
          values: (asked as { phone: string[] }).phone.map((phone) => ({
            phone,
            do_not_phone: false,
            do_not_sms: phone === "+447700900124",
          })),
        });
      }),
    );
    whatsApp();
    await pulled();
    await text();
    await startDueBroadcasts();
    await recordOptOut({
      address: "+447700900125",
      list: "events",
      way: "text",
      source: "staff",
      sourceRef: "told",
      unsubscribedAt: new Date(),
      recordedBy: "jo@pauseai.uk",
      how: "At the march",
    });
    await query("INSERT INTO whatsapp_unreachable (number) VALUES ('+447700900126')");
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 1, skipped: 3 });
    expect((asked as { phone: string[] }).phone.toSorted()).toEqual([
      "+447700900123",
      "+447700900124",
      "+447700900126",
    ]);
    expect(await copies()).toMatchObject([
      { address: "+447700900123", status: "sent" },
      { address: "+447700900124", status: "skipped", skip: "suppressed" },
      { address: "+447700900125", status: "skipped", skip: "unsubscribed" },
      { address: "+447700900126", status: "skipped", skip: "not-on-whatsapp" },
    ]);
    // CiviCRM's flag is CiviCRM's: none of ours is kept for it.
    expect(await query("SELECT 1 FROM opt_outs WHERE address = '+447700900124'")).toEqual([]);
  });

  it("keeps what WhatsApp refuses: not on WhatsApp, stopped, held a day, too fast for now, or failed", async () => {
    for (const [n, user] of ["jane", "sam", "ann", "bo", "cy"].entries()) {
      await addFollower(`usr-${user}`, `${user}@example.com`, `${user} Smith`, { phone: `+44770090012${n}` });
    }
    const codes: Record<string, number> = {
      "447700900120": 131026,
      "447700900121": 131050,
      "447700900122": 131049,
      "447700900124": 131000,
    };
    whatsApp((to) => (codes[to] ? refused(codes[to]) : undefined));
    await pulled();
    const id = await text();
    await startDueBroadcasts();
    // The one that fails doesn't hold up the rest.
    expect(await inRun(() => sendDueBroadcasts(LATER))).toMatchObject({ sent: 1, skipped: 2, failed: 1 });
    expect(await copies()).toMatchObject([
      { address: "+447700900120", status: "skipped", skip: "not-on-whatsapp" },
      { address: "+447700900121", status: "skipped", skip: "unsubscribed" },
      { address: "+447700900122", status: "scheduled" },
      { address: "+447700900123", status: "sent" },
      { address: "+447700900124", status: "failed" },
    ]);
    expect(await query("SELECT number FROM whatsapp_unreachable")).toEqual([{ number: "+447700900120" }]);
    // The stop is of every text, by WhatsApp, and goes to CiviCRM as Do not SMS.
    expect(await query("SELECT list, source FROM opt_outs WHERE address = '+447700900121' ORDER BY list")).toEqual([
      { list: "events", source: "whatsapp" },
      { list: "newsletter", source: "whatsapp" },
      { list: "volunteering", source: "whatsapp" },
    ]);
    expect(await query("SELECT change, phone FROM civicrm_updates")).toEqual([
      { change: "do_not_sms", phone: "+447700900121" },
    ]);
    // The one held goes no sooner than a day from now, as one never handed over.
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 0, left: 1 });
    expect((await stateOf(id)).state).toBe("sending");
    expect(await query("SELECT handed_at FROM broadcast_messages WHERE address = '+447700900122'")).toEqual([
      { handed_at: null },
    ]);
    // WhatsApp saying too many too fast puts it back, and the text rests.
    await query("UPDATE broadcast_messages SET not_before = now() WHERE address = '+447700900122'");
    codes["447700900122"] = 130429;
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 0, failed: 0, left: 1 });
    delete codes["447700900122"];
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 0, left: 1 });
    await rested();
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 1, left: 0 });
  });

  it("sends no more than our number's daily limit, and the rest the next day", async () => {
    const jane = await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: "+447700900123" });
    whatsApp();
    await pulled();
    // Texts to the fixture number's limit, 250 people, in the last day.
    const earlier = await text();
    await query(
      `WITH earlier AS (
         INSERT INTO mailings (title, subject, audience, channel, topic, filter, body, created_by, sent_from, from_name,
           due_at, state, template_id)
         SELECT title, subject, audience, channel, topic, filter, body, created_by, sent_from, from_name, due_at, 'sent',
           template_id
         FROM mailings, generate_series(1, 250) WHERE id = $1 RETURNING id)
       INSERT INTO broadcast_messages (mailing_id, supporter_id, status, sent_at, address)
       SELECT id, $2, 'sent', now() - interval '1 hour', '+4477009' || lpad(id::text, 5, '0') FROM earlier`,
      [earlier, jane],
    );
    await query("DELETE FROM mailings WHERE id = $1", [earlier]);
    await text();
    await startDueBroadcasts();
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 0, left: 1 });
    await query("UPDATE broadcast_messages SET sent_at = now() - interval '2 days' WHERE address LIKE '+4477009%'");
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 1, left: 0 });
  });

  it("stops one that hasn't all gone seven days after its time, saying our number's daily limit is why, not Gmail's", async () => {
    await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: "+447700900123" });
    const sent = notifications();
    whatsApp();
    await pulled();
    await text();
    await startDueBroadcasts();
    vi.setSystemTime(new Date("2026-11-09T09:00:00Z"));
    await pulled();
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 0, left: 0 });
    const words = staffCopy.notifications.broadcastGaveUp;
    const told = sent.find((email) => email.Subject === words.subject("March day", "limit"))!;
    expect(told.TextBody).toContain(words.body("March day", "limit", 1, "", "text").trim());
    expect(told.TextBody).not.toContain(words.whyGmailLimit);
  });

  it("asks WhatsApp nothing for a text that's resting", async () => {
    await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: "+447700900123" });
    await pulled();
    const id = await text();
    await startDueBroadcasts();
    await query("UPDATE mailings SET try_failed_at = now() WHERE id = $1", [id]);
    const asked: string[] = [];
    server.use(
      http.get(/graph\.facebook\.com\/.*phone_numbers/, ({ request }) => {
        asked.push(request.url);
        return HttpResponse.json({ data: [] });
      }),
    );
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 0, left: 1 });
    expect(asked).toEqual([]);
  });

  it("stops one whose template WhatsApp has paused, telling whoever scheduled it", async () => {
    await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: "+447700900123" });
    const sent = notifications();
    await pulled();
    const id = await text("paused");
    await startDueBroadcasts();
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 0 });
    expect(await stateOf(id)).toMatchObject({ state: "cancelled", gaveUp: true, reason: "template" });
    expect(sent.map((email) => email.Subject)).toContain(
      staffCopy.notifications.broadcastGaveUp.subject("March day", "template"),
    );
  });

  it("rests a text two of whose copies WhatsApp fails in a row, so nothing that fails every copy fails everyone", async () => {
    for (const [n, user] of ["jane", "sam", "ann", "bo"].entries()) {
      await addFollower(`usr-${user}`, `${user}@example.com`, `${user} Smith`, { phone: `+44770090012${n}` });
    }
    const tried = whatsApp(() => refused(131000));
    await pulled();
    await text();
    await startDueBroadcasts();
    expect(await inRun(() => sendDueBroadcasts(LATER))).toMatchObject({ sent: 0, failed: 2, left: 2 });
    // Called again at once, it tries no other.
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 0, failed: 0, left: 2 });
    expect(tried).toHaveLength(2);
    // Rested, it goes on with the rest.
    const sent = whatsApp();
    await rested();
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 2, failed: 0, left: 0 });
    expect(sent).toHaveLength(2);
  });

  it("fails, never sends again, one whose send to WhatsApp broke off, as WhatsApp may have taken it", async () => {
    await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: "+447700900123" });
    whatsApp(() => HttpResponse.error());
    await pulled();
    await text();
    await startDueBroadcasts();
    const { run, problems } = await inRun(async (r) => ({ run: await sendDueBroadcasts(LATER), problems: r.problems }));
    expect(run).toMatchObject({ sent: 0, failed: 1, left: 0 });
    expect(await copies()).toMatchObject([{ address: "+447700900123", status: "failed" }]);
    expect(problems.map((p) => p.what)).toEqual([staffCopy.problems.anywhere.sendFailed("broadcast")]);
    // Kept as cut off, so Resume never sends it again.
    expect(await query("SELECT details FROM broadcast_message_events WHERE kind = 'failed'")).toEqual([
      { details: { unfinished: true } },
    ]);
  });

  it("fails, not sends again, one a run handed to WhatsApp and stopped before keeping the answer; one it only took goes", async () => {
    await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: "+447700900123" });
    await addFollower("usr-sam", "sam@example.com", "Sam Jones", { phone: "+447700900124" });
    const sent = whatsApp();
    await pulled();
    await text();
    await startDueBroadcasts();
    // A run took both, handed Jane's to WhatsApp, and stopped.
    await query(
      `UPDATE broadcast_messages SET status = 'sending', sending_since = now() - interval '40 minutes',
         handed_at = CASE address WHEN '+447700900123' THEN now() - interval '40 minutes' END`,
    );
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 1, failed: 1, left: 0 });
    expect(sent.map((one) => one.to)).toEqual(["447700900124"]);
    expect(await copies()).toMatchObject([
      { address: "+447700900123", status: "failed" },
      { address: "+447700900124", status: "sent" },
    ]);
  });
});
