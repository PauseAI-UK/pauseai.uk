import "server-only";
import { IMPORT_JOBS, POLITICIAN_IMPORT_JOBS, type PoliticianImportJob } from "@/lib/import-runs";
import { query } from "@/lib/server/db.server";
import { latestRun } from "@/lib/server/import-runs.server";
import type { DashboardAction } from "./dashboard";

// What needs a person, at the top of the dashboard: each import held for a
// decision, each politician in office whose address is blocked, any import
// whose newest run failed, mail in the letters inbox a read couldn't
// handle, and replies to broadcasts waiting to be checked.

/** Every import of a body's members still held for a decision, oldest first. */
async function heldImports(): Promise<DashboardAction[]> {
  const rows = await query<{ job: PoliticianImportJob; at: Date; added: number; left: number; changed: number }>(
    `SELECT job, at, jsonb_array_length(result->'changes'->'added')::int AS added,
            jsonb_array_length(result->'changes'->'left')::int AS left,
            jsonb_array_length(result->'changes'->'changed')::int AS changed
     FROM import_runs WHERE job = ANY($1::text[]) AND status = 'held' ORDER BY at, id`,
    [POLITICIAN_IMPORT_JOBS],
  );
  return rows.map((row) => ({ kind: "held-import", ...row }));
}

/** Every politician in office whose address is blocked, with the problem that blocked it, oldest first. */
async function blockedMps(): Promise<DashboardAction[]> {
  const rows = await query<{ politicianId: number; name: string; isTest: boolean; at: Date }>(
    `SELECT p.id::int AS "politicianId", p.name, coalesce(seat.is_test, false) AS "isTest", pr.at
     FROM notable_people p JOIN email_blocks b ON b.address = lower(p.email) JOIN email_problems pr ON pr.id = b.problem_id
     LEFT JOIN politicians seat ON seat.id = p.id
     WHERE p.status = 'in_office' ORDER BY pr.at, p.id`,
  );
  return rows.map(({ at, ...rest }) => ({ kind: "blocked-mp", at, ...rest }));
}

/** Replies to broadcasts that may be opt-outs, waiting for staff: how many, and the broadcast with the oldest. */
async function broadcastReplies(): Promise<DashboardAction[]> {
  const [waiting] = await query<{ count: number; broadcastId: number }>(
    `SELECT count(*)::int AS count, (array_agg(c.mailing_id ORDER BY r.received_at))[1]::int AS "broadcastId"
     FROM broadcast_replies r JOIN broadcast_messages c ON c.id = r.message_id
     WHERE r.outcome IS NULL AND NOT r.automatic HAVING count(*) > 0`,
  );
  return waiting ? [{ kind: "broadcast-replies", ...waiting }] : [];
}

/** What waits for a person now. */
export async function needsAPerson(): Promise<DashboardAction[]> {
  const [held, blocked, imports, replies] = await Promise.all([
    heldImports(),
    blockedMps(),
    Promise.all(IMPORT_JOBS.map((job) => latestRun(job))),
    broadcastReplies(),
  ]);
  const failed: DashboardAction[] = imports.flatMap((run) =>
    run?.status === "failed" ? [{ kind: "failed-import", job: run.job, at: run.at, error: run.error }] : [],
  );
  // Mail in the letters inbox a read couldn't handle, which waits there for a person.
  const inbox: DashboardAction[] = imports.flatMap((run) =>
    run?.job === "read-gmail" && run.status !== "failed"
      ? run.result.accounts.flatMap((account) =>
          account.notUnderstood?.length
            ? [
                {
                  kind: "letters-inbox" as const,
                  inbox: account.account,
                  count: account.notUnderstood.length,
                  at: run.at,
                },
              ]
            : [],
        )
      : [],
  );
  return [...held, ...blocked, ...failed, ...inbox, ...replies];
}
