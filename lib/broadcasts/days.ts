// How long a broadcast to supporters has to go, and how many failures it
// takes, set by nobody: for the
// rules (lib/broadcasts/broadcasts.ts) and the words that say them
// (lib/broadcasts/copy.ts), which can't import each other.
import { plural } from "@/lib/content/plural";

/** How long a broadcast waits for CiviCRM, from when it first couldn't go, before it stops. */
export const WAIT_DAYS = 3;

/** How long after its time a broadcast has to all go, at a day's limit of emails, before it stops. */
export const SENDING_DAYS = 7;

/**
 * How many tries at a broadcast's copies can fail one after another before
 * it stops: each failed copy is someone it never reaches, as it isn't sent
 * again, so a cause that fails them all costs this many people at most.
 */
export const FAILURES_TO_STOP = 5;

/**
 * How long Postmark has to say what became of a copy it took, before the
 * copy counts as lost: it usually says within seconds, and within a few
 * minutes at worst.
 */
export const LOST_MINUTES = 10;

/** How many of a broadcast's copies can be lost, since it last started or was resumed, before it stops. */
export const LOST_TO_STOP = 5;

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** A number of days in words, as the pages say them: "three days". */
export function daysInWords(days: number): string {
  return `${WORDS[days] ?? days} ${plural(days, "day", "days")}`;
}
