import "server-only";
import type { ChangeSort } from "@/lib/staff-lists";
import { windowStart } from "@/lib/staff-dashboard";
import type { SortSpec } from "@/lib/staff-sort";
import { auditActions, type AuditEntry } from "@/lib/server/audit.server";
import { query } from "@/lib/server/db.server";
import { sql } from "@/lib/server/sql.server";

// The audit log as its page reads it (lib/server/audit.server.ts writes it):
// a page of entries, each with whom it's about, and the filters' choices.

/** Someone an entry is about, while they're still here: their ID, and their name if they have one. */
export type Named = { id: number; name: string | null };

/** An entry for the audit log's page, with the politician or supporter it's about. */
export type LoggedChange = AuditEntry & { politician: Named | null; supporter: Named | null };

/** The ID of the politician an entry is about: by `id` in the details of these actions, by `politicianId` in others'. */
const POLITICIAN_ID = `CASE WHEN a.action = ANY(ARRAY[${auditActions("add politician", "edit politician", "remove politician", "delete politician")}])
  THEN a.details->>'id' ELSE a.details->>'politicianId' END`;

/** The ID of the supporter an entry is about. */
const SUPPORTER_ID = `(CASE WHEN a.action = ${auditActions("view supporter")} THEN a.details->>'id' ELSE a.details->>'supporterId' END)::bigint`;

/**
 * The entries staff without `supporters` see: not those about a supporter or a message to them,
 * nor downloads, whose filters may name one, nor an address that isn't a politician's.
 */
const WITHOUT_SUPPORTERS = `NOT (
  action = ANY(ARRAY[${auditActions(
    "view supporter",
    "erase supporter",
    "download supporters",
    "download letters",
    "download blocked emails",
    "create broadcast",
    "change broadcast consent",
    "submit broadcast template",
    "withdraw broadcast template",
    "schedule broadcast",
    "stop broadcast",
    "resume broadcast",
  )}])
  OR details ? 'supporterId'
  OR (action = ANY(ARRAY[${auditActions("block address", "unblock address")}])
    AND NOT EXISTS (SELECT 1 FROM notable_people n WHERE lower(n.email) = lower(details->>'address')))
)`;

/** Entries on a page of the audit log. */
export const AUDIT_PAGE_SIZE = 100;

/** Which entries the log's page shows, and in what order. */
export type ChangesFilter = {
  /** Over who and what, the details as logged, and the name of whom it's about. */
  search?: string;
  actor?: string[];
  action?: string[];
  /** Only those of the last so many days. */
  days?: number;
  /** Those with none of these. */
  not?: { actor?: string[]; action?: string[] };
  sort?: SortSpec<ChangeSort>;
  page?: number;
};

/** Each sort's column in the query. */
const SORT_COLUMNS: Record<ChangeSort, string> = { day: "a.at", actor: "a.actor", action: "a.action" };

/** A page of the audit log and how many entries and pages it has. */
export type ChangesPage = { changes: LoggedChange[]; total: number; pages: number; pageSize: number };

/** Those `supporters` says they may see: every entry, or not those about a supporter. */
const visibleTo = (supporters: boolean) => (supporters ? "true" : WITHOUT_SUPPORTERS);

/**
 * A page of the entries a filter finds, newest first unless it says
 * otherwise, each with whom it's about, as far as `supporters` says they may
 * see; with a `limit` of null, every one, for a download. Whom it's about is
 * looked up for the page's entries only, not every one before them.
 */
export async function recentChanges(
  supporters: boolean,
  { search, actor, action, days, not, sort = { key: "day", dir: "desc" }, page = 1 }: ChangesFilter = {},
  limit: number | null = AUDIT_PAGE_SIZE,
): Promise<ChangesPage> {
  const conditions = [sql.raw(visibleTo(supporters))];
  if (search) {
    const like = sql`${`%${search}%`}`;
    conditions.push(
      sql`a.actor ILIKE ${like} OR a.action ILIKE ${like} OR a.details::text ILIKE ${like}
        OR ${sql.raw(POLITICIAN_ID)} IN (SELECT n.id::text FROM notable_people n WHERE n.name ILIKE ${like})
        OR ${sql.raw(SUPPORTER_ID)} IN (SELECT s.id FROM supporters_listed s WHERE s.name ILIKE ${like})`,
    );
  }
  if (actor) conditions.push(sql`a.actor = ANY(${actor})`);
  if (action) conditions.push(sql`a.action = ANY(${action})`);
  if (not?.actor) conditions.push(sql`a.actor <> ALL(${not.actor})`);
  if (not?.action) conditions.push(sql`a.action <> ALL(${not.action})`);
  if (days) conditions.push(sql`a.at >= ${windowStart(days)}`);
  const where = sql.where(conditions);
  const order = sql.raw(`${SORT_COLUMNS[sort.key]} ${sort.dir === "asc" ? "ASC" : "DESC"}, a.at DESC, a.id DESC`);
  const [{ total }] = await query<{ total: number }>(sql`SELECT count(*)::int AS total FROM audit_log a ${where}`);
  const changes = await query<LoggedChange>(
    sql`SELECT a.id::int AS id, a.at, a.actor, a.action, a.details,
       (SELECT json_build_object('id', p.id, 'name', p.name) FROM notable_people p
        WHERE p.id::text = ${sql.raw(POLITICIAN_ID)}) AS politician,
       (SELECT json_build_object('id', s.id, 'name', s.name) FROM supporters_listed s
        WHERE s.id = ${sql.raw(SUPPORTER_ID)}) AS supporter
     FROM (SELECT a.* FROM audit_log a ${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * (limit ?? 0)}) a ORDER BY ${order}`,
  );
  return { changes, total, pages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)), pageSize: AUDIT_PAGE_SIZE };
}

/** Everyone in the log and everything they've done, of the entries `supporters` says they may see: the log's filters' choices. */
export async function changeChoices(supporters: boolean): Promise<{ actors: string[]; actions: string[] }> {
  const [choices] = await query<{ actors: string[]; actions: string[] }>(
    `SELECT coalesce(array_agg(DISTINCT a.actor ORDER BY a.actor), '{}') AS actors,
       coalesce(array_agg(DISTINCT a.action ORDER BY a.action), '{}') AS actions
     FROM audit_log a WHERE ${visibleTo(supporters)}`,
  );
  return choices;
}
