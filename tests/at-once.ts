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

/** Each run's result, failing the test if any threw. */
export function allResults<T>(runs: PromiseSettledResult<T>[]): T[] {
  return runs.map((run) => {
    if (run.status === "rejected") throw run.reason;
    return run.value;
  });
}
