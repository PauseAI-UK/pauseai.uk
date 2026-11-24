import "server-only";
import { query } from "@/lib/server/db.server";
import type { ErrorKind } from "./error-key";

// The errors kept (./errors-seen.server.ts), as staff read them on
// /staff/errors and mark them done, and as the log's retention tidies them.

/** A row of the list. */
export type ErrorSeen = {
  id: number;
  kind: ErrorKind;
  route: string;
  name: string;
  code: string | null;
  words: string;
  latestWords: string;
  stack: string | null;
  browser: string | null;
  firstSeen: Date;
  lastSeen: Date;
  count: number;
  /** When an admin marked it done, and who: both null while it's to do, as it is again once it happens again. */
  doneAt: Date | null;
  doneBy: string | null;
};

const COLUMNS = `id::int AS id, kind, route, name, code, words, latest_words AS "latestWords", latest_stack AS stack,
  latest_browser AS browser, first_seen AS "firstSeen", last_seen AS "lastSeen", count, done_at AS "doneAt",
  done_by AS "doneBy"`;

const PAGE_SIZE = 100;

/** The errors to do, or with `done` those marked done, the one seen most recently first, a page at a time. */
export async function listErrorsSeen(
  page: number,
  done: boolean,
): Promise<{
  errors: ErrorSeen[];
  total: number;
  pages: number;
  page: number;
  pageSize: number;
}> {
  const where = `WHERE (done_at IS NOT NULL) = $1`;
  const [{ total }] = await query<{ total: number }>(`SELECT count(*)::int AS total FROM errors_seen ${where}`, [done]);
  const errors = await query<ErrorSeen>(
    `SELECT ${COLUMNS} FROM errors_seen ${where} ORDER BY last_seen DESC, id DESC LIMIT $2 OFFSET $3`,
    [done, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  return { errors, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), page, pageSize: PAGE_SIZE };
}

/** One error, by the ID in its page's URL, or undefined if there's none. */
export async function errorSeen(id: string): Promise<ErrorSeen | undefined> {
  if (!/^\d{1,15}$/.test(id)) return undefined;
  const [row] = await query<ErrorSeen>(`SELECT ${COLUMNS} FROM errors_seen WHERE id = $1`, [id]);
  return row;
}

/** Marks an error done, as the admin `by`, or with `by` null, to do again. It stays done until it happens again. */
export async function setErrorDone(id: number, by: string | null): Promise<void> {
  await query(
    `UPDATE errors_seen SET done_at = CASE WHEN $2::text IS NULL THEN NULL ELSE now() END, done_by = $2 WHERE id = $1`,
    [id, by],
  );
}

/** Deletes the errors not seen for a month. Returns how many went. */
export async function tidyErrorsSeen(): Promise<number> {
  const gone = await query("DELETE FROM errors_seen WHERE last_seen < now() - interval '1 month' RETURNING 1");
  return gone.length;
}
