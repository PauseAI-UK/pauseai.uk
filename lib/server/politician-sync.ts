import "server-only";
import { changedFields } from "@/lib/field-changes";
import type { PoliticianSyncResult } from "@/lib/import-runs";
import type { SyncedPolitician } from "@/lib/politician-sync";
import { airtableToken, fetchPoliticians } from "./outside-services/airtable";
import { logChange } from "./audit";
import { query, transaction } from "./db";
import { asRun } from "./import-runs";

// Copies from Airtable's UK Parliamentarians what no body lists, when staff
// press its button: each politician's salutation, Airtable's two markers
// (important target, personal connection) and notes. The politicians
// themselves, and every other detail, come from the bodies' own lists
// (lib/server/politician-import.ts). A record is matched to its politician
// by its ID, or else by name, among those not yet matched to one. A record
// matched to no one is listed, not added. Every run goes in the import log
// (import-runs.ts), as "sync-politicians".

const JOB = "sync-politicians";
/** The audit log's actor for what the copy changes. */
const SYNC = "sync";

/** What the copy writes. */
type Copied = Pick<SyncedPolitician, "salutation" | "notes" | "importantTarget" | "personalConnection">;

type Ours = Copied & { id: number; airtableId: string | null; name: string };

/** Copies what Airtable has that no body lists, keeping the run. `startedBy` is the staff member's email. */
export async function syncPoliticians(startedBy: string): Promise<PoliticianSyncResult & { unmatched: string[] }> {
  const { result } = await asRun(JOB, startedBy, async () => {
    const records = (await fetchPoliticians(airtableToken())).map((record) => record.politician);
    const result = await transaction(async (db) => {
      const ours = await query<Ours>(
        `SELECT n.id::int AS id, n.airtable_id AS "airtableId", n.name, n.salutation, n.notes,
           n.important_target AS "importantTarget", n.personal_connection AS "personalConnection"
         FROM notable_people n JOIN politicians p ON p.id = n.id WHERE NOT p.is_test ORDER BY n.id`,
        [],
        db,
      );
      const byRecord = new Map(ours.filter((p) => p.airtableId).map((p) => [p.airtableId, p]));
      const taken = new Set(byRecord.values());
      const changed: SyncedPolitician[] = [];
      const unmatched: string[] = [];
      for (const record of records) {
        const ourOne =
          byRecord.get(record.airtableId) ?? ours.find((p) => !p.airtableId && !taken.has(p) && p.name === record.name);
        if (!ourOne) {
          unmatched.push(record.name);
          continue;
        }
        taken.add(ourOne);
        const copied: Copied = {
          salutation: record.salutation || ourOne.salutation,
          notes: record.notes,
          importantTarget: record.importantTarget,
          personalConnection: record.personalConnection,
        };
        const was = { ...pick(ourOne), airtableId: ourOne.airtableId };
        const diff = changedFields(was, { ...copied, airtableId: record.airtableId });
        if (Object.keys(diff).length === 0) continue;
        await query(
          `UPDATE notable_people SET airtable_id = $2, salutation = $3, notes = $4, important_target = $5,
             personal_connection = $6, salutation_to_check = salutation_to_check AND salutation = $3, updated_at = now()
           WHERE id = $1`,
          [
            ourOne.id,
            record.airtableId,
            copied.salutation,
            copied.notes,
            copied.importantTarget,
            copied.personalConnection,
          ],
          db,
        );
        await logChange(SYNC, "edit politician", { id: ourOne.id, name: ourOne.name, changed: diff }, db);
        changed.push(record);
      }
      return { changes: { added: [], removed: [], changed }, unmatched } satisfies PoliticianSyncResult;
    });
    return { status: result.changes.changed.length > 0 ? "applied" : "unchanged", result } as const;
  });
  return result;
}

const pick = ({ salutation, notes, importantTarget, personalConnection }: Copied): Copied => ({
  salutation,
  notes,
  importantTarget,
  personalConnection,
});
