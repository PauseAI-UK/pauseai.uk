import "server-only";
import type { MembersImportResult } from "@/lib/import-runs";
import { query, transaction, type Queryable } from "./db";
import { lookUpNewMembers } from "./civicrm-import";
import { asRun } from "./import-runs";
import { airtableToken, fetchMembers, type MemberToImport } from "./outside-services/airtable";
import { refreshSupporterFacts, refreshSupportersList } from "./supporter-facts";
import { linkSupporters } from "./supporters";

// Copies PauseAI's UK members whom we may hold from Stichting PauseAI's
// Airtable into `airtable_members`: hourly (/api/cron/import-members) or
// when staff ask, each run in the import log as "import-members". Every run
// reads every one of them, so a run is whole and the next corrects anything
// the last missed. An upsert touches a row only when a value differs; a
// member no longer read is marked removed, and kept, with their links,
// until they're erased.
//
// A member's details count only while CiviCRM, where members come from,
// has never returned them: for those, their name, number, place, intent and
// "Keep me informed" are read from here. A new member's address is looked
// up in CiviCRM at the end of the run, as the hourly pull may not have them
// yet.

const JOB = "import-members";

/** Upserts the members, but none erased; returns how many were added and how many changed. */
async function upsertMembers(members: MemberToImport[], db: Queryable): Promise<{ added: number; changed: number }> {
  const rows = await query<{ added: boolean }>(
    `INSERT INTO airtable_members AS a (id, email, name, phone, city, postcode, joined_at, created_at, keep_informed,
       share_permission, intent, source_modified_at)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::timestamptz[],
       $8::timestamptz[], $9::boolean[], $10::boolean[], $11::text[], $12::timestamptz[])
       AS m(id, email, name, phone, city, postcode, joined_at, created_at, keep_informed, share_permission, intent, source_modified_at)
     WHERE m.id NOT IN (SELECT id FROM airtable_members_erased)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, phone = EXCLUDED.phone,
       city = EXCLUDED.city, postcode = EXCLUDED.postcode, joined_at = EXCLUDED.joined_at,
       created_at = EXCLUDED.created_at, keep_informed = EXCLUDED.keep_informed,
       share_permission = EXCLUDED.share_permission, intent = EXCLUDED.intent,
       source_modified_at = EXCLUDED.source_modified_at, removed_at = NULL, changed_at = now()
     WHERE (a.email, a.name, a.phone, a.city, a.postcode, a.joined_at, a.created_at, a.keep_informed,
         a.share_permission, a.intent, a.source_modified_at, a.removed_at)
       IS DISTINCT FROM (EXCLUDED.email, EXCLUDED.name, EXCLUDED.phone, EXCLUDED.city, EXCLUDED.postcode,
         EXCLUDED.joined_at, EXCLUDED.created_at, EXCLUDED.keep_informed, EXCLUDED.share_permission,
         EXCLUDED.intent, EXCLUDED.source_modified_at, NULL)
     RETURNING xmax = 0 AS added`,
    [
      members.map((m) => m.id),
      members.map((m) => m.email),
      members.map((m) => m.name),
      members.map((m) => m.phone),
      members.map((m) => m.city),
      members.map((m) => m.postcode),
      members.map((m) => m.joinedAt),
      members.map((m) => m.createdAt),
      members.map((m) => m.keepInformed),
      members.map((m) => m.sharePermission),
      members.map((m) => m.intent),
      members.map((m) => m.modifiedAt),
    ],
    db,
  );
  const added = rows.filter((row) => row.added).length;
  return { added, changed: rows.length - added };
}

/** Marks removed every member not read this run; returns how many. */
async function markRemoved(ids: string[], db: Queryable): Promise<number> {
  const rows = await query(
    `UPDATE airtable_members SET removed_at = now(), changed_at = now()
     WHERE removed_at IS NULL AND NOT (id = ANY($1::text[])) RETURNING id`,
    [ids],
    db,
  );
  return rows.length;
}

/** Runs the import, keeping the run. A failure, of Airtable's or the database's, rolls the run back. */
export async function importMembers(startedBy: string): Promise<MembersImportResult> {
  const { result } = await asRun(JOB, startedBy, async () => {
    const members = await fetchMembers(airtableToken());
    return transaction(async (db) => {
      const { added, changed } = await upsertMembers(members, db);
      const removed = await markRemoved(
        members.map((m) => m.id),
        db,
      );
      // Before linking, so the contacts it finds link to their members in this run.
      const civicrm = await lookUpNewMembers(db);
      const result: MembersImportResult = {
        members: members.length,
        added,
        changed,
        removed,
        ...(await linkSupporters(db, true)),
      };
      // A record already linked may have changed, so everyone's facts, not only the newly linked.
      await refreshSupporterFacts(db);
      await refreshSupportersList(db);
      if (civicrm > 0) result.civicrm = civicrm;
      const anything = added + changed + result.removed + result.linked + civicrm;
      return { status: anything > 0 ? "ok" : "unchanged", result } as const;
    });
  });
  return result;
}
