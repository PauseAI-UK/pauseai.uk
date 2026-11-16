import { Fragment } from "react";
import type { AnyImportRun } from "@/lib/import-runs";
import { type LogEntry, runLog } from "@/lib/jobs/run-log";
import type { RunningJob } from "@/lib/server/import-runs.server";
import { staffClock } from "@/lib/staff-time";
import Run, { type Decide } from "./Run";
import boxes from "./RunBox.module.css";
import styles from "./RunList.module.css";
import { jobsCopy } from "./copy";

type Props = {
  /** Newest first. */
  runs: AnyImportRun[];
  /** What to say when there are none. */
  none: string;
  decide?: Decide;
  /** The job's run going now. */
  running?: RunningJob;
};

/** The times of runs, newest first, from the first's to the last's. */
const range = (runs: AnyImportRun[]) => jobsCopy.runs.range(staffClock(runs.at(-1)!.at), staffClock(runs[0].at));

/** One row of the page: a run; those that found nothing, in muted words; or routine runs folded, opening to a row each. */
function Entry({ entry, decide }: { entry: LogEntry } & Pick<Props, "decide">) {
  if (entry.kind === "run") return <Run run={entry.run} decide={decide} open={entry.open} />;
  const { runs } = entry;
  if (entry.kind === "quiet")
    return (
      <div className={`${boxes.run} ${styles.quiet}`}>
        <div className={boxes.row}>
          <span className={boxes.time}>{range(runs)}</span>
          <span className={boxes.text}>{jobsCopy.runs.quiet(runs.length)}</span>
        </div>
      </div>
    );
  return (
    <details className={`${boxes.run} ${styles.quiet}`}>
      <summary className={boxes.row}>
        <span className={boxes.time}>{range(runs)}</span>
        <span className={boxes.text}>{jobsCopy.runs.stretch(runs.length)}</span>
      </summary>
      <div className={styles.folded}>
        {runs.map((run) => (
          <Run key={run.id} run={run} decide={decide} />
        ))}
      </div>
    </details>
  );
}

/**
 * Runs from the import log, a row each under a heading for each day, laid
 * out by lib/jobs/run-log.ts; or a line saying there are none. The newest
 * has its detail unfolded, as it's the job's state now, unless a run is
 * going.
 */
export default function RunList({ runs, none, decide, running }: Props) {
  if (runs.length === 0) return <p>{none}</p>;
  return runLog(runs, !!running).map(({ day, entries }) => (
    <Fragment key={day}>
      <h2 className={styles.day}>{day}</h2>
      <div className={styles.rows}>
        {entries.map((entry) => (
          <Entry key={entry.kind === "run" ? entry.run.id : entry.runs[0].id} entry={entry} decide={decide} />
        ))}
      </div>
    </Fragment>
  ));
}
