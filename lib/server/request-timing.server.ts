import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { note } from "./problems.server";

// How a staff request spent its time: a line in the function's log once its
// response has gone (Netlify's function logs on the live site), saying how
// long it took, how many queries it asked, how long it waited on the
// database, and how many queries it had going at once. Waiting is the time
// with any query going, so queries at the same time count once. A page can't
// add a header to its own response, so the log is where this goes.

/** One request's queries, so far. */
export type Timing = {
  /** When it asked its first query or said it was a staff request, in performance.now()'s milliseconds. */
  start: number;
  queries: number;
  /** Milliseconds with a query going. */
  waited: number;
  /** Queries going now, and since when there's been one. */
  going: number;
  goingSince: number;
  /** The most it had going at once. */
  most: number;
};

/** This request's timing: one a request (React's cache()), a fresh one outside any. */
export const thisRequest = cache((): Timing => ({
  start: performance.now(),
  queries: 0,
  waited: 0,
  going: 0,
  goingSince: 0,
  most: 0,
}));

/** Runs one query, counted in this request's timing. */
export async function timed<T>(run: () => Promise<T>): Promise<T> {
  const timing = thisRequest();
  timing.queries++;
  if (timing.going++ === 0) timing.goingSince = performance.now();
  timing.most = Math.max(timing.most, timing.going);
  try {
    return await run();
  } finally {
    if (--timing.going === 0) timing.waited += performance.now() - timing.goingSince;
  }
}

/** The log's line for a request to `path`, done at `end`. */
export function timingLine(path: string, timing: Timing, end: number): string {
  const ms = (value: number) => `${Math.round(value)} ms`;
  return `Staff request ${path}: ${ms(end - timing.start)}, ${timing.queries} queries, ${ms(timing.waited)} waiting on the database, at most ${timing.most} at once`;
}

/** Logs this request's timing once its response has gone: once a request, however often it's asked. */
export const logTiming = cache((path: string): void => {
  const timing = thisRequest();
  try {
    after(() => note(timingLine(path, timing, performance.now())));
  } catch {
    // Outside a request, as in a test or a script: no response to time.
  }
});
