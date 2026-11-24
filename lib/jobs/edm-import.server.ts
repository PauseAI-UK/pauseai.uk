import "server-only";
import { EDM_ASK } from "@/lib/asks/asks";
import type { EdmResult } from "@/lib/import-runs";
import { BODY_HOUSES } from "@/lib/politicians/import-changes";
import { logChange } from "@/lib/server/audit.server";
import { query, transaction } from "@/lib/server/db.server";
import { asRun } from "@/lib/server/import-runs.server";
import { edmSignersNow } from "@/lib/server/outside-services/parliament.server";
import { problem } from "@/lib/server/problems.server";
import { jobProblems } from "./copy";
import { publicText } from "@/lib/problems";

// Copies the signers of the superintelligence EDM (lib/asks/edm.ts) into the
// statuses of its ask (EDM_ASK), nightly (/api/cron/import-edm) or when
// staff ask, as the ControlAI imports do for theirs. Each signer is matched
// by Parliament's ID for them, among Parliament's members in office or not,
// as a signer stays one after leaving. As every MP is on our list, one who
// matches no one is a fault, reported as a problem of the run. Statuses it
// set for those no longer signed go; it never touches another ask's, or one
// set by anything else.

const JOB = "import-edm";

/** Who sets the statuses, in `updated_by`, and so whose they are to remove. */
const BY = "parliament";

/** Reads the EDM's signers and makes its ask's statuses match them. Keeps the result, or the failure, then throws it on. */
export async function importEdm(startedBy: string): Promise<EdmResult> {
  const { result } = await asRun(JOB, startedBy, async () => {
    const signers = await edmSignersNow();
    // The sponsor signs it as it's tabled, so none means the answer has changed shape.
    if (signers.length === 0) throw new Error("No one has signed the EDM: has Parliament's answer changed shape?");
    const result = await transaction(async (db) => {
      const found = await query<{ id: number; officialId: number }>(
        `SELECT p.id::int AS id, p.official_id AS "officialId" FROM politicians p
         WHERE NOT p.is_test AND p.house = ANY($2::text[]) AND p.official_id = ANY($1::int[])`,
        [signers.map((s) => s.id), BODY_HOUSES.parliament],
        db,
      );
      const byOfficialId = new Map(found.map((p) => [p.officialId, p.id]));
      const matched = signers.filter((s) => byOfficialId.has(s.id));
      const ids = matched.map((s) => byOfficialId.get(s.id)!);
      const added = await query<{ politicianId: number; date: string }>(
        `INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, status_date, updated_by)
         SELECT u.id, $2, 'letter', 'signed', u.date, $3 FROM unnest($1::bigint[], $4::date[]) AS u (id, date)
         ON CONFLICT (notable_person_id, ask) DO NOTHING
         RETURNING notable_person_id::int AS "politicianId", to_char(status_date, 'YYYY-MM-DD') AS date`,
        [ids, EDM_ASK, BY, matched.map((s) => s.date)],
        db,
      );
      const removed = await query<{ politicianId: number }>(
        `DELETE FROM ask_statuses WHERE ask = $2 AND updated_by = $3 AND NOT (notable_person_id = ANY($1::bigint[]))
         RETURNING notable_person_id::int AS "politicianId"`,
        [ids, EDM_ASK, BY],
        db,
      );
      for (const { politicianId, date } of added) {
        await logChange(BY, "set status", { politicianId, ask: EDM_ASK, status: "signed", date, note: "" }, db);
      }
      for (const { politicianId } of removed) {
        await logChange(BY, "set status", { politicianId, ask: EDM_ASK, status: null, date: null, note: "" }, db);
      }
      return {
        signers: signers.length,
        matched: matched.length,
        added: added.length,
        removed: removed.length,
        unmatched: signers.filter((s) => !byOfficialId.has(s.id)).map((s) => `${s.name} (${s.id})`),
      } satisfies EdmResult;
    });
    if (result.unmatched.length > 0) problem(jobProblems.edmUnmatched({ signers: result.unmatched.map(publicText) }));
    return { status: "ok", result } as const;
  });
  return result;
}
