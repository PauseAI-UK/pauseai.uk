import "server-only";
import type { Reported } from "@/lib/problems";
import { problem } from "@/lib/server/problems.server";

// Sending something a run has taken to send, a letter, a relay, an answer,
// with care for the two ways it goes wrong, which are opposites. Before it
// went, nothing was sent, so it's put back to go next time. After it went,
// it mustn't go twice, so it's left as taken, for a person to check. Each
// is reported as a problem, the caller's own for what it was sending.

/** The two problems of sending one thing: it never went and was put back, or it went and that couldn't be recorded. */
export type SendProblems = { notSentYet: Reported; sentUnrecorded: Reported };

/** What sending it came to: it went, `recorded` or not; or what `send` or `putBack` said of one that didn't. */
export type SentWithCare<Unsent> = { sent: true; recorded: boolean } | Unsent;

/**
 * Sends something with `send`, then records that it went with `record`.
 *
 * - `send` says what went, for `record`, or what became of one that didn't
 *   go and needn't be reported: held, skipped, left to wait. Whatever it
 *   throws, nothing went (send in email.server.ts never throws once it
 *   has): that's reported as `notSentYet`, and `putBack` puts it back to try
 *   again and says what became of it.
 * - `record` marks it sent. If it throws, that's reported as
 *   `sentUnrecorded` and it's left as it was taken, never sent twice.
 */
export async function sendWithCare<Went, Unsent>(steps: {
  problems: SendProblems;
  send(): Promise<{ went: Went } | { unsent: Unsent }>;
  record(went: Went): Promise<unknown>;
  putBack(): Promise<Unsent>;
}): Promise<SentWithCare<Unsent>> {
  let outcome: { went: Went } | { unsent: Unsent };
  try {
    outcome = await steps.send();
  } catch (error) {
    problem(steps.problems.notSentYet, error);
    return steps.putBack();
  }
  if ("unsent" in outcome) return outcome.unsent;
  try {
    await steps.record(outcome.went);
  } catch (error) {
    problem(steps.problems.sentUnrecorded, error);
    return { sent: true, recorded: false };
  }
  return { sent: true, recorded: true };
}
