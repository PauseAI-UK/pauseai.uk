import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { query } from "@/lib/server/db.server";
import { listRuns, runningNow, startRunning } from "@/lib/server/import-runs.server";
import { connectTestGmail, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { POST } from "./route";

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
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

  it("fails when an import does, keeping the run", async () => {
    server.use(http.get("https://business.senedd.wales/*", () => new HttpResponse(null, { status: 500 })));
    await expect(call("import-senedd")).rejects.toThrow();
    expect(await query("SELECT job, status FROM import_runs ORDER BY id")).toEqual([
      { job: "import-senedd", status: "failed" },
    ]);
    // It's no longer going, so the next run goes.
    expect(await runningNow("import-senedd")).toBeUndefined();
  });

  it("doesn't run a job while a staff member's run of it is going, and says so", async () => {
    await startRunning("import-parliament", "jo@pauseai.uk");
    const res = await call("import-parliament");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ stoppedBy: "running" });
    expect(await query("SELECT count(*)::int AS n FROM import_runs")).toEqual([{ n: 0 }]);
  });

  it("imports each body's members, and says what changed", async () => {
    // No politicians yet, so each body's are added.
    expect(await answer("import-parliament")).toEqual({ status: "applied", added: 4, changed: 0, left: 0 });
    expect(await answer("import-scottish-parliament")).toEqual({ status: "applied", added: 1, changed: 0, left: 0 });
    expect(await answer("import-senedd")).toEqual({ status: "applied", added: 1, changed: 0, left: 0 });
    expect(await answer("import-ni-assembly")).toEqual({ status: "applied", added: 1, changed: 0, left: 0 });
  });

  it("reads ControlAI's statement and says what it did", async () => {
    await answer("import-parliament");
    expect(await answer("import-controlai-statement")).toMatchObject({ supporters: 5, matched: 2, added: 2 });
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
      contacts: 11,
      added: 11,
      changed: 0,
      gone: 0,
      optOuts: 1,
      blocked: 1,
      supportersAdded: 11,
      linked: 11,
    });
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
      broadcasts: { started: [], sent: 0, skipped: 0, failed: 0, waiting: 0, left: 0 },
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
    expect(await answer("tidy-logs")).toEqual({ importRuns: 1, auditEntries: 0, drafts: 1, errors: 0 });
  });

  it("runs no job that isn't one, running nothing", async () => {
    expect((await call("nothing")).status).toBe(404);
    expect((await call("toString")).status).toBe(404);
    expect(await query("SELECT count(*)::int AS n FROM import_runs")).toEqual([{ n: 0 }]);
  });

  it("refuses anyone without the secret, before saying whether the job exists", async () => {
    expect((await call("import-parliament", "Bearer guess")).status).toBe(401);
    expect((await call("nothing", "Bearer guess")).status).toBe(401);
    expect(await query("SELECT count(*)::int AS n FROM import_runs")).toEqual([{ n: 0 }]);
  });
});
