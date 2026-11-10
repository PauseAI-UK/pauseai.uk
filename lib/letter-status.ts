// A letter's status, where it is on its way to a politician, and the
// events in its history. letters.status's CHECK allows these, a supporter's
// letter some and PauseAI's others (docs/domain-concepts.md). A status
// changes only through transition() (lib/server/letter-lifecycle.ts), which
// logs its event in the same statement.

/** Every status a letter can have. */
export const LETTER_STATUSES = [
  "queued",
  "scheduled",
  "sending",
  "sent",
  "uncertain",
  "not_sent",
  "bounced",
  "spam_complaint",
  "cancelled",
  "skipped",
] as const;
export type LetterStatus = (typeof LETTER_STATUSES)[number];

/** A supporter's letter's statuses: waiting in the queue, then how it went. */
export const SUPPORTER_LETTER_STATUSES = [
  "queued",
  "sending",
  "sent",
  "uncertain",
  "not_sent",
  "bounced",
  "spam_complaint",
] as const satisfies readonly LetterStatus[];

/** Those that reached the politician's inbox: sent, or sent and marked as spam there. */
export const ARRIVED = ["sent", "spam_complaint"] as const satisfies readonly LetterStatus[];

/** Those that didn't arrive: refused as they went, or bounced. */
export const DID_NOT_ARRIVE = ["not_sent", "bounced"] as const satisfies readonly LetterStatus[];

/** A mailing's letters that failed: those that didn't arrive, and those skipped as they were about to go. */
export const MAILING_FAILED = [...DID_NOT_ARRIVE, "skipped"] as const satisfies readonly LetterStatus[];

/** A mailing's letters still to go, or going now. */
export const IN_FLIGHT = ["scheduled", "sending"] as const satisfies readonly LetterStatus[];

/** Those that never left: waiting, refused, stopped or skipped. A politician's history leaves them out. */
export const NEVER_WENT = [
  "queued",
  "scheduled",
  "not_sent",
  "cancelled",
  "skipped",
] as const satisfies readonly LetterStatus[];

/** A mailing's letters that went to a politician or are going to: all but those stopped, skipped or refused. */
export const MAILED = [
  "scheduled",
  "sending",
  "sent",
  "uncertain",
  "bounced",
  "spam_complaint",
] as const satisfies readonly LetterStatus[];

/** Whether `status` is one of `statuses`. */
export function isIn(status: string, statuses: readonly LetterStatus[]): boolean {
  return (statuses as readonly string[]).includes(status);
}

/** SQL that's true when `column` is one of `statuses`: `l.status IN ('sent', 'spam_complaint')`. */
export function statusIn(column: string, statuses: readonly LetterStatus[]): string {
  return `${column} IN (${statuses.map((status) => `'${status}'`).join(", ")})`;
}

/**
 * Each event in a letter's history (letter_events.status): its own status
 * changing, its copy to the supporter, a reply and what was done with it,
 * and the notices to the supporter and the office.
 */
export const LETTER_EVENTS = [
  "queued",
  "sent",
  "uncertain",
  "failed",
  "skipped",
  "bounced",
  "spam_complaint",
  "copy_sent",
  "copy_held",
  "copy_uncertain",
  "copy_delayed",
  "copy_bounced",
  "replied",
  "auto_reply",
  "not_relayed",
  "relay_queued",
  "relay_held",
  "relayed",
  "relay_uncertain",
  "relay_delayed",
  "relay_bounced",
  "notice",
  "office_told",
] as const;
export type LetterEvent = (typeof LETTER_EVENTS)[number];
