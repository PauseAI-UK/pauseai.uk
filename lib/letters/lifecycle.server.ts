import "server-only";
import type { LetterEvent, LetterStatus } from "./status";
import { query, type Queryable } from "@/lib/server/db.server";
import type { Purpose } from "@/lib/email/email.server";
import type { ChannelMessage, ChannelResult, MailingChannel } from "./channels.server";
import { sql, type Sql } from "@/lib/server/sql.server";
import { sendWithCare, type SendProblems, type SentWithCare } from "@/lib/email/send-with-care.server";

// Moving letters from one status to another (lib/letters/status.ts), the only
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
  move: Move = {},
  db?: Queryable,
): Promise<number[]> {
  const rows = await transitionReading<{ id: number }>(
    which,
    from,
    to,
    move,
    sql`SELECT id::int AS id FROM moved ORDER BY id`,
    db,
  );
  return rows.map((row) => row.id);
}

/**
 * Moves letters as transition does and, in the same statement, returns the
 * rows `read` selects: a SELECT that can use `moved`, the IDs of the letters
 * moved. Taking a letter and reading it at once means a read that fails
 * moves nothing. The statement sees `letters` as it was before the move, so
 * `read` takes a letter's new status from `to`, not from the table.
 */
export async function transitionReading<Row extends Record<string, unknown>>(
  which: number | Sql,
  from: readonly LetterStatus[],
  to: LetterStatus,
  { event, details = {}, stamp }: Move,
  read: Sql,
  db?: Queryable,
): Promise<Row[]> {
  const letters = typeof which === "number" ? sql`${which}` : which;
  const stamped = stamp ? sql`, ${sql.raw(stamp)} = now()` : sql``;
  const moved = sql`UPDATE letters SET status = ${to}${stamped}
    WHERE id IN (${letters}) AND status = ANY(${from}::text[]) RETURNING id`;
  const logged = event
    ? sql`, logged AS (INSERT INTO letter_events (letter_id, status, details) SELECT id, ${event}, ${JSON.stringify(details)} FROM moved)`
    : sql``;
  return query<Row>(sql`WITH moved AS (${moved})${logged} ${read}`, db);
}

/**
 * A letter taken to send (status sending), as sendLetterVia sends it: the
 * problems it reports, and what becomes of it when it can't go. `Unsent` is
 * what each kind of letter says of one that didn't.
 */
export type TakenLetter<Unsent> = {
  id: number;
  /** What's reported when it never went, and when it went but couldn't be marked sent. */
  problems: SendProblems;
  /** Puts it back to try again, when anything went wrong before it went, and what that says. */
  putBack(): Promise<Unsent>;
  /** Reads what it needs to go. Its own step, as a read that fails is one more thing going wrong before it went. */
  read(): Promise<ReadLetter<Unsent>>;
};

/** What a taken letter says, once read. */
export type ReadLetter<Unsent> = {
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
 * Sends a letter a run has taken, by `channel`: unless it's held, sends it,
 * and marks it sent, logging the event, or else leaves it as `unsent` says.
 * Every kind of letter goes this way, each by its own channel, with care
 * (sendWithCare): one that never went is put back and reported, and one
 * that went but couldn't be marked sent is reported and left sending, for
 * uncertainLetters to mark uncertain, as sending it again would send it
 * twice.
 */
export async function sendLetterVia<Unsent>(
  channel: MailingChannel,
  letter: TakenLetter<Unsent>,
): Promise<SentWithCare<Unsent>> {
  type Went = { read: ReadLetter<Unsent>; result: Extract<ChannelResult, { sent: true }> };
  return sendWithCare<Went, Unsent>({
    problems: letter.problems,
    send: async () => {
      const read = await letter.read();
      const held = await read.held();
      if (held !== undefined) return { unsent: held };
      // The channel never throws once it has sent (send in email.server.ts), so whatever's thrown here, nothing went.
      const result = await channel.send(await read.message(), read.purpose);
      return result.sent ? { went: { read, result } } : { unsent: await read.unsent(result) };
    },
    // Its event's details are worked out here, once it has gone: nothing that fails from now on may put it back.
    record: ({ read, result }) =>
      transition(letter.id, ["sending"], "sent", {
        event: "sent",
        details: read.sentDetails(result),
        stamp: "sent_at",
      }),
    putBack: letter.putBack,
  });
}

/** Adds an event to a letter's history that doesn't change its status: its copy, a reply, a relay or a notice. */
export async function letterEvent(letterId: number, event: LetterEvent, details: object = {}): Promise<void> {
  await query("INSERT INTO letter_events (letter_id, status, details) VALUES ($1, $2, $3)", [
    letterId,
    event,
    JSON.stringify(details),
  ]);
}
