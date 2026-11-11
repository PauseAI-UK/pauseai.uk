import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { query } from "@/lib/server/db";
import { listRuns, runningNow, startRunning } from "@/lib/server/import-runs";
import { connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { POST } from "./route";

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.stubEnv("AIRTABLE_TOKEN", "token");
  vi.stubEnv("CIVICRM_CHAPTER_KEY", "key");
  vi.stubEnv("LUMA_API_KEY", "k");
});
afterEach(() => vi.unstubAllEnvs());

const call = (job: string, authorization = "Bearer s3cret") =>
  POST(new Request(`https://pauseai.uk/api/cron/${job}`, { method: "POST", headers: { authorization } }), {
    params: Promise.resolve({ job }),
  });

const answer = async (job: string) => (await call(job)).json();

describeWithDatabase("POST /api/cron/<job>", () => {
  useTestDatabase();

  it("copies the politicians from Airtable, and says what changed", async () => {
    expect(await answer("sync-politicians")).toEqual({
      status: "applied",
      added: 7,
      removed: 0,
      changed: 0,
      renamed: 0,
    });
  });

  it("fails when the politicians do, keeping the run", async () => {
    server.use(
      // A Status the sync doesn't know fails it.
      http.get("https://*.airtable.com/v0/appBInVvIm6opJ1Ob/tblH3ks9wqQHLpYx3", () =>
        HttpResponse.json({ records: [{ id: "recOdd", fields: { "Full name or Title": "Odd", Status: "Odd" } }] }),
      ),
    );
    await expect(call("sync-politicians")).rejects.toThrow('Unknown Status "Odd"');
    expect(await query("SELECT job, status FROM import_runs ORDER BY id")).toEqual([
      { job: "sync-politicians", status: "failed" },
    ]);
    // It's no longer going, so the next run goes.
    expect(await runningNow("sync-politicians")).toBeUndefined();
  });

  it("doesn't run a job while a staff member's run of it is going, and says so", async () => {
    await startRunning("check-mps", "jo@pauseai.uk");
    const res = await call("check-mps");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ stoppedBy: "running" });
    expect(await query("SELECT count(*)::int AS n FROM import_runs")).toEqual([{ n: 0 }]);
  });

  it("checks the MPs against Parliament's, and says how many problems it found", async () => {
    // No MPs copied yet, so each of Parliament's is missing.
    expect(await answer("check-mps")).toEqual({ problems: 3 });
  });

  it("reads ControlAI's letter and says what it did", async () => {
    // No politicians yet, so nobody matches.
    expect(await answer("import-controlai")).toMatchObject({ signatories: 6, matched: 0, added: 0 });
  });

  it("copies the fixture calendar and says what it did", async () => {
    expect(await answer("import-luma")).toMatchObject({
      events: 9,
      eventsSynced: 9,
      eventsLeft: 0,
      people: 6,
      contacts: 3,
    });
  });

  it("copies the fixture's UK chapter contacts from CiviCRM and says what it did", async () => {
    // Kit's unsubscribe, and Casey's hold; with no members here, each contact is a new supporter.
    expect(await answer("import-civicrm")).toEqual({
      contacts: 8,
      added: 8,
      changed: 0,
      gone: 0,
      optOuts: 1,
      blocked: 1,
      supportersAdded: 8,
      linked: 8,
    });
  });

  it("copies the fixture members and says what it did", async () => {
    expect(await answer("import-members")).toMatchObject({ members: 9, added: 9 });
  });

  it("reads each connected Gmail, says what it found, and keeps the run as the schedule's", async () => {
    await connectTestGmail("jo@pauseai.uk");
    expect(await answer("read-gmail")).toEqual({
      accounts: [{ account: "jo@pauseai.uk", replies: 0, autoReplies: 0, bounces: 0 }],
    });
    expect(await listRuns("read-gmail")).toMatchObject([{ startedBy: "nightly", status: "unchanged" }]);
  });

  it("starts the mailings due and sends, saying what it did and what's left", async () => {
    expect(await answer("send-mailings")).toEqual({
      started: [],
      sent: 0,
      skipped: 0,
      failed: 0,
      left: 0,
      waiting: [],
      queue: { sent: 0, left: 0 },
    });
  });

  it("tidies the logs and the empty drafts, and says how much went", async () => {
    await query(
      "INSERT INTO import_runs (job, at, status) VALUES ('import-luma', now() - interval '8 days', 'ok'), ('import-luma', now(), 'ok')",
    );
    await query(
      `INSERT INTO mailings (title, audience, channel, filter, body, created_by, state, opened_at)
       VALUES ('', 'politicians', 'email', '{"list": "politicians", "params": {}}', '{"type": "doc", "content": []}',
         'jo@pauseai.uk', 'draft', now() - interval '2 days')`,
    );
    expect(await answer("tidy-logs")).toEqual({ importRuns: 1, auditEntries: 0, drafts: 1 });
  });

  it("runs no one-off job, nor one that isn't, running nothing", async () => {
    expect((await call("sync-emails")).status).toBe(404);
    expect((await call("import-old-letters")).status).toBe(404);
    expect((await call("nothing")).status).toBe(404);
    expect(await query("SELECT count(*)::int AS n FROM import_runs")).toEqual([{ n: 0 }]);
  });

  it("refuses anyone without the secret, before saying whether the job exists", async () => {
    expect((await call("check-mps", "Bearer guess")).status).toBe(401);
    expect((await call("nothing", "Bearer guess")).status).toBe(401);
    expect(await query("SELECT count(*)::int AS n FROM import_runs")).toEqual([{ n: 0 }]);
  });
});
