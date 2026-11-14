import "server-only";
import { jobTitles, staffCopy } from "@/lib/content/staff-interface";
import { importPath, type AnyImportRun, type ImportJob, type ImportRunStatus } from "@/lib/import-runs";
import { query } from "./db.server";
import { notifyStaff, staffLink } from "./notifications.server";
import { describeError } from "./problems.server";
import { currentRun, inRun } from "./run-store.server";

// One log of every run of every job (lib/import-runs.ts, JOBS). Each run is
// a row: when, who started it, how it ended, why it failed, what went wrong
// along the way (problems.server.ts), and the job's own account of what it found.
// Failures are kept too, so each job's page under /staff/scheduled-jobs can
// say what went wrong, and so are runs that changed nothing, so it can say
// when the job last ran. Each job's page lists all of its runs. The types
// are in lib/import-runs.ts, for the components. What runs each job, one
// run of it at a time, is lib/jobs/jobs.server.ts.

const COLUMNS = `id::int AS id, at, job, started_by AS "startedBy", status, error, result, problems, decided_by AS "decidedBy"`;

/** Keeps a run that ended, with the problems it reported, and returns its ID. */
export async function recordRun(
  job: ImportJob,
  startedBy: string,
  status: Exclude<ImportRunStatus, "failed">,
  result: object,
): Promise<number> {
  const [{ id }] = await query<{ id: number }>(
    "INSERT INTO import_runs (job, started_by, status, result, problems) VALUES ($1, $2, $3, $4, $5) RETURNING id::int AS id",
    [job, startedBy, status, JSON.stringify(result), JSON.stringify(currentRun()?.problems ?? [])],
  );
  return id;
}

/** Keeps a run that failed, with why, and the problems it reported before it did. */
export async function recordFailure(job: ImportJob, startedBy: string, error: unknown): Promise<number> {
  const [{ id }] = await query<{ id: number }>(
    "INSERT INTO import_runs (job, started_by, status, error, problems) VALUES ($1, $2, 'failed', $3, $4) RETURNING id::int AS id",
    [job, startedBy, describeError(error), JSON.stringify(currentRun()?.problems ?? [])],
  );
  return id;
}

/** How a run that didn't fail ended, and the job's own account of what it found, to keep. A job may add more, for its caller. */
export type Ran<Result extends object = object> = { status: Exclude<ImportRunStatus, "failed">; result: Result };

/**
 * Does a job's work as a run, and keeps it: how it ended and what it found,
 * as the work says, with what it reported along the way with problem(). A
 * failure is kept as a failed run, with those problems, and thrown on, for
 * the caller to log. Once it's kept, staff are emailed if it failed or had
 * problems that the run before didn't (below).
 */
export async function asRun<Done extends Ran>(
  job: ImportJob,
  startedBy: string,
  work: () => Promise<Done>,
): Promise<Done> {
  let recorded: number | undefined;
  try {
    return await inRun(async () => {
      let done: Done;
      try {
        done = await work();
      } catch (error) {
        recorded = await recordFailure(job, startedBy, error);
        throw error;
      }
      recorded = await recordRun(job, startedBy, done.status, done.result);
      return done;
    });
  } finally {
    if (recorded) await alertIfNew(job, recorded);
  }
}

/** What a run went wrong with, as the alert tells it apart from the run before: its problems by name, those with an alert of their own aside, or that it failed. */
function wentWrong(run: AnyImportRun | undefined): string[] {
  if (!run) return [];
  if (run.status === "failed") return ["failed"];
  return run.problems.filter((p) => !p.told).map((p) => p.what);
}

/**
 * Emails the notification inbox about run `id` if it went wrong in a way the
 * run before didn't: a failure, or a problem by its name. A job failing every
 * hour, or stuck on the same problem, says so once; it says so again once a
 * run has gone right, or when something new goes wrong. A run kept, from
 * before one run went at a time, as having stopped because another was
 * going did nothing, so isn't the run before.
 */
async function alertIfNew(job: ImportJob, id: number): Promise<void> {
  const [run, before] = await query<AnyImportRun>(
    `SELECT ${COLUMNS} FROM import_runs
     WHERE job = $1 AND (id = $2 OR (id < $2 AND result->>'stoppedBy' IS DISTINCT FROM 'running'))
     ORDER BY at DESC, id DESC LIMIT 2`,
    [job, id],
  );
  const wrong = wentWrong(run);
  const already = new Set(wentWrong(before));
  if (!wrong.length || wrong.every((what) => already.has(what))) return;
  const title = jobTitles[job];
  const link = staffLink(importPath(job), undefined);
  if (run.status === "failed") {
    const words = staffCopy.notifications.importFailed;
    await notifyStaff(words.subject(title), words.body(title, run.error, link));
    return;
  }
  const words = staffCopy.notifications.importProblems;
  await notifyStaff(
    words.subject(title),
    words.body(
      title,
      run.problems.filter((p) => !p.told).map((p) => (p.error ? `- ${p.what} ${p.error}` : `- ${p.what}`)),
      link,
    ),
  );
}

/**
 * Longer than any run can go, so one that died is ignored: every run is a
 * request to the site, which Netlify stops well within this.
 */
const RUN_LASTS = "5 minutes";

/** A job's run going now: who started it (NIGHTLY for its schedule) and when. */
export type RunningJob = { startedBy: string; startedAt: Date };

/** The run of `job` going now, if any. */
export async function runningNow(job: ImportJob): Promise<RunningJob | undefined> {
  const [running] = await query<RunningJob>(
    `SELECT started_by AS "startedBy", started_at AS "startedAt" FROM job_presses
     WHERE job = $1 AND started_at > now() - interval '${RUN_LASTS}'`,
    [job],
  );
  return running;
}

/**
 * Marks `job` running, unless a run of it is going, and says whether this
 * one may go: one run of a job at a time, whoever starts it, its schedule or
 * a staff member. The table is named for when only staff presses took it.
 */
export async function startRunning(job: ImportJob, startedBy: string): Promise<boolean> {
  const taken = await query(
    `INSERT INTO job_presses (job, started_by) VALUES ($1, $2)
     ON CONFLICT (job) DO UPDATE SET started_by = $2, started_at = now()
     WHERE job_presses.started_at <= now() - interval '${RUN_LASTS}' RETURNING job`,
    [job, startedBy],
  );
  return taken.length > 0;
}

/** Marks a run of `job` ended. */
export async function stopRunning(job: ImportJob): Promise<void> {
  await query("DELETE FROM job_presses WHERE job = $1", [job]);
}

/** A job's newest run, if it has ever run. */
export async function latestRun<Run extends AnyImportRun>(job: Run["job"]): Promise<Run | undefined> {
  const [run] = await query<Run>(
    `SELECT ${COLUMNS} FROM import_runs WHERE job = $1 ORDER BY at DESC, id DESC LIMIT 1`,
    [job],
  );
  return run;
}

/** Every run of one job, newest first, for its page. */
export async function listRuns(job: ImportJob): Promise<AnyImportRun[]> {
  return query<AnyImportRun>(`SELECT ${COLUMNS} FROM import_runs WHERE job = $1 ORDER BY at DESC, id DESC`, [job]);
}
