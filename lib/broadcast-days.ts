// How long a broadcast to supporters has to go, and how many failures it
// takes, set by nobody: for the
// rules (lib/broadcasts.ts) and the words that say them
// (lib/content/staff-interface.ts), which can't import each other.

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

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** A number of days in words, as the pages say them: "three days". */
export function daysInWords(days: number): string {
  return `${WORDS[days] ?? days} ${days === 1 ? "day" : "days"}`;
}
