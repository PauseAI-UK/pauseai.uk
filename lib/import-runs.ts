// The import log's jobs, shared by the server (lib/server/import-runs.server.ts)
// and the staff components that show a run (app/(staff)/staff/_components/jobs/Run.tsx):
// each job's name, schedule and page, and how a run's ending reads. The runs'
// types are in ./import-run-types.ts.
import { nextCronRun } from "./cron";
import type { AnyImportRun } from "./import-run-types";

/**
 * How often a job runs on its own: every 5 minutes, every 15, hourly or
 * nightly, each by a scheduled function in netlify/functions/<job>/ whose
 * cron says the same (netlify/scheduled.test.ts).
 */
export type JobSchedule = "frequent" | "quarter-hour" | "hourly" | "nightly";

/**
 * Every job, by its name in the import log (`import_runs.job`): its page,
 * /staff/scheduled-jobs/<slug>, how often it runs, its cron (the same as its
 * scheduled function's, which Netlify reads without running the code, so
 * it's written out there too; netlify/scheduled.test.ts checks they agree),
 * and, for one with more to
 * do than a run can, how long a run works before it stops taking on more,
 * leaving the rest for the next. Every run is a request to the site, which
 * a Netlify function stops at 30 seconds, so a budget leaves room for the
 * run's last steps. What runs a job is lib/jobs/jobs.server.ts; its title, icon
 * and description are the staff interface's (importRunsCopy.jobTitles in lib/import-runs-copy.ts, ImportJob.tsx). The
 * overview lists them in this order.
 */
export const JOBS = {
  "import-luma": { slug: "luma", schedule: "frequent", cron: "2-59/5 * * * *", budgetMs: 20_000 },
  "import-civicrm": { slug: "civicrm", schedule: "hourly", cron: "49 * * * *" },
  "read-gmail": { slug: "gmail", schedule: "frequent", cron: "*/5 * * * *" },
  "send-mailings": { slug: "sending", schedule: "quarter-hour", cron: "3,18,33,48 * * * *", budgetMs: 8_000 },
  "import-parliament": { slug: "parliament", schedule: "nightly", cron: "21 6 * * *" },
  "import-scottish-parliament": { slug: "scottish-parliament", schedule: "nightly", cron: "22 6 * * *" },
  "import-senedd": { slug: "senedd", schedule: "nightly", cron: "23 6 * * *" },
  "import-ni-assembly": { slug: "ni-assembly", schedule: "nightly", cron: "24 6 * * *" },
  "import-controlai": { slug: "controlai", schedule: "nightly", cron: "25 6 * * *" },
  "import-controlai-statement": { slug: "controlai-statement", schedule: "nightly", cron: "26 6 * * *" },
  "import-edm": { slug: "edm", schedule: "nightly", cron: "28 6 * * *" },
  "tidy-logs": { slug: "tidying", schedule: "nightly", cron: "27 6 * * *" },
} as const satisfies Record<string, { slug: string; schedule: JobSchedule; cron: string; budgetMs?: number }>;

export type ImportJob = keyof typeof JOBS;
export const IMPORT_JOBS = Object.keys(JOBS) as ImportJob[];

export function isImportJob(value: string): value is ImportJob {
  return Object.hasOwn(JOBS, value);
}

/** How often a job runs on its own. */
export function jobSchedule(job: ImportJob): JobSchedule {
  return JOBS[job].schedule;
}

/** When a job next runs on its own, after `now`. */
export function nextRun(job: ImportJob, now: Date): Date {
  return nextCronRun(JOBS[job].cron, now);
}

/** Where a job's page is. */
export function importPath(job: ImportJob): string {
  return `/staff/scheduled-jobs/${JOBS[job].slug}`;
}

/** The job a page's slug names, if any. */
export function jobBySlug(slug: string): ImportJob | undefined {
  return IMPORT_JOBS.find((job) => JOBS[job].slug === slug);
}

/** A job's newest run as a list for RunList: itself, or none if it has never run. */
export function asList<Run>(run: Run | undefined): Run[] {
  return run ? [run] : [];
}

/** Who starts the scheduled runs (netlify/functions/), whatever their schedule. Staff runs are started by the staff member's email. */
export const NIGHTLY = "nightly";

/** Who discarded a held run that a newer run of its job replaced, as only the newest list can be applied. */
export const NEWER_RUN = "newer run";

/** The imports of each body's members (lib/politicians/imports.server.ts), the only runs held for a decision. */
export const POLITICIAN_IMPORT_JOBS = [
  "import-parliament",
  "import-scottish-parliament",
  "import-senedd",
  "import-ni-assembly",
] as const satisfies readonly ImportJob[];
export type PoliticianImportJob = (typeof POLITICIAN_IMPORT_JOBS)[number];

/** Whether a run left work for later: a Luma import cut short, by its time, its rate limit or another run. */
function moreToDo(run: Exclude<AnyImportRun, { status: "failed" }>): boolean {
  return run.job === "import-luma" && run.result.stoppedBy !== undefined;
}

/**
 * How a run ended, as its line in the import log says it: failed; else with
 * problems, if anything went wrong along the way; else incomplete, if it
 * left work for a later run; else its status.
 */
export function runStatus(run: AnyImportRun): string {
  if (run.status === "failed") return "failed";
  if (run.problems.length > 0) return "problems";
  if (moreToDo(run)) return "incomplete";
  return run.status;
}

/** How a run ended, as a colour: green when it went well, changing something or nothing; amber held, with problems or with more to do; red failed; none when it was discarded, or never ran. */
export function runTone(run: AnyImportRun | undefined): "green" | "amber" | "red" | undefined {
  if (!run) return undefined;
  const status = runStatus(run);
  if (status === "failed") return "red";
  if (status === "held" || status === "incomplete" || status === "problems") return "amber";
  return run.status === "discarded" ? undefined : "green";
}
