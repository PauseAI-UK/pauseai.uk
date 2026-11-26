import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { query } from "@/lib/server/db.server";
import { startRunning } from "@/lib/server/import-runs.server";
import { runningNow } from "@/lib/server/import-run-lists.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { startJob } from "./start-job.server";

// Next's after() only works inside a request. Here it keeps what it's given, for each test to run when it says.
const later = vi.hoisted(() => [] as (() => Promise<unknown>)[]);
vi.mock("next/server", async (importActual) => ({
  ...(await importActual<typeof import("next/server")>()),
  after: (work: () => Promise<unknown>) => void later.push(work),
}));

/** Runs what was left to do once the answer had gone, as Next does. */
async function afterwards() {
  while (later.length > 0) await later.shift()!();
}

const BACKGROUND = "https://pauseai.uk/.netlify/functions/run-job-background";
const runs = () => query('SELECT job, status, started_by AS "startedBy" FROM import_runs ORDER BY id');

describeWithDatabase("starting a staff member's run of a job", () => {
  useTestDatabase();

  beforeEach(() => {
    later.length = 0;
    vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("DEPLOY_CONTEXT", "production");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("on Netlify, marks the job running as theirs and starts the background function, run as theirs", async () => {
    const started: unknown[] = [];
    server.use(
      http.post(BACKGROUND, async ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer s3cret");
        started.push(await request.json());
        return new HttpResponse(null, { status: 202 });
      }),
    );
    expect(await startJob("tidy-logs", "jo@pauseai.uk", undefined)).toBe(true);
    expect(started).toEqual([{ job: "tidy-logs", startedBy: "jo@pauseai.uk", marked: true }]);
    expect(await runningNow("tidy-logs")).toMatchObject({ startedBy: "jo@pauseai.uk" });
    expect(later).toEqual([]);
  });

  it("throws if the background function won't start, leaving the job free to run", async () => {
    server.use(http.post(BACKGROUND, () => new HttpResponse(null, { status: 500 })));
    await expect(startJob("tidy-logs", "jo@pauseai.uk", undefined)).rejects.toThrow("Netlify answered 500");
    expect(await runningNow("tidy-logs")).toBeUndefined();
  });

  it("starts nothing while a run of the job is going", async () => {
    const started: unknown[] = [];
    server.use(
      http.post(BACKGROUND, () => {
        started.push(1);
        return new HttpResponse(null, { status: 202 });
      }),
    );
    await startRunning("tidy-logs", "nightly");
    expect(await startJob("tidy-logs", "jo@pauseai.uk", undefined)).toBe(false);
    expect(started).toEqual([]);
    expect(later).toEqual([]);
    expect(await runningNow("tidy-logs")).toMatchObject({ startedBy: "nightly" });
  });

  it("runs it itself once it has answered, on a build without Netlify's functions or without their secret", async () => {
    vi.stubEnv("DEPLOY_CONTEXT", "local");
    expect(await startJob("tidy-logs", "jo@pauseai.uk", undefined)).toBe(true);
    expect(await runs()).toEqual([]);
    await afterwards();
    vi.stubEnv("DEPLOY_CONTEXT", "deploy-preview");
    vi.stubEnv("CRON_SECRET", "");
    expect(await startJob("tidy-logs", "sam@pauseai.uk", undefined)).toBe(true);
    await afterwards();
    expect(await runs()).toEqual([
      { job: "tidy-logs", status: "unchanged", startedBy: "jo@pauseai.uk" },
      { job: "tidy-logs", status: "unchanged", startedBy: "sam@pauseai.uk" },
    ]);
    expect(await runningNow("tidy-logs")).toBeUndefined();
  });

  it("keeps the error of a run it does itself that fails, as well as the failed run", async () => {
    vi.stubEnv("DEPLOY_CONTEXT", "local");
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get("https://business.senedd.wales/*", () => new HttpResponse(null, { status: 500 })));
    await startJob("import-senedd", "jo@pauseai.uk", undefined);
    await afterwards();
    expect(await runs()).toEqual([{ job: "import-senedd", status: "failed", startedBy: "jo@pauseai.uk" }]);
    expect(await query("SELECT kind, route FROM errors_seen")).toEqual([
      { kind: "action", route: "/staff/scheduled-jobs/senedd" },
    ]);
  });
});
