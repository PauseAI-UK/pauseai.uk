// For Vitest: a scheduled job run several times at once on one database, as
// when its run, its background twin and a press on its page overlap.

/**
 * Starts `copies` runs of `job` together, each before any has finished, and
 * waits for them all: what each returned, or threw, in the order started.
 * They share the test database's pool, so their queries interleave as runs
 * on separate servers would.
 */
export function atOnce<T>(job: () => Promise<T>, copies = 3): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(Array.from({ length: copies }, () => job()));
}

/**
 * For a job that turns a run away while another is going: `copies` runs of
 * it, started together by `start`, and `held`, which resolves once all but
 * one have been turned away, as `turnedAway` tells from what each returned.
 * The run that goes waits on `held` (at a fake API, say) so the runs overlap
 * however slow the machine: else one could wait for a database connection
 * until the first had finished, and go too.
 */
export function heldAtOnce<T>(
  job: () => Promise<T>,
  turnedAway: (run: T) => boolean,
  copies = 3,
): { held: Promise<void>; start: () => Promise<PromiseSettledResult<T>[]> } {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let away = 0;
  const start = () =>
    atOnce(async () => {
      const run = await job();
      if (turnedAway(run) && ++away === copies - 1) release();
      return run;
    }, copies);
  return { held, start };
}

/** Each run's result, failing the test if any threw. */
export function allResults<T>(runs: PromiseSettledResult<T>[]): T[] {
  return runs.map((run) => {
    if (run.status === "rejected") throw run.reason;
    return run.value;
  });
}
