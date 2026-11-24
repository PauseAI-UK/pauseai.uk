import "server-only";
import type { Reported } from "@/lib/problems";
import { problem } from "@/lib/server/problems.server";
import { OutsideFailure } from "./outside-failure.server";

/**
 * Does `work`, which asks an outside service, and gives what it gives. If
 * the service fails (an OutsideFailure), that's reported as `reported` and
 * `fallback` is given in its place, so the page or the run carries on
 * without it. Anything else thrown is a bug of ours, not the service
 * failing, and is thrown on.
 */
export async function orFallback<Result, Fallback>(
  reported: Reported,
  fallback: Fallback,
  work: () => Promise<Result>,
): Promise<Result | Fallback> {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof OutsideFailure)) throw error;
    problem(reported, error);
    return fallback;
  }
}
