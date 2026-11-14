import "server-only";
import { IMPORT_JOBS, type JobSchedule, jobSchedule, type TidyingResult } from "@/lib/import-runs";
import { ADDRESS_ACTIONS } from "@/lib/audit-events";
import { auditActions } from "@/lib/server/audit.server";
import { tidyErrorsSeen } from "@/lib/oversight/errors-seen.server";
import { asRun } from "@/lib/server/import-runs.server";
import { deleteForgottenDrafts } from "@/lib/mailings/drafts.server";
import { query } from "@/lib/server/db.server";

// How long the import log and the audit log keep what they hold, so neither
// grows for ever. Run once a day, by its own scheduled job
// (/api/cron/tidy-logs), which also deletes forgotten mailing drafts and
// old errors.
//
// An import run is kept for a week if its job runs every 5 or 15 minutes or hourly, and a month if it
// runs nightly. Every job keeps its newest run, however old, as its page shows it, and a held sync is kept
// until someone applies or discards it.
//
// An audit log entry is kept for a month, but for a politician's history
// (politicianHistory in ./politicians.ts): their row added, edited or
// removed, their statuses set, and their address blocked or unblocked. That
// is kept while the politician is.

const JOB = "tidy-logs";

const jobsThat = (schedule: JobSchedule) => IMPORT_JOBS.filter((job) => jobSchedule(job) === schedule);

/** An audit log entry `a` that's part of a politician's history, while they're here. */
const POLITICIAN_HISTORY = `(
  (a.action IN (${auditActions("add politician", "edit politician", "remove politician")})
    AND EXISTS (SELECT 1 FROM notable_people n WHERE n.id::text = a.details->>'id'))
  OR (a.action IN (${auditActions("set status", ...ADDRESS_ACTIONS)})
    AND EXISTS (SELECT 1 FROM notable_people n WHERE n.id::text = a.details->>'politicianId'))
  OR (a.action IN (${auditActions("block address", "unblock address")})
    AND EXISTS (SELECT 1 FROM notable_people n WHERE lower(n.email) = a.details->>'address')))`;

/**
 * One run of the tidying, kept in the import log: the logs (below), the
 * mailing drafts nobody wrote anything in, and the errors not seen for a
 * month (errors-seen.server.ts).
 */
export async function runTidying(startedBy: string): Promise<TidyingResult> {
  const { result } = await asRun(JOB, startedBy, async () => {
    const errors = await tidyErrorsSeen();
    const result: TidyingResult = { ...(await tidyLogs()), drafts: await deleteForgottenDrafts(), errors };
    const anything = result.importRuns + result.auditEntries + result.drafts + errors > 0;
    return { status: anything ? "ok" : "unchanged", result } as const;
  });
  return result;
}

/** Deletes what the logs no longer keep. Returns how many import runs and audit log entries went. */
export async function tidyLogs(): Promise<{ importRuns: number; auditEntries: number }> {
  const runs = await query(
    `DELETE FROM import_runs r
     WHERE r.status <> 'held'
       AND r.id <> (SELECT n.id FROM import_runs n WHERE n.job = r.job ORDER BY n.at DESC, n.id DESC LIMIT 1)
       AND ((r.job = ANY($1) AND r.status <> 'failed' AND r.problems = '[]'::jsonb AND r.at < now() - interval '7 days')
         OR (r.job = ANY($1) AND r.at < now() - interval '1 month')
         OR (r.job = ANY($2) AND r.at < now() - interval '1 month'))
     RETURNING 1`,
    [[...jobsThat("frequent"), ...jobsThat("quarter-hour"), ...jobsThat("hourly")], jobsThat("nightly")],
  );
  const entries = await query(
    `DELETE FROM audit_log a WHERE a.at < now() - interval '1 month' AND NOT ${POLITICIAN_HISTORY} RETURNING 1`,
  );
  return { importRuns: runs.length, auditEntries: entries.length };
}
