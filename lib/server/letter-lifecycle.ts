import "server-only";
import type { LetterEvent, LetterStatus } from "@/lib/letter-status";
import { query, type Queryable } from "./db";
import { sql, type Sql } from "./sql";

// Moving letters from one status to another (lib/letter-status.ts), the only
// way letters.status changes once a letter is written. Each move is one
// statement: it changes only letters in a status it's allowed from, so two
// runs can't both take a letter, and logs its event for each letter it
// moved, so a letter's status and its history can't disagree.

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

/** Adds an event to a letter's history that doesn't change its status: its copy, a reply, a relay or a notice. */
export async function letterEvent(letterId: number, event: LetterEvent, details: object = {}): Promise<void> {
  await query("INSERT INTO letter_events (letter_id, status, details) VALUES ($1, $2, $3)", [
    letterId,
    event,
    JSON.stringify(details),
  ]);
}
