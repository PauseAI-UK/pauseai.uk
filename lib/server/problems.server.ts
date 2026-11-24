import "server-only";
import type { Problem, Reported, ReportedProblem } from "@/lib/problems";
import { type FailureKind, OutsideFailure, type OutsideService } from "./outside-services/outside-failure.server";

// A problem is something that went wrong during a run of a job without
// stopping it: an event Luma wouldn't give, a mailbox Gmail refused, an
// email that didn't go. Code that catches an error and carries on reports
// it with problem(), which is the one way to do that (tests/checks). The
// problem is logged, and if a run is in progress, kept on the run, so the
// job's page shows it and staff are emailed about it (import-runs.server.ts).
// Outside a run, as in a form or a webhook, it's kept as an error, which
// the errors page shows and staff are emailed about (errors-seen.server.ts). The
// run in progress comes from run-store.server.ts, and the keeping of errors from
// instrumentation.ts, as the server starts; each registers itself here, so
// this module loads anywhere, the browser included, where neither is.

/** A run in progress: its problems so far. */
export type Run = { problems: Problem[] };

let findRun: () => Run | undefined = () => undefined;

/** Tells problem() how to find the run in progress: run-store.server.ts, as it loads. */
export function registerRunStore(find: () => Run | undefined): void {
  findRun = find;
}

/** What keeps a problem reported outside a run: the problem, with the error's words if it had one. */
type Keeper = (problem: ReportedProblem) => void;

/**
 * Where the keeper is held: on the global object, not in this module. Next
 * builds instrumentation.ts, which registers it, apart from the pages and
 * routes, which report the problems, and each build has a copy of this
 * module of its own.
 */
const KEEPER = Symbol.for("pauseai.uk problem keeper");
const held = globalThis as { [KEEPER]?: Keeper };

/** Tells problem() what keeps one reported outside a run: keepProblem (errors-seen.server.ts), as the server starts. */
export function registerProblemKeeper(keep: Keeper | undefined): void {
  held[KEEPER] = keep;
}

/**
 * Reports something that went wrong without stopping the work: one of a
 * feature's declared problems (defineProblems in lib/problems.ts), with the
 * error, if there was one. It's logged, and kept: on the run in progress,
 * or with no run, as an error. `told` if staff have been emailed about it
 * already, by an alert of its own, which a run's email then leaves out;
 * outside a run, it isn't kept.
 */
export function problem({ code, values, what }: Reported, error?: unknown, { told = false } = {}): void {
  const said = error === undefined ? undefined : describeError(error);
  console.error(what, ...(said === undefined ? [] : [said]));
  const kept: ReportedProblem = {
    code,
    values,
    what,
    ...(said !== undefined && { said }),
    ...(told && { told: true as const }),
  };
  const run = findRun();
  if (run) run.problems.push(kept);
  else if (!told) held[KEEPER]?.(kept);
}

/**
 * Writes to the log something that isn't a problem, for whoever reads
 * Netlify's logs: a webhook with nothing to record, a submission the spam
 * check turned away. The one way to (CONSOLE_RULE in eslint.config.mjs). A
 * failure is reported with problem(), which keeps it; the few that are only
 * noted say why (tests/checks/problem-reporting.test.ts), and are handed
 * the error, which is written in words (describeError).
 */
export function note(what: string, ...more: unknown[]): void {
  console.info(what, ...more.map((each) => (each instanceof Error ? describeError(each) : each)));
}

/** How many causes deep to go: enough for a fetch's cause and its cause. */
const CAUSES = 4;

/**
 * An error in words, with what caused it: String(error) says "fetch failed"
 * and nothing of the connection refused behind it.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  let text = error.message || error.name;
  let cause: unknown = error.cause;
  for (let depth = 0; cause !== undefined && depth < CAUSES; depth++) {
    text += ` (${cause instanceof Error ? cause.message || cause.name : String(cause)})`;
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return text;
}

/**
 * An error as a column keeps it (import_runs.failure, luma_events'
 * guests_failure and hosts_failure, mailings.wait_failure): its words, and
 * when it was an outside service failing, which service, what kind of
 * failure, its status (0 if there was no answer) and the service's own
 * code, where it has one. So what reads the column asks the kind, as a
 * caller of the binding does, and never reads the words to tell a rate
 * limit from an outage.
 */
export type KeptError = {
  said: string;
  service?: OutsideService;
  kind?: FailureKind;
  status?: number;
  serviceCode?: string | number;
};

/**
 * An error as a column keeps it. What writes an error to a column uses
 * this, not describeError(), which ESLint keeps to the few files named for
 * it (DESCRIBE_ERROR_IMPORT in eslint.config.mjs).
 */
export function keptError(error: unknown): KeptError {
  const said = describeError(error);
  if (!(error instanceof OutsideFailure)) return { said };
  const { service, kind, status, serviceCode } = error;
  return { said, service, kind, status, serviceCode };
}
