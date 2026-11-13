import "server-only";
import { CONTROLAI_STATEMENT_ASK } from "@/lib/asks";
import { staffCopy } from "@/lib/content/staff-interface";
import { CONTROLAI } from "@/lib/controlai-letter";
import { nameSlug, statementSupporters, type StatementSupporter } from "@/lib/controlai-statement";
import type { ControlAiStatementResult } from "@/lib/import-runs";
import { BODY_HOUSES, type Body } from "@/lib/politician-import";
import { logChange } from "./audit";
import { query, transaction } from "./db";
import { asRun } from "./import-runs";
import { fetchStatement } from "./outside-services/controlai";
import { problem } from "./problems";

// Copies the supporters of ControlAI's statement into the statuses of its
// ask (CONTROLAI_STATEMENT_ASK), nightly (/api/cron/import-controlai-statement)
// or when staff ask, as the ControlAI import does for its letter. Each
// supporter is matched by their body's ID for them, or by the name in their
// page's address, among the politicians in office. As every sitting
// politician is on our list, one who matches no one is a fault, reported as a
// problem of the run. Statuses it set for supporters no longer linked go; it
// never touches another ask's, or one set by anything else.

const JOB = "import-controlai-statement";

/** Fewer supporters than this means the page has changed shape, so nothing is changed. */
const MIN_SUPPORTERS = 5;

type Candidate = { id: number; house: string; officialId: number | null; name: string };

/** The body a house is in. */
const bodyOf = (house: string) =>
  (Object.keys(BODY_HOUSES) as Body[]).find((body) => (BODY_HOUSES[body] as string[]).includes(house));

/** The politician a supporter's link is to, if exactly one. */
function matchSupporter(supporter: StatementSupporter, candidates: Candidate[]): number | undefined {
  const found = candidates.filter(
    (c) =>
      bodyOf(c.house) === supporter.body &&
      ("id" in supporter ? c.officialId === supporter.id : nameSlug(c.name) === supporter.slug),
  );
  return found.length === 1 ? found[0].id : undefined;
}

/** Reads the statement's page and makes its ask's statuses match it. Keeps the result, or the failure, then throws it on. */
export async function importControlAiStatement(startedBy: string): Promise<ControlAiStatementResult> {
  const { result } = await asRun(JOB, startedBy, async () => {
    const supporters = statementSupporters(await fetchStatement());
    if (supporters.length < MIN_SUPPORTERS) {
      throw new Error(
        `Only ${supporters.length} supporters linked from ControlAI's statement: has its page changed shape?`,
      );
    }
    const result = await transaction(async (db) => {
      const candidates = await query<Candidate>(
        `SELECT n.id::int AS id, p.house, p.official_id AS "officialId", n.name
         FROM notable_people n JOIN politicians p ON p.id = n.id
         WHERE NOT p.is_test AND n.status = 'in_office' ORDER BY n.id`,
        [],
        db,
      );
      const ids = new Set<number>();
      const unmatched: string[] = [];
      for (const supporter of supporters) {
        const id = matchSupporter(supporter, candidates);
        if (id === undefined) unmatched.push(supporter.link);
        else ids.add(id);
      }
      const added = await query<{ politicianId: number; date: string }>(
        `INSERT INTO ask_statuses (notable_person_id, ask, ask_kind, status, status_date, updated_by)
         SELECT id, $2, 'letter', 'signed', now()::date, $3 FROM unnest($1::bigint[]) AS id
         ON CONFLICT (notable_person_id, ask) DO NOTHING
         RETURNING notable_person_id::int AS "politicianId", to_char(status_date, 'YYYY-MM-DD') AS date`,
        [[...ids], CONTROLAI_STATEMENT_ASK, CONTROLAI],
        db,
      );
      const removed = await query<{ politicianId: number }>(
        `DELETE FROM ask_statuses WHERE ask = $2 AND updated_by = $3 AND NOT (notable_person_id = ANY($1::bigint[]))
         RETURNING notable_person_id::int AS "politicianId"`,
        [[...ids], CONTROLAI_STATEMENT_ASK, CONTROLAI],
        db,
      );
      for (const { politicianId, date } of added) {
        await logChange(
          CONTROLAI,
          "set status",
          { politicianId, ask: CONTROLAI_STATEMENT_ASK, status: "signed", date, note: "" },
          db,
        );
      }
      for (const { politicianId } of removed) {
        await logChange(
          CONTROLAI,
          "set status",
          { politicianId, ask: CONTROLAI_STATEMENT_ASK, status: null, date: null, note: "" },
          db,
        );
      }
      return {
        supporters: supporters.length,
        matched: ids.size,
        added: added.length,
        removed: removed.length,
        unmatched,
      } satisfies ControlAiStatementResult;
    });
    if (result.unmatched.length > 0) problem(staffCopy.controlAiStatement.unmatched, result.unmatched.join(", "));
    return { status: "ok", result } as const;
  });
  return result;
}
