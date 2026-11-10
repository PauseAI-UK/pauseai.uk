import "server-only";
import { config } from "./config";
import { changedFields } from "@/lib/field-changes";
import { staffCopy } from "@/lib/content/staff-interface";
import { importPath, type PoliticianSyncResult } from "@/lib/import-runs";
import type { AirtableMp } from "@/lib/mp-check";
import {
  changeCount,
  comparePoliticians,
  MAX_UNCHECKED_CHANGES,
  renamedIn,
  type PoliticianChanges,
  type PoliticianRecord,
  type Renamed,
  type SyncedPolitician,
} from "@/lib/politician-sync";
import { TEST_MPS } from "@/lib/test-mps";
import { airtableToken, fetchPoliticians } from "./outside-services/airtable";
import { logChange } from "./audit";
import { query, transaction, type Queryable } from "./db";
import { asRun } from "./import-runs";
import { notifyStaff, staffLink } from "./notifications";
import { addPolitician } from "./politicians";

// Copies every politician from Airtable's UK Parliamentarians into the
// database, nightly (/api/cron/sync-politicians) or when staff ask, keyed
// by the record's ID. A sync that would change more than
// MAX_UNCHECKED_CHANGES politicians, or any one's name, is held for a
// person to check. Their answers to asks aren't Airtable's: staff set them
// here, as do the ControlAI import for its letter. Every run goes in the
// import log (import-runs.ts), as "sync-politicians".

const JOB = "sync-politicians";
/** The audit log's actor for the politicians the sync adds, changes and loses. */
const SYNC = "sync";

export type SyncResult = {
  status: "applied" | "held" | "unchanged";
  changes: PoliticianChanges;
  renamed: Renamed[];
};

const SYNCED_COLUMNS = `n.airtable_id AS "airtableId", n.name, n.salutation, n.email, n.status,
  p.house, p.constituency, p.party, p.country, n.notes, n.important_target AS "importantTarget",
  n.personal_connection AS "personalConnection"`;

/** The politicians copied from Airtable whose records it still has, as the sync compares them. */
async function syncedPoliticians(db: Queryable): Promise<SyncedPolitician[]> {
  return query<SyncedPolitician>(
    `SELECT ${SYNCED_COLUMNS} FROM notable_people n JOIN politicians p ON p.id = n.id
     WHERE n.airtable_id IS NOT NULL AND n.airtable_removed_at IS NULL ORDER BY n.airtable_id`,
    [],
    db,
  );
}

/** The records Airtable no longer had. */
async function goneRecords(db: Queryable): Promise<Set<string>> {
  const rows = await query<{ airtableId: string }>(
    `SELECT airtable_id AS "airtableId" FROM notable_people WHERE airtable_removed_at IS NOT NULL`,
    [],
    db,
  );
  return new Set(rows.map((row) => row.airtableId));
}

/** The MPs in office copied from Airtable, by constituency, for the check against Parliament. */
export async function mpsInOffice(): Promise<AirtableMp[]> {
  return query<AirtableMp>(
    `SELECT n.name, p.constituency, n.email FROM notable_people n JOIN politicians p ON p.id = n.id
     WHERE n.airtable_id IS NOT NULL AND n.airtable_removed_at IS NULL AND n.status = 'in_office'
       AND p.house = 'commons' AND p.constituency IS NOT NULL
     ORDER BY p.constituency`,
  );
}

/**
 * The test MPs, whose letters go to TEST_MP_EMAIL: kept in step with that
 * setting on every sync, except the one who has no email and the one with
 * an address of their own. Their statuses are set only when they're added,
 * so staff can change them.
 */
async function ensureTestMps(db: Queryable): Promise<void> {
  const email = config.testMpEmail ?? null;
  for (const mp of TEST_MPS) {
    const address = mp.noEmail ? null : (mp.email ?? email);
    const [existing] = await query<{ id: number }>(
      `UPDATE notable_people SET email = $2, updated_at = now()
       WHERE id = (SELECT id FROM politicians WHERE test_postcode = $1) RETURNING id::int AS id`,
      [mp.postcode, address],
      db,
    );
    if (existing) continue;
    const id = await addPolitician(
      { house: "commons", name: mp.name, salutation: mp.salutation, constituency: mp.constituency, email: address },
      db,
      mp.postcode,
    );
    for (const [ask, status] of Object.entries(mp.statuses)) {
      await query(
        `INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, updated_by)
         SELECT $1, slug, kind, $3, 'sync' FROM asks WHERE slug = $2`,
        [id, ask, status],
        db,
      );
    }
  }
}

/** Writes one politician's details over their rows, and marks their record as in Airtable. */
async function writePolitician(id: number, p: SyncedPolitician, db: Queryable): Promise<void> {
  await query(
    `UPDATE notable_people SET airtable_id = $2, name = $3, salutation = $4, email = $5,
       status = $6, notes = $7, important_target = $8, personal_connection = $9, airtable_removed_at = NULL,
       updated_at = now()
     WHERE id = $1`,
    [id, p.airtableId, p.name, p.salutation, p.email, p.status, p.notes, p.importantTarget, p.personalConnection],
    db,
  );
  await query(
    "UPDATE politicians SET house = $2, constituency = $3, party = $4, country = $5 WHERE id = $1",
    [id, p.house, p.constituency, p.party, p.country],
    db,
  );
}

/**
 * Makes the tables match `politicians`: adds and updates them, and marks
 * those whose records have gone, keeping their status. One added who was
 * here before Airtable, added by hand under the same name, is taken to be
 * them. Each politician added, changed or gone gets their own entry in the
 * audit log, by their row's id, so their page can tell it
 * (lib/server/politicians.ts, politicianHistory).
 */
async function applyPoliticians(politicians: SyncedPolitician[], db: Queryable): Promise<void> {
  const before = await syncedPoliticians(db);
  const changes = comparePoliticians(before, politicians, await goneRecords(db));
  const was = new Map(before.map((p) => [p.airtableId, p]));
  const added = new Set(changes.added.map((p) => p.airtableId));
  for (const p of [...changes.added, ...changes.changed]) {
    const [row] = await query<{ id: number }>(
      `SELECT n.id::int AS id FROM notable_people n JOIN politicians p ON p.id = n.id
       WHERE n.airtable_id = $1
          OR ($3 AND n.airtable_id IS NULL AND NOT p.is_test AND n.name = $2)
       ORDER BY n.airtable_id NULLS LAST LIMIT 1`,
      [p.airtableId, p.name, added.has(p.airtableId)],
      db,
    );
    const id = row?.id ?? (await addPolitician({ house: p.house, name: p.name, email: p.email }, db));
    await writePolitician(id, p, db);
    const { airtableId, ...details } = p;
    if (added.has(airtableId)) {
      await logChange(SYNC, "add politician", { id, airtableId, ...details }, db);
    } else {
      // What changed, each field before and after, and their name to know them by.
      const changed = changedFields(was.get(airtableId) ?? {}, p);
      await logChange(SYNC, "edit politician", { id, airtableId, name: p.name, changed }, db);
    }
  }
  const gone = await query<{ id: number; name: string }>(
    `UPDATE notable_people SET airtable_removed_at = now(), updated_at = now()
     WHERE airtable_id = ANY($1::text[]) RETURNING id::int AS id, name`,
    [changes.removed.map((p) => p.airtableId)],
    db,
  );
  for (const p of gone) await logChange(SYNC, "remove politician", p, db);
}

/**
 * Fetches the politicians from Airtable and applies them, or holds them if
 * too much has changed or a name has, keeping the run either way.
 * `startedBy` is NIGHTLY or the staff member's email.
 */
export async function syncPoliticians(startedBy: string): Promise<SyncResult> {
  const { status, result, renamed } = await asRun(JOB, startedBy, async () => {
    const records = await fetchPoliticians(airtableToken());
    const fetched = records.map((record) => record.politician);
    // Whether this run holds a sync when none was held before, to email about once it's kept.
    let newlyHeld = false;
    const synced = await transaction(async (db) => {
      await ensureTestMps(db);
      const before = await syncedPoliticians(db);
      const changes = comparePoliticians(before, fetched, await goneRecords(db));
      const renamed = renamedIn(before, changes);
      const count = changeCount(changes);
      // The very first sync fills an empty table, so there's nothing to check it against.
      const held = (count > MAX_UNCHECKED_CHANGES && before.length > 0) || renamed.length > 0;
      if (count > 0 && !held) await applyPoliticians(fetched, db);
      const status: SyncResult["status"] = held ? "held" : count > 0 ? "applied" : "unchanged";
      const result: PoliticianSyncResult = { changes, renamed, ...(held ? { records } : {}) };
      const [heldBefore] = await query("SELECT 1 FROM import_runs WHERE job = $1 AND status = 'held'", [JOB], db);
      newlyHeld = held && !heldBefore;
      if (count > 0) {
        await logChange(
          SYNC,
          held ? "hold politician sync" : "apply politician sync",
          { added: changes.added.length, removed: changes.removed.length, changed: changes.changed.length },
          db,
        );
      }
      return { status, result, renamed };
    });
    if (newlyHeld) {
      const words = staffCopy.notifications.syncHeld;
      const count = changeCount(synced.result.changes);
      await notifyStaff(words.subject(count), words.body(count, staffLink(importPath(JOB), undefined)));
    }
    return synced;
  });
  return { status, changes: result.changes, renamed };
}

/** Applies or discards a held sync. False if there's no held sync with that ID. */
export async function decideHeldSync(id: number, decision: "apply" | "discard", staff: string): Promise<boolean> {
  return transaction(async (db) => {
    const [held] = await query<{ records: PoliticianRecord[] }>(
      "SELECT result->'records' AS records FROM import_runs WHERE id = $1 AND job = $2 AND status = 'held' FOR UPDATE",
      [id, JOB],
      db,
    );
    if (!held) return false;
    if (decision === "apply") {
      await applyPoliticians(
        held.records.map((record) => record.politician),
        db,
      );
    }
    await query(
      "UPDATE import_runs SET status = $2, decided_by = $3, decided_at = now() WHERE id = $1",
      [id, decision === "apply" ? "applied" : "discarded", staff],
      db,
    );
    await logChange(staff, `${decision} held politician sync`, { id }, db);
    return true;
  });
}
