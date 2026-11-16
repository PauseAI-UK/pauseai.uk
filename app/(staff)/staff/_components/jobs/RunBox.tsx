import type { ReactNode } from "react";
import { type AnyImportRun, NEWER_RUN, NIGHTLY, runStatus, runTone } from "@/lib/import-runs";
import { staffClock, staffTime } from "@/lib/staff-time";
import Actions from "@/components/ui/Actions";
import { Muted } from "@/components/ui/Text";
import styles from "./RunBox.module.css";
import { jobsCopy } from "./copy";

/**
 * How a run ended, or that one is going, in words after a dot of its
 * colour: green done, amber held or with problems, red failed, blue
 * running, grey for none, such as a discarded run.
 */
export function RunState({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red" | "blue" | undefined;
  children: ReactNode;
}) {
  return (
    <span className={styles.state} data-tone={tone}>
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  );
}

type Props = {
  run: AnyImportRun;
  /** The job's own summary of what the run found. Not shown for a failed run, whose error is. */
  summary: ReactNode;
  /** Whether its detail starts unfolded. */
  open?: boolean;
  /** Buttons that stay outside the fold, such as apply and discard. */
  actions?: ReactNode;
  /** `line`: the run on one line, as a job's card has its newest, without what went wrong, its detail or its buttons. */
  variant?: "row" | "line";
  /** The detail, folded under the row: lists or a table. None, and there's nothing to fold. */
  children?: ReactNode;
};

/**
 * One run from the import log, a row of its job's page: the time, how it
 * ended, then what it found or why it failed, who started it if a person
 * did, and who decided it if it was held; what went wrong along the way
 * under that, in amber, never folded; and the job's detail folded under the
 * row, opened by the arrow at its end. A held run's buttons come under it.
 */
export default function RunBox({ run, summary, open, actions, variant = "row", children }: Props) {
  const failed = run.status === "failed";
  const state = <RunState tone={runTone(run)}>{jobsCopy.runs.status[runStatus(run)]}</RunState>;
  const said = failed ? jobsCopy.runs.error(run.error) : summary;
  if (variant === "line")
    return (
      <p className={styles.line}>
        {state}
        <span className={styles.when}>{staffTime(run.at)}</span>
        <span className={styles.said}>{said}</span>
      </p>
    );
  const head = (
    <>
      <span className={styles.time}>{staffClock(run.at)}</span>
      {state}
      <span className={styles.text}>
        {said}
        {run.startedBy && run.startedBy !== NIGHTLY && <Muted> · {jobsCopy.runs.by(run.startedBy)}</Muted>}
        {run.decidedBy && (
          <Muted>
            {" "}
            · {run.decidedBy === NEWER_RUN ? jobsCopy.runs.replaced : jobsCopy.runs.decidedBy(run.decidedBy)}
          </Muted>
        )}
        {run.problems.map((p, i) => (
          <span key={i} className={styles.problem}>
            {p.what}
            {p.error && <Muted> {p.error}</Muted>}
          </span>
        ))}
      </span>
    </>
  );
  const detail = failed ? undefined : children;
  return (
    <section className={styles.run} aria-label={String(run.at)}>
      {detail ? (
        <details open={open}>
          <summary className={styles.row}>{head}</summary>
          <div className={styles.under}>{detail}</div>
        </details>
      ) : (
        <div className={styles.row}>{head}</div>
      )}
      {actions && (
        <div className={styles.under}>
          <Actions>{actions}</Actions>
        </div>
      )}
    </section>
  );
}
