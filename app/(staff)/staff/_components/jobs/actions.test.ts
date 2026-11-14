import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { query } from "@/lib/server/db.server";
import { getPolitician } from "@/lib/politicians/records.server";
import { createSession } from "@/lib/accounts/auth.server";
import { addTestPolitician, describeWithDatabase, useTestDatabase } from "@/tests/database";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import { decideImport, runJobNow } from "./actions";
import { emailCopy } from "@/lib/email/copy";

vi.mock("next/headers", () => import("@/tests/next-headers"));
// revalidatePath needs a Next request; here it only needs to have been asked.
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const runs = () => query('SELECT job, status, started_by AS "startedBy" FROM import_runs ORDER BY id');

describeWithDatabase("the scheduled jobs' Server Actions", () => {
  useTestDatabase();

  beforeEach(async () => {
    requestCookies.clear();
    revalidatePath.mockClear();
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("change nothing without a session", async () => {
    requestCookies.clear();
    const attempts = [
      () => runJobNow("check-mps"),
      () => runJobNow("nothing"),
      () => decideImport(form({ id: "1", job: "import-parliament", decision: "apply" })),
    ];
    for (const attempt of attempts) expect(await expectRedirect(attempt)).toBe("/staff/login");
    expect(await query("SELECT count(*)::int AS n FROM import_runs")).toEqual([{ n: 0 }]);
  });

  it("a job's button runs it as the staff member, here ControlAI's letter, and keeps a failure rather than crashing the page", async () => {
    const id = await addTestPolitician();
    await runJobNow("import-controlai");
    expect((await getPolitician(id))!.statuses["controlai-letter"]).toMatchObject({ updatedBy: "controlai" });
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs");
    // Its own page, the overview, and the home page's actions.
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs/controlai");
    expect(revalidatePath).toHaveBeenCalledWith("/staff");

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get("https://controlai.org/uk-pm-letter", () => new HttpResponse(null, { status: 500 })));
    await runJobNow("import-controlai");
    // The failure, and that nobody could be emailed about it, as NOTIFICATION_INBOX isn't set here.
    expect(error).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(emailCopy.problems.noInbox);
    expect(await runs()).toEqual([
      { job: "import-controlai", status: "ok", startedBy: "jo@pauseai.uk" },
      { job: "import-controlai", status: "failed", startedBy: "jo@pauseai.uk" },
    ]);
  });

  it("the Luma import's button copies the Luma calendar as the staff member", async () => {
    vi.stubEnv("LUMA_API_KEY", "k");
    await runJobNow("import-luma");
    expect(await runs()).toEqual([{ job: "import-luma", status: "ok", startedBy: "jo@pauseai.uk" }]);
    expect(await query("SELECT count(*)::int AS n FROM luma_events")).toEqual([{ n: 9 }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs");
  });

  it("the Gmail reading's button reads the connected Gmail as the staff member", async () => {
    await runJobNow("read-gmail");
    expect(await runs()).toEqual([{ job: "read-gmail", status: "unchanged", startedBy: "jo@pauseai.uk" }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs/gmail");
  });

  it("the sending's button sends what's waiting, and the tidying's tidies the logs, each as the staff member", async () => {
    await runJobNow("send-mailings");
    expect(await runs()).toEqual([{ job: "send-mailings", status: "unchanged", startedBy: "jo@pauseai.uk" }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs/sending");
    await runJobNow("tidy-logs");
    expect(await runs()).toEqual([
      { job: "send-mailings", status: "unchanged", startedBy: "jo@pauseai.uk" },
      { job: "tidy-logs", status: "unchanged", startedBy: "jo@pauseai.uk" },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs/tidying");
  });

  it("an import's button imports its body's members", async () => {
    await runJobNow("import-senedd");
    expect(await runs()).toEqual([{ job: "import-senedd", status: "applied", startedBy: "jo@pauseai.uk" }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs");
  });

  it("a job's button keeps a failure rather than crashing the page", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get("https://business.senedd.wales/*", () => new HttpResponse(null, { status: 500 })));
    await runJobNow("import-senedd");
    // The failure, and that nobody could be emailed about it, as NOTIFICATION_INBOX isn't set here.
    expect(error).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(emailCopy.problems.noInbox);
    expect(await runs()).toEqual([{ job: "import-senedd", status: "failed", startedBy: "jo@pauseai.uk" }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs");
  });

  it("decideImport applies or discards a held import, and ignores a bad form", async () => {
    await query(
      `INSERT INTO import_runs (job, started_by, status, result) VALUES ('import-senedd', 'nightly', 'held', $1)`,
      [JSON.stringify({ changes: {}, members: [], endings: [] })],
    );
    const [{ id }] = await query<{ id: number }>("SELECT id::int AS id FROM import_runs");
    await decideImport(form({ id: String(id), job: "import-senedd", decision: "maybe" }));
    await decideImport(form({ id: "x", job: "import-senedd", decision: "apply" }));
    await decideImport(form({ id: String(id), job: "sync-politicians", decision: "apply" }));
    await decideImport(form({ id: String(id), decision: "apply" }));
    expect(await query("SELECT status FROM import_runs")).toEqual([{ status: "held" }]);
    await decideImport(form({ id: String(id), job: "import-senedd", decision: "discard" }));
    expect(await query("SELECT status, decided_by FROM import_runs")).toEqual([
      { status: "discarded", decided_by: "jo@pauseai.uk" },
    ]);
  });

  it("runs nothing for a name that isn't a job's", async () => {
    await runJobNow("nothing");
    await runJobNow("toString");
    expect(await query("SELECT count(*)::int AS n FROM import_runs")).toEqual([{ n: 0 }]);
    expect(await query("SELECT 1 FROM job_presses")).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("starts nothing while a press of the job is running, and takes over one older than any can run", async () => {
    const runs = () => query("SELECT 1 FROM import_runs WHERE job = 'tidy-logs'");
    await query("INSERT INTO job_presses (job, started_by) VALUES ('tidy-logs', 'sam@pauseai.uk')");
    await runJobNow("tidy-logs");
    expect(await runs()).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/scheduled-jobs/tidying");
    await query("UPDATE job_presses SET started_at = now() - interval '17 minutes'");
    await runJobNow("tidy-logs");
    expect(await runs()).toHaveLength(1);
    expect(await query("SELECT 1 FROM job_presses")).toEqual([]);
  });
});
