import "server-only";
import type { ImportJob } from "@/lib/import-runs";
import { importControlAiLetter } from "./controlai-import";
import { syncEmails } from "./emails-sync";
import { readGmail } from "./gmail-reading";
import { importGoToParliament } from "./go-to-parliament-import";
import { runTidying } from "./log-retention";
import { importLuma } from "./luma-import";
import { importMembers } from "./members-import";
import { checkMps } from "./mp-check";
import { importOldLetters } from "./old-letters-import";
import { syncPoliticians } from "./politician-sync";
import { runSending } from "./sending-job";
import { importWebFormLetters } from "./web-form-import";

// What runs each job (lib/import-runs.ts, JOBS), whoever starts it: a
// function that runs it as a run of the import log, inside keepingFailure()
// (tests/checks/cron-runs.test.ts). A scheduled run comes through
// /api/cron/<job> (app/api/cron/[job]/route.ts), a staff member's through the
// job's button (runJobNow in app/(staff)/staff/actions.ts).

/**
 * Runs a job. `startedBy` is NIGHTLY or the staff member's email, and
 * `request` the scheduled call, for links in alerts; a staff member's run
 * has none. What it returns is what /api/cron/<job> answers: the run's
 * result, or a count of it.
 */
type RunJob = (startedBy: string, request?: Request) => Promise<unknown>;

const RUNS: Record<ImportJob, RunJob> = {
  "import-old-letters": (by) => importOldLetters(by),
  "import-luma": (by) => importLuma(by),
  "import-members": (by) => importMembers(by),
  "read-gmail": (by, request) => readGmail(by, request),
  "send-mailings": (by, request) => runSending(by, request),
  "sync-politicians": async (by) => {
    const { status, changes, renamed, statuses } = await syncPoliticians(by);
    return {
      status,
      added: changes.added.length,
      removed: changes.removed.length,
      changed: changes.changed.length,
      renamed: renamed.length,
      statuses,
    };
  },
  "sync-emails": (by) => syncEmails(by),
  "check-mps": async (by) => ({ problems: (await checkMps(by)).length }),
  "import-controlai": (by) => importControlAiLetter(by),
  "import-web-form-letters": (by) => importWebFormLetters(by),
  "import-go-to-parliament": (by) => importGoToParliament(by),
  "tidy-logs": (by) => runTidying(by),
};

/** Runs a job, and says what the run did. A failure is kept as a failed run, then thrown on. */
export function runJob(job: ImportJob, startedBy: string, request?: Request): Promise<unknown> {
  return RUNS[job](startedBy, request);
}
