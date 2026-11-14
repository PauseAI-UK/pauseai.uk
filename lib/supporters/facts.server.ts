import "server-only";
import { query, type Queryable } from "@/lib/server/db.server";

// What's worked out about each supporter from all their records, kept on the
// supporter so a page can read it for every supporter at once: when they
// were first seen (the supporter_first_seen view says how). Brought up to date
// for the supporters whose records were added or removed, and for everyone by
// the Luma, members and CiviCRM imports, which also catches a record that
// changed.

/**
 * Sets first seen to what their records now say for the supporters in
 * `only`, or for every supporter, writing only those that changed. Returns
 * how many did. Every supporter takes about a second at 100,000, so only
 * the Luma, members and CiviCRM imports do that, the Luma import at most
 * hourly when it changed nothing and the CiviCRM import only when a contact
 * changed; a few take a fraction of a millisecond.
 */
export async function refreshSupporterFacts(db?: Queryable, only?: number[]): Promise<number> {
  const rows = await query(
    `UPDATE supporters s SET first_seen_at = f.first_seen_at FROM supporter_first_seen f
     WHERE f.supporter_id = s.id AND s.first_seen_at IS DISTINCT FROM f.first_seen_at
       ${only ? "AND s.id = ANY($1::bigint[])" : ""} RETURNING s.id`,
    only ? [only] : [],
    db,
  );
  return rows.length;
}

/**
 * Works out the supporters list again (the supporters_list materialized
 * view, which supporters_listed reads), for everyone, while pages go on
 * reading the old one. About two seconds at 100,000 supporters, so only the
 * imports that add, link or change supporters' records run it, at their end, and an erasure,
 * so no one erased stays listed. Anyone added in between is listed anyway,
 * worked out as the list is read.
 */
export async function refreshSupportersList(db?: Queryable): Promise<void> {
  await query("REFRESH MATERIALIZED VIEW CONCURRENTLY supporters_list", [], db);
}
