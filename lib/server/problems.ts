import "server-only";

// A problem is something that went wrong during a run of a job without
// stopping it: an event Luma wouldn't give, a mailbox Gmail refused, an
// email that didn't go. Code that catches an error and carries on reports
// it with problem(), which is the one way to do that (tests/checks). The
// problem is logged, and if a run is in progress, kept on the run, so the
// job's page shows it and staff are emailed about it (import-runs.ts).
// Outside a run, as in a form or a webhook, it's kept as an error, which
// the errors page shows and staff are emailed about (errors-seen.ts). The
// run in progress comes from run-store.ts, and the keeping of errors from
// instrumentation.ts, as the server starts; each registers itself here, so
// this module loads anywhere, the browser included, where neither is.

/**
 * One thing that went wrong during a run: what, and the error's own words,
 * if it came from one. `told` when an alert of its own has gone, so the
 * run's alert leaves it out.
 */
export type Problem = { what: string; error?: string; told?: true };

/** A run in progress: its problems so far. */
export type Run = { problems: Problem[] };

let findRun: () => Run | undefined = () => undefined;

/** Tells problem() how to find the run in progress: run-store.ts, as it loads. */
export function registerRunStore(find: () => Run | undefined): void {
  findRun = find;
}

/** What keeps a problem reported outside a run: its sentence, and the error's words if it had one. */
type Keeper = (what: string, described: string | undefined) => void;

/**
 * Where the keeper is held: on the global object, not in this module. Next
 * builds instrumentation.ts, which registers it, apart from the pages and
 * routes, which report the problems, and each build has a copy of this
 * module of its own.
 */
const KEEPER = Symbol.for("pauseai.uk problem keeper");
const held = globalThis as { [KEEPER]?: Keeper };

/** Tells problem() what keeps one reported outside a run: keepProblem (errors-seen.ts), as the server starts. */
export function registerProblemKeeper(keep: Keeper | undefined): void {
  held[KEEPER] = keep;
}

/**
 * Reports something that went wrong without stopping the work: `what` in our
 * words, and the error, if there was one. `what` is how the run's email tells
 * a new problem from an old one, so a count or a list goes in `error`. `told` if staff have been emailed
 * about it already, by an alert of its own, which a run's email then leaves out; outside a run, it isn't kept.
 */
export function problem(what: string, error?: unknown, { told = false } = {}): void {
  const described = error === undefined ? undefined : describeError(error);
  console.error(what, ...(described === undefined ? [] : [described]));
  const run = findRun();
  if (!run) {
    if (!told) held[KEEPER]?.(what, described);
    return;
  }
  run.problems.push({
    what,
    ...(described !== undefined && { error: described }),
    ...(told && { told: true as const }),
  });
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
