import "server-only";
import type { ImportJob } from "@/lib/import-runs";
import type { Body } from "@/lib/politicians/import-changes";
import { importControlAiLetter } from "./controlai-import.server";
import { readGmail } from "./gmail-reading.server";
import { startRunning, stopRunning } from "./import-runs.server";
import { runTidying } from "./log-retention.server";
import { importLuma } from "@/lib/events/luma-import.server";
import { importCivicrm } from "./civicrm-import.server";
import { importControlAiStatement } from "./controlai-statement-import.server";
import { importPoliticians } from "@/lib/politicians/imports.server";
import { runSending } from "./sending-job.server";

// What runs each job (lib/import-runs.ts, JOBS), whoever starts it, one run
// of a job at a time: a function that does it as a run of the import log,
// inside asRun() (tests/checks/cron-runs.test.ts), which keeps it. A
// scheduled run comes through /api/cron/<job> (app/api/cron/[job]/route.ts),
// a staff member's through the job's button (runJobNow in
// app/(staff)/staff/actions.ts).

/**
 * Runs a job. `startedBy` is NIGHTLY or the staff member's email, and
 * `request` the scheduled call, for links in alerts; a staff member's run
 * has none. What it returns is what /api/cron/<job> answers: the run's
 * result, or a count of it.
 */
type RunJob = (startedBy: string, request?: Request) => Promise<unknown>;

const RUNS: Record<ImportJob, RunJob> = {
  "import-luma": (by) => importLuma(by),
  "import-civicrm": (by) => importCivicrm(by),
  "read-gmail": (by, request) => readGmail(by, request),
  "send-mailings": (by, request) => runSending(by, request),
  "import-parliament": (by) => importPoliticianCounts("parliament", by),
  "import-scottish-parliament": (by) => importPoliticianCounts("scottish-parliament", by),
  "import-senedd": (by) => importPoliticianCounts("senedd", by),
  "import-ni-assembly": (by) => importPoliticianCounts("ni-assembly", by),
  "import-controlai": (by) => importControlAiLetter(by),
  "import-controlai-statement": (by) => importControlAiStatement(by),
  "tidy-logs": (by) => runTidying(by),
};

/** A body's import, answering with its counts. */
async function importPoliticianCounts(body: Body, by: string) {
  const { status, result } = await importPoliticians(body, by);
  const { added, changed, left } = result.changes;
  return { status, added: added.length, changed: changed.length, left: left.length };
}

/** What a run says when another of its job was going, so it didn't: it keeps no run, as it did nothing. */
export const ANOTHER_RUNNING = { stoppedBy: "running" } as const;

/**
 * Runs a job, unless a run of it is going, whoever started that, and says
 * what the run did, or ANOTHER_RUNNING. A failure is kept as a failed run,
 * then thrown on. `request` is the call's, for the links a run emails: the
 * cron route's own, or a Server Action's stand-in (actionRequest). It must
 * be given, even as undefined, so a caller can't forget it and leave a
 * local build unable to say its own address.
 */
export async function runJob(job: ImportJob, startedBy: string, request: Request | undefined): Promise<unknown> {
  if (!(await startRunning(job, startedBy))) return ANOTHER_RUNNING;
  try {
    return await RUNS[job](startedBy, request);
  } finally {
    await stopRunning(job);
  }
}
