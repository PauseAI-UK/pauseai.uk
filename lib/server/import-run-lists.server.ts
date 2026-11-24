import "server-only";
import { IMPORT_JOBS, type ImportJob } from "@/lib/import-runs";
import type { AnyImportRun } from "@/lib/import-run-types";
import { query } from "./db.server";

// The log of the jobs' runs (./import-runs.server.ts), as the jobs' pages
// and the dashboard read it, and which jobs are running now.

// A run's `error` is why it failed, in words: those of its failure
// (keptError), or for a run from before failures were kept, the words kept then.
export const COLUMNS = `id::int AS id, at, job, started_by AS "startedBy", status, coalesce(failure->>'said', error) AS error,
  result, problems, decided_by AS "decidedBy"`;

/**
 * Longer than any run can go, so one that died is ignored: every run is a
 * request to the site, which Netlify stops well within this.
 */
export const RUN_LASTS = "5 minutes";

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

/** A job's newest run, if it has ever run. */
export async function latestRun<Run extends AnyImportRun>(job: Run["job"]): Promise<Run | undefined> {
  const [run] = await query<Run>(
    `SELECT ${COLUMNS} FROM import_runs WHERE job = $1 ORDER BY at DESC, id DESC LIMIT 1`,
    [job],
  );
  return run;
}

/** Every job's newest run, in IMPORT_JOBS order, in one query; undefined for one that has never run. */
export async function latestRuns(): Promise<(AnyImportRun | undefined)[]> {
  const runs = await query<AnyImportRun>(
    `SELECT DISTINCT ON (job) ${COLUMNS} FROM import_runs ORDER BY job, at DESC, id DESC`,
  );
  return IMPORT_JOBS.map((job) => runs.find((run) => run.job === job));
}

/** Every job's run going now, in IMPORT_JOBS order, in one query; undefined for one that isn't running. */
export async function runningJobs(): Promise<(RunningJob | undefined)[]> {
  const running = await query<RunningJob & { job: ImportJob }>(
    `SELECT job, started_by AS "startedBy", started_at AS "startedAt" FROM job_presses
     WHERE started_at > now() - interval '${RUN_LASTS}'`,
  );
  return IMPORT_JOBS.map((job) => {
    const found = running.find((run) => run.job === job);
    return found && { startedBy: found.startedBy, startedAt: found.startedAt };
  });
}

/** Every run of one job, newest first, for its page. */
export async function listRuns(job: ImportJob): Promise<AnyImportRun[]> {
  return query<AnyImportRun>(`SELECT ${COLUMNS} FROM import_runs WHERE job = $1 ORDER BY at DESC, id DESC`, [job]);
}
