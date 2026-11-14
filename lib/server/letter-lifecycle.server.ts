import "server-only";
import type { LetterEvent, LetterStatus } from "@/lib/letter-status";
import { query, type Queryable } from "./db.server";
import type { Purpose } from "./email.server";
import type { ChannelMessage, ChannelResult, MailingChannel } from "@/lib/mailings/channels.server";
import { sql, type Sql } from "./sql.server";

// Moving letters from one status to another (lib/letter-status.ts), the only
// way letters.status changes once a letter is written. Each move is one
// statement: it changes only letters in a status it's allowed from, so two
// runs can't both take a letter, and logs its event for each letter it
// moved, so a letter's status and its history can't disagree. Sending one,
// whatever kind it is and however it goes, is sendLetterVia's.

/** The time a move stamps: when a letter was taken to send, or when it went. */
type Stamp = "taken_at" | "sent_at";

/** What a move does besides the status: the event it logs, with its details, and the time it stamps. */
export type Move = { event?: LetterEvent; details?: object; stamp?: Stamp };

/**
 * Moves the letter `which`, or the letters it selects, to `to`, those of them
 * whose status is one of `from`. Returns the IDs of those it moved, lowest
 * first: none if another run moved them first, or they weren't in `from`.
 */
export async function transition(
  which: number | Sql,
  from: readonly LetterStatus[],
  to: LetterStatus,
  { event, details = {}, stamp }: Move = {},
  db?: Queryable,
): Promise<number[]> {
  const letters = typeof which === "number" ? sql`${which}` : which;
  const stamped = stamp ? sql`, ${sql.raw(stamp)} = now()` : sql``;
  const moved = sql`UPDATE letters SET status = ${to}${stamped}
    WHERE id IN (${letters}) AND status = ANY(${from}::text[]) RETURNING id`;
  const logged = event
    ? sql`, logged AS (INSERT INTO letter_events (letter_id, status, details) SELECT id, ${event}, ${JSON.stringify(details)} FROM moved)`
    : sql``;
  const rows = await query<{ id: number }>(
    sql`WITH moved AS (${moved})${logged} SELECT id::int AS id FROM moved ORDER BY id`,
    db,
  );
  return rows.map((row) => row.id);
}

/**
 * A letter taken to send (status sending), as sendLetterVia sends it: what
 * it says, and what becomes of it when it can't go. `Unsent` is what each
 * kind of letter says of one that didn't.
 */
export type TakenLetter<Unsent> = {
  id: number;
  purpose: Purpose;
  /** Checked just before it goes: if it can't now, what's done with it instead, and what that says. */
  held(): Promise<Unsent | undefined>;
  message(): Promise<ChannelMessage>;
  /** The details of the event logged when it went. */
  sentDetails(result: Extract<ChannelResult, { sent: true }>): object;
  /** What's done with it when the channel didn't send it, by why and whether to try again, and what that says. */
  unsent(result: Extract<ChannelResult, { sent: false }>): Promise<Unsent>;
};

/**
 * What's thrown when a letter went but marking it sent failed: it's left
 * sending, for uncertainLetters to mark uncertain, as sending it again
 * would send it twice.
 */
export class SentUnrecorded extends Error {
  constructor(
    letterId: number,
    readonly cause: unknown,
  ) {
    super(`Letter ${letterId} went, but couldn't be marked sent`);
  }
}

/**
 * What's thrown when anything went wrong before a letter went, or dealing
 * with one that didn't: it never went, so the caller puts it back to try
 * again.
 */
class NotSentYet extends Error {
  constructor(
    letterId: number,
    readonly cause: unknown,
  ) {
    super(`Letter ${letterId} couldn't be sent`);
  }
}

/**
 * Sends a letter a run has taken, by `channel`: unless it's held, sends it,
 * and marks it sent, logging the event, or else leaves it as `unsent` says.
 * Every kind of letter goes this way, each by its own channel. Throws
 * NotSentYet for anything going wrong before it went, and SentUnrecorded
 * for marking one that went failing, for the caller to tell apart.
 */
export async function sendLetterVia<Unsent>(
  channel: MailingChannel,
  letter: TakenLetter<Unsent>,
): Promise<{ sent: true } | Unsent> {
  let result: ChannelResult;
  try {
    const held = await letter.held();
    if (held !== undefined) return held;
    // The channel never throws once it has sent (send in email.server.ts), so whatever's thrown here, nothing went.
    result = await channel.send(await letter.message(), letter.purpose);
    if (!result.sent) return await letter.unsent(result);
  } catch (error) {
    throw new NotSentYet(letter.id, error);
  }
  try {
    await transition(letter.id, ["sending"], "sent", {
      event: "sent",
      details: letter.sentDetails(result),
      stamp: "sent_at",
    });
  } catch (error) {
    throw new SentUnrecorded(letter.id, error);
  }
  return { sent: true };
}

/** Adds an event to a letter's history that doesn't change its status: its copy, a reply, a relay or a notice. */
export async function letterEvent(letterId: number, event: LetterEvent, details: object = {}): Promise<void> {
  await query("INSERT INTO letter_events (letter_id, status, details) VALUES ($1, $2, $3)", [
    letterId,
    event,
    JSON.stringify(details),
  ]);
}
