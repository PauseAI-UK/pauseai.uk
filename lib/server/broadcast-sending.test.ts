import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { emailSettingsCopy } from "@/lib/content/email-settings";
import { staffCopy } from "@/lib/content/staff-interface";
import { query } from "@/lib/server/db";
import { addFollower, EVENT_WORDS } from "@/tests/broadcast-fixtures";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { server } from "@/tests/fixtures/msw";
import { notifications, NOTIFICATIONS } from "@/tests/notifications";
import { createBroadcastDraft } from "./broadcast-drafts";
import { sendDueBroadcasts, startDueBroadcasts } from "./broadcast-sending";
import { hashOf } from "./email-settings";
import { recordOptOut } from "./opt-outs";
import { recordProblem } from "./email";
import { inRun } from "./run-store";

const BATCH = "https://api.postmarkapp.com/email/batch";
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

/** Postmark's batch call taking every email, but those `refuse` says no to; each batch it got. */
function postmark(refuse: (email: Sent) => boolean = () => false) {
  const batches: Sent[][] = [];
  server.use(
    http.post(BATCH, async ({ request }) => {
      const emails = (await request.json()) as Sent[];
      batches.push(emails);
      return HttpResponse.json(
        emails.map((email, i) =>
          refuse(email)
            ? { ErrorCode: 406, Message: "Inactive" }
            : { ErrorCode: 0, MessageID: `pm-${batches.length}-${i}`, To: email.To },
        ),
      );
    }),
  );
  return batches;
}

/** A broadcast by email under `contact`, due at DUE, scheduled by jo; its ID. */
async function broadcast(contact: string | string[] = "email:events:yes"): Promise<number> {
  const id = (await createBroadcastDraft("jo@pauseai.uk", { contact }))!;
  await query(
    `UPDATE mailings SET subject = 'See you there', body = $2, due_at = $3, state = 'scheduled' WHERE id = $1`,
    [id, JSON.stringify(EVENT_WORDS), DUE],
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

describeWithDatabase("sending broadcasts", () => {
  useTestDatabase();

  it("starts one that's due, a copy each, and sends them by Postmark's broadcast stream with their unsubscribe links", async () => {
    const batches = postmark();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam Jones");
    await pulled();
    const id = await broadcast();
    expect(await startDueBroadcasts()).toEqual([id]);
    expect(await sendDueBroadcasts(LATER)).toEqual({ sent: 2, skipped: 0, failed: 0, waiting: 0, left: 0 });
    expect(await copies()).toEqual([
      { address: "jane@example.com", status: "sent", skip: null, topics: ["events"], sent: true },
      { address: "sam@example.com", status: "sent", skip: null, topics: ["events"], sent: true },
    ]);
    const jane = batches[0].find((email) => email.To.includes("jane@"))!;
    const token = /\/api\/unsubscribe\/([\w-]+)>/.exec(JSON.stringify(jane.Headers))![1];
    const [{ hash, rfc }] = await query<{ hash: string; rfc: string }>(
      `SELECT link_token_hash AS hash, rfc_message_id AS rfc FROM broadcast_messages WHERE address = 'jane@example.com'`,
    );
    // Only the token's hash is kept.
    expect(hash).toBe(hashOf(token));
    expect(jane).toMatchObject({
      To: '"Jane Smith" <jane@example.com>',
      From: '"PauseAI UK" <hello@pauseai.uk>',
      Subject: "See you there",
      MessageStream: "broadcast",
      Headers: [
        { Name: "Message-ID", Value: `<${rfc}>` },
        { Name: "List-Unsubscribe", Value: `<https://pauseai.uk/api/unsubscribe/${token}>` },
        { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
      ],
    });
    expect(jane.TextBody).toContain("Hi Jane, see you there.");
    expect(jane.TextBody).toContain(emailSettingsCopy.footer.text(`https://pauseai.uk/email-settings/m/${token}`));
    expect(jane.HtmlBody).toContain(`href="https://pauseai.uk/email-settings/m/${token}"`);
    expect(await stateOf(id)).toEqual({ state: "sent", waiting: false, reason: null, gaveUp: false });
    expect(await query("SELECT kind FROM broadcast_message_events ORDER BY id")).toEqual([
      { kind: "sent" },
      { kind: "sent" },
    ]);
    expect(await query("SELECT purpose, broadcast_message_id IS NOT NULL AS copy FROM email_sends")).toEqual([
      { purpose: "broadcast", copy: true },
      { purpose: "broadcast", copy: true },
    ]);
    expect(await query("SELECT action FROM audit_log WHERE actor = 'send-mailings' ORDER BY id")).toEqual([
      { action: "start mailing" },
      { action: "finish mailing" },
    ]);
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
    const batches = postmark();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    const id = await broadcast();
    expect(await startDueBroadcasts()).toEqual([]);
    expect(await startDueBroadcasts()).toEqual([]);
    expect(await stateOf(id)).toEqual({ state: "scheduled", waiting: true, reason: "pull", gaveUp: false });
    expect(sent).toEqual([
      expect.objectContaining({
        To: NOTIFICATIONS,
        Cc: "sam@pauseai.uk",
        Subject: staffCopy.notifications.broadcastWaiting.subject("See you there"),
      }),
    ]);
    await pulled();
    expect(await startDueBroadcasts()).toEqual([id]);
    expect(await stateOf(id)).toEqual({ state: "sending", waiting: false, reason: null, gaveUp: false });
    await sendDueBroadcasts(LATER);
    expect(batches).toHaveLength(1);
  });

  it("stops one still waiting three days after its time, and tells whoever scheduled it", async () => {
    const sent = notifications();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    const id = await broadcast();
    vi.setSystemTime(new Date("2026-11-05T09:18:00Z"));
    await startDueBroadcasts();
    expect(await stateOf(id)).toEqual({ state: "cancelled", waiting: true, reason: "pull", gaveUp: true });
    expect(sent.map((email) => email.Subject)).toEqual([
      staffCopy.notifications.broadcastGaveUp.subject("See you there"),
    ]);
    // It never started, so who it didn't reach is everyone it would go to.
    expect(sent[0].TextBody).toContain(staffCopy.notifications.broadcastGaveUp.body("See you there", 1, "").trim());
    expect(await query("SELECT details FROM audit_log WHERE action = 'stop broadcast'")).toEqual([
      { details: { id, was: "scheduled" } },
    ]);
  });

  it("checks each copy just before it goes: an opt-out since, a block, or CiviCRM's say skips it", async () => {
    postmark();
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
    expect(await sendDueBroadcasts(LATER)).toEqual({ sent: 1, skipped: 5, failed: 0, waiting: 0, left: 0 });
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

  it("sends none of a batch PauseAI Global says not to email at all", async () => {
    const batches = postmark();
    await addFollower("usr-all", "all@example.com", "All");
    server.use(http.post(CHECK, () => HttpResponse.json({ values: [{ email: "all@example.com", block: "all" }] })));
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 0, skipped: 1 });
    expect(batches).toEqual([]);
  });

  it("skips a copy whose consent ended, as no permission", async () => {
    postmark();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    await query("UPDATE luma_people SET contact_since = NULL");
    await sendDueBroadcasts(LATER);
    expect((await copies()).map((copy) => copy.skip)).toEqual(["no-permission"]);
  });

  it("sends nothing unchecked: CiviCRM not answering has it wait, and say so", async () => {
    const sent = notifications();
    const batches = postmark();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    server.use(http.post(CHECK, () => new HttpResponse("Down", { status: 503 })));
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    const { run, problems } = await inRun(async (r) => ({ run: await sendDueBroadcasts(LATER), problems: r.problems }));
    expect(run).toEqual({ sent: 0, skipped: 0, failed: 0, waiting: 1, left: 1 });
    expect(problems.map((p) => p.what)).toEqual([staffCopy.problems.job.civicrmCheckFailed]);
    expect(batches).toEqual([]);
    expect(await stateOf(id)).toEqual({ state: "sending", waiting: true, reason: "civicrm", gaveUp: false });
    expect(sent.map((email) => email.Subject)).toEqual([
      staffCopy.notifications.broadcastWaiting.subject("See you there"),
    ]);
    // CiviCRM answers again: it goes, and waits no more.
    server.resetHandlers();
    postmark();
    await sendDueBroadcasts(LATER);
    expect(await stateOf(id)).toEqual({ state: "sent", waiting: false, reason: null, gaveUp: false });
  });

  it("stops one that started but CiviCRM hasn't answered for three days, telling who it didn't reach", async () => {
    const sent = notifications();
    postmark();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    server.use(http.post(CHECK, () => new HttpResponse("Down", { status: 503 })));
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    vi.setSystemTime(new Date("2026-11-05T10:18:00Z"));
    await inRun(() => sendDueBroadcasts(LATER));
    expect(await stateOf(id)).toEqual({ state: "cancelled", waiting: true, reason: "civicrm", gaveUp: true });
    expect((await copies()).map((copy) => copy.status)).toEqual(["cancelled", "cancelled"]);
    expect(sent.at(-1)!.TextBody).toContain(
      staffCopy.notifications.broadcastGaveUp.body("See you there", 2, "").trim(),
    );
  });

  it("blocks an address Postmark says it suppressed, and fails each copy of a batch Postmark refuses whole", async () => {
    postmark((email) => email.To.includes("gone@"));
    await addFollower("usr-gone", "gone@example.com", "Gone");
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await pulled();
    await broadcast();
    await startDueBroadcasts();
    expect(await sendDueBroadcasts(LATER)).toEqual({ sent: 1, skipped: 1, failed: 0, waiting: 0, left: 0 });
    expect(await query("SELECT address FROM email_blocks")).toEqual([{ address: "gone@example.com" }]);

    server.use(http.post(BATCH, () => new HttpResponse("Down", { status: 500 })));
    await addFollower("usr-sam", "sam@example.com", "Sam");
    await broadcast();
    await startDueBroadcasts();
    const { run } = await inRun(async () => ({ run: await sendDueBroadcasts(LATER) }));
    // Jane and Sam, as the address that bounced isn't sent to.
    expect(run.failed).toBe(2);
    expect((await copies()).find((copy) => copy.address === "sam@example.com")?.status).toBe("failed");
  });

  it("stops sending at the run's end, leaving the rest for the next", async () => {
    postmark();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    expect(await sendDueBroadcasts(0)).toEqual({ sent: 0, skipped: 0, failed: 0, waiting: 0, left: 1 });
    expect((await stateOf(id)).state).toBe("sending");
  });

  it("fails, not sends again, a copy a run took and stopped before keeping Postmark's answer", async () => {
    const batches = postmark();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await addFollower("usr-sam", "sam@example.com", "Sam");
    await pulled();
    const id = await broadcast();
    await startDueBroadcasts();
    // A run took Jane's copy and stopped; another is taking Sam's now.
    await query(
      `UPDATE broadcast_messages SET status = 'sending',
         sending_since = now() - CASE address WHEN 'jane@example.com' THEN interval '40 minutes' ELSE interval '1 minute' END`,
    );
    expect(await sendDueBroadcasts(LATER)).toEqual({ sent: 0, skipped: 0, failed: 1, waiting: 0, left: 0 });
    expect(batches).toEqual([]);
    expect((await copies()).map((copy) => [copy.address, copy.status])).toEqual([
      ["jane@example.com", "failed"],
      ["sam@example.com", "sending"],
    ]);
    expect((await stateOf(id)).state).toBe("sending");
  });

  it("sends one to the newsletter's and events' yeses both under whichever each said yes to", async () => {
    const batches = postmark();
    await addFollower("usr-jane", "jane@example.com", "Jane Smith");
    await query(
      `INSERT INTO form_entries (form, name, email, contact_consent) VALUES ('march-2026-11', 'Sam', 'sam@example.com', true)`,
    );
    await pulled();
    await broadcast(["email:newsletter:yes", "email:events:yes"]);
    await startDueBroadcasts();
    await sendDueBroadcasts(LATER);
    expect((await copies()).map((copy) => [copy.address, copy.topics])).toEqual([["jane@example.com", ["events"]]]);
    expect(batches.flat()).toHaveLength(1);
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
    expect(await sendDueBroadcasts(LATER)).toMatchObject({ sent: 1, waiting: 0 });
    expect((await stateOf(id)).state).toBe("sent");
  });
});
