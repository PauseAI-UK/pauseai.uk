import "server-only";
import { type Problem, problemSaid, type Reported } from "@/lib/problems";

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
type Keeper = (problem: Problem) => void;

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

/** Logs a problem, and keeps it: on the run in progress, or with no run, as an error, unless staff have been `told`. */
function keep(kept: Problem): void {
  const said = problemSaid(kept);
  console.error(kept.what, ...(said === undefined ? [] : [said]));
  const run = findRun();
  if (run) run.problems.push(kept);
  else if (!kept.told) held[KEEPER]?.(kept);
}

/**
 * Reports something that went wrong without stopping the work: one of a
 * feature's declared problems (defineProblems in lib/problems.ts), with the
 * error, if there was one. `told` if staff have been emailed about it
 * already, by an alert of its own, which a run's email then leaves out;
 * outside a run, it isn't kept.
 */
export function problem({ code, values, what }: Reported, error?: unknown, { told = false } = {}): void {
  keep({
    code,
    values,
    what,
    ...(error !== undefined && { said: describeError(error) }),
    ...(told && { told: true as const }),
  });
}

/**
 * Reports a problem by a sentence written in place, as the features still
 * to declare theirs do (UNDECLARED_PROBLEMS in eslint.config.mjs): it's
 * known by the sentence, so a letter's ID or a count in it makes each one
 * new to the run's alert, and it's kept as one was before problems had
 * codes.
 */
export function problemInWords(what: string, error?: unknown, { told = false } = {}): void {
  keep({ what, ...(error !== undefined && { error: describeError(error) }), ...(told && { told: true as const }) });
}

/**
 * Writes to the log something that isn't a problem, for whoever reads
 * Netlify's logs: a webhook with nothing to record, a submission the spam
 * check turned away. The one way to (CONSOLE_RULE in eslint.config.mjs). A
 * failure is reported with problem(), which keeps it; the few that are only
 * noted say why (tests/checks/problem-reporting.test.ts).
 */
export function note(what: string, ...more: unknown[]): void {
  console.info(what, ...more);
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
