import { type AnyImportRun, type ImportJob, jobSchedule, runStatus } from "@/lib/import-runs";
import { staffDate } from "@/lib/staff-time";

// How a job's page lays out its runs: a row each, under a heading for each
// day, the newest first. A job that runs every few minutes or hourly makes
// many runs a day, nearly all alike: those that found nothing gather into a
// row, and its routine runs further down fold into one, so a problem or a
// change stands out.

/** How many routine runs show as rows before those further down are folded into one. */
const RECENT_ROWS = 12;

/** A run as its job's page shows it: a row of its own, routine (a row, folded with others further down), or one that found nothing. */
type Shape = "run" | "routine" | "quiet";

/** Whether a job runs often enough, every 5 or 15 minutes or hourly, that its runs that found nothing gather into a row. */
export function gathers(job: ImportJob): boolean {
  return ["frequent", "quarter-hour", "hourly"].includes(jobSchedule(job));
}

/** How a run shows when it isn't the newest. */
export function runShape(run: AnyImportRun): Shape {
  if (!gathers(run.job)) return "run";
  const status = runStatus(run);
  if (status === "unchanged") return "quiet";
  if (run.status === "failed" || run.problems.length > 0) return "run";
  switch (run.job) {
    case "import-luma":
      return status === "incomplete" ? "run" : "routine";
    case "read-gmail":
      return run.result.accounts.some((a) => a.restarted) ? "run" : "routine";
    default:
      return "run";
  }
}

/**
 * One row of a job's page: a run, its detail unfolded if it's the newest;
 * runs that found nothing, gathered; or routine runs further down, folded
 * into one. The gathered and folded are newest first.
 */
export type LogEntry =
  | { kind: "run"; run: AnyImportRun; open: boolean }
  | { kind: "quiet"; runs: AnyImportRun[] }
  | { kind: "folded"; runs: AnyImportRun[] };

/** A day of a job's page: its heading, and its rows, newest first. */
export type LogDay = { day: string; entries: LogEntry[] };

/** A job's runs, newest first, laid out by day. While a run is going, that's the job's state, so the newest starts folded as the others do. */
export function runLog(runs: AnyImportRun[], going: boolean): LogDay[] {
  const days: LogDay[] = [];
  let routine = 0;
  runs.forEach((run, i) => {
    const newest = i === 0 && !going;
    const shape = newest ? "run" : runShape(run);
    const day = staffDate(run.at);
    if (days.at(-1)?.day !== day) days.push({ day, entries: [] });
    const { entries } = days.at(-1)!;
    const kind = shape === "routine" ? (routine++ < RECENT_ROWS ? "run" : "folded") : shape;
    const previous = entries.at(-1);
    if (kind === "run") entries.push({ kind, run, open: newest });
    else if (previous?.kind === kind) previous.runs.push(run);
    else entries.push({ kind, runs: [run] });
  });
  return days;
}
