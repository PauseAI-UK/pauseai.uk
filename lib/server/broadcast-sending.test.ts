import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { staffCopy } from "@/lib/content/staff-interface";
import { query } from "@/lib/server/db";
import { staffTime } from "@/lib/staff-time";
import { addFollower, EVENT_WORDS } from "@/tests/broadcast-fixtures";
import { connectTestGmail, describeWithDatabase, refuseWrites, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { recordGmail } from "@/tests/gmail-sends";
import { notifications, NOTIFICATIONS } from "@/tests/notifications";
import { createBroadcastDraft } from "./broadcast-drafts";
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

/** An hour on from every try at an email so far, so a broadcast one of them failed for is rested. */
const rested = () => query("UPDATE email_sends SET at = at - interval '1 hour'");

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
      staffCopy.notifications.broadcastGaveUp.body("See you there", "pull", 1, "").trim(),
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
      staffCopy.notifications.broadcastGaveUp.body("See you there", "civicrm", 2, "").trim(),
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
    // Four days on, still sending, CiviCRM doesn't answer.
    vi.setSystemTime(new Date("2026-11-06T10:18:00Z"));
    await query("UPDATE email_sends SET at = at - interval '1 day'");
    server.use(http.post(CHECK, () => new HttpResponse("Down", { status: 503 })));
    await inRun(() => sendDueBroadcasts(LATER, 0));
    expect(await stateOf(id)).toEqual({ state: "sending", waiting: true, reason: "civicrm", gaveUp: false });
    expect((await copies()).map((copy) => copy.status).sort()).toEqual(["scheduled", "sent"]);
    expect(sent.map((email) => email.Subject)).toEqual([
      staffCopy.notifications.broadcastWaiting.subject("See you there"),
    ]);
    expect(sent[0].TextBody).toContain(staffTime(new Date("2026-11-09T10:18:00Z")));
    // Three days of that stops it.
    vi.setSystemTime(new Date("2026-11-09T10:18:00Z"));
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

    server.use(http.post(POSTMARK, () => new HttpResponse("Down", { status: 500 })));
    await broadcast("email:events:yes", "postmark");
    await startDueBroadcasts();
    // Jane alone, as the address that bounced isn't sent to.
    expect((await inRun(() => sendDueBroadcasts(LATER))).failed).toBe(1);

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

  it("fails a copy Gmail refuses for itself, and rests its broadcast, so nothing fails everyone", async () => {
    const refused = recordGmail(() => new HttpResponse("Bad", { status: 400 }));
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    await addFollower("usr-pat", "pat@example.com", "Pat");
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ sent: 0, failed: 1, left: 2 });
    expect((await copies()).map((copy) => copy.status).sort()).toEqual(["failed", "scheduled", "scheduled"]);
    // Called again at once, as the background function does while anything is sending, it tries no other.
    expect(await inRun(() => sendDueBroadcasts(LATER, 0))).toMatchObject({ sent: 0, failed: 0, left: 2 });
    expect(refused).toHaveLength(1);
    // Another broadcast goes meanwhile.
    const gmail = recordGmail();
    const other = await broadcast();
    await startDueBroadcasts();
    expect(await sendDueBroadcasts(LATER, 0)).toMatchObject({ sent: 3, failed: 0, left: 2 });
    expect((await stateOf(other)).state).toBe("sent");
    // Rested, it goes on with the rest.
    await rested();
    expect(await sendDueBroadcasts(LATER, 0)).toMatchObject({ sent: 2, failed: 0, left: 0 });
    expect(gmail).toHaveLength(5);
  });

  it("fails alone a copy whose address CiviCRM's answer leaves out, reporting it, and sends the rest", async () => {
    const gmail = recordGmail();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-pat", "pat@example.com", "Pat");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    server.use(
      http.post(CHECK, () =>
        HttpResponse.json({
          values: [
            { email: "jane@example.com", block: "none" },
            { email: "pat@example.com", block: "none" },
          ],
        }),
      ),
    );
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    const { run, problems } = await inRun(async (r) => ({
      run: await sendDueBroadcasts(LATER, 0),
      problems: r.problems,
    }));
    expect(run).toEqual({ sent: 2, skipped: 0, failed: 1, waiting: 0, left: 0 });
    expect((await copies()).map((copy) => [copy.address, copy.status])).toEqual([
      ["jane@example.com", "sent"],
      ["pat@example.com", "sent"],
      ["sam@example.com", "failed"],
    ]);
    expect(gmail).toHaveLength(2);
    expect(problems.map((p) => p.what)).toEqual([staffCopy.problems.anywhere.sendFailed("broadcast")]);
    // It doesn't wait, as CiviCRM answered.
    expect(await stateOf(id)).toEqual({ state: "sent", waiting: false, reason: null, gaveUp: false });
  });

  it("waits, failing none, when CiviCRM's answer leaves out half its addresses or more, as that's no answer", async () => {
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
      staffCopy.notifications.broadcastGaveUp.body("See you there", "limit", 1, "").trim(),
    );
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
    // A run took Jane's copy and Pat's, gave Jane's its link to send it, and stopped; another is taking Sam's now.
    await query(
      `UPDATE broadcast_messages SET status = 'sending',
         link_token_hash = CASE address WHEN 'jane@example.com' THEN 'hash' END,
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
    expect((await copies()).map((copy) => copy.status)).toEqual(["scheduled"]);
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

  it("go by the fixture build's backend, and wait on the live site, where none sends them", async () => {
    await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: "+447700900123" });
    const id = (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!;
    await query(
      `UPDATE mailings SET body = $2, due_at = $3, state = 'scheduled', sent_from = '+447700900000', from_name = 'PauseAI UK'
       WHERE id = $1`,
      [id, JSON.stringify(EVENT_WORDS), DUE],
    );
    expect(await startDueBroadcasts()).toEqual([id]);
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 0, waiting: 1 });
    vi.stubEnv("DATA_FIXTURES", "1");
    // One whose words can't be made goes back, to go next run.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const values = await query("SELECT id, merge_values FROM broadcast_messages");
    await query("UPDATE broadcast_messages SET merge_values = NULL");
    expect(await inRun(() => sendDueBroadcasts(LATER))).toMatchObject({ sent: 0, failed: 0, left: 1 });
    await query("UPDATE broadcast_messages SET merge_values = $1", [values[0].merge_values]);
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 1, waiting: 0 });
    expect((await stateOf(id)).state).toBe("sent");
  });

  it("fails one a run took and stopped before finishing with, as nothing says whether it went", async () => {
    await addFollower("usr-jane", "jane@example.com", "Jane Smith", { phone: "+447700900123" });
    const id = (await createBroadcastDraft("jo@pauseai.uk", { contact: "text:events:yes" }))!;
    await query(
      `UPDATE mailings SET body = $2, due_at = $3, state = 'scheduled', sent_from = '+447700900000', from_name = 'PauseAI UK'
       WHERE id = $1`,
      [id, JSON.stringify(EVENT_WORDS), DUE],
    );
    await startDueBroadcasts();
    await query("UPDATE broadcast_messages SET status = 'sending', sending_since = now() - interval '40 minutes'");
    vi.stubEnv("DATA_FIXTURES", "1");
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 0, failed: 1 });
    expect(await query("SELECT status FROM broadcast_messages")).toEqual([{ status: "failed" }]);
  });
});
