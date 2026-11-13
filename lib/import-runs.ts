// The import log's types, shared by the server (lib/server/import-runs.ts)
// and the staff components that show a run (app/(staff)/staff/_components/Run.tsx).
import type { ControlAiMatchProblem } from "./controlai-letter";
import type { MpProblem } from "./mp-check";
import type { PoliticianChanges, PoliticianRecord, Renamed } from "./politician-sync";

/**
 * How often a job runs on its own: every 5 minutes, every 15, hourly or nightly, each
 * by a scheduled function in netlify/functions/<job>/ whose cron says the
 * same (netlify/scheduled.test.ts).
 */
export type JobSchedule = "frequent" | "quarter-hour" | "hourly" | "nightly";

/**
 * Every job, by its name in the import log (`import_runs.job`): its page,
 * /staff/scheduled-jobs/<slug>, how often it runs, and, for one with more to
 * do than a run can, how long a run works before it stops taking on more,
 * leaving the rest for the next. Every run is a request to the site, which
 * a Netlify function stops at 30 seconds, so a budget leaves room for the
 * run's last steps. What runs a job is lib/server/jobs.ts; its title, icon
 * and description are the staff interface's (jobTitles, ImportJob.tsx). The
 * overview lists them in this order.
 */
export const JOBS = {
  "import-luma": { slug: "luma", schedule: "frequent", budgetMs: 20_000 },
  "import-civicrm": { slug: "civicrm", schedule: "hourly" },
  "read-gmail": { slug: "gmail", schedule: "frequent" },
  "send-mailings": { slug: "sending", schedule: "quarter-hour", budgetMs: 8_000 },
  "sync-politicians": { slug: "politicians", schedule: "nightly" },
  "check-mps": { slug: "mp-check", schedule: "nightly" },
  "import-controlai": { slug: "controlai", schedule: "nightly" },
  "tidy-logs": { slug: "tidying", schedule: "nightly" },
} as const satisfies Record<string, { slug: string; schedule: JobSchedule; budgetMs?: number }>;

export type ImportJob = keyof typeof JOBS;
export const IMPORT_JOBS = Object.keys(JOBS) as ImportJob[];

export function isImportJob(value: string): value is ImportJob {
  return Object.hasOwn(JOBS, value);
}

/** How often a job runs on its own. */
export function jobSchedule(job: ImportJob): JobSchedule {
  return JOBS[job].schedule;
}

/** Where a job's page is. */
export function importPath(job: ImportJob): string {
  return `/staff/scheduled-jobs/${JOBS[job].slug}`;
}

/** The job a page's slug names, if any. */
export function jobBySlug(slug: string): ImportJob | undefined {
  return IMPORT_JOBS.find((job) => JOBS[job].slug === slug);
}

/** A job's newest run as a list for RunList: itself, or none if it has never run. */
export function asList<Run>(run: Run | undefined): Run[] {
  return run ? [run] : [];
}

/** Who starts the scheduled runs (netlify/functions/), whatever their schedule. Staff runs are started by the staff member's email. */
export const NIGHTLY = "nightly";

/** ok or failed; a sync-politicians run is instead unchanged, held, applied or discarded. */
export type ImportRunStatus = "ok" | "failed" | "unchanged" | "held" | "applied" | "discarded";

/** One thing that went wrong during a run without stopping it: what, in our words, and the error's own, if it came from one; `told` once an alert of its own has gone. */
export type Problem = { what: string; error?: string; told?: true };

/** One run of a job: how it ended, what went wrong along the way, and the job's own account of what it found, unless it failed. */
export type ImportRun<Job extends ImportJob, Result> = {
  id: number;
  at: Date;
  job: Job;
  problems: Problem[];
  /** NIGHTLY, a staff member's email, or null for a run kept before 16 Oct 2026, when this wasn't recorded. */
  startedBy: string | null;
  /** Who applied or discarded a held sync. */
  decidedBy: string | null;
} & (
  | { status: "failed"; error: string; result: Record<string, never> }
  | { status: Exclude<ImportRunStatus, "failed">; error: null; result: Result }
);

/**
 * What a sync-politicians run keeps: what changed, and the names among it.
 * A held one also keeps every record, to apply later. Runs from before the
 * sync read every body keep only the changes.
 */
export type PoliticianSyncResult = {
  changes: PoliticianChanges;
  renamed?: Renamed[];
  records?: PoliticianRecord[];
};
export type PoliticianSync = ImportRun<"sync-politicians", PoliticianSyncResult>;

/**
 * What relinking the one-off threads did (lib/server/one-off-relink.ts):
 * messages whose quotes it read, those left to read, people linked to threads
 * and unlinked from them, and the offices' addresses it found.
 */
export type Relinked = { read: number; unread: number; linked: number; unlinked: number; offices: number };

/** A check's result; one from before relinking ran with the check has no `relinked`. */
export type MpCheckResult = { problems: MpProblem[]; relinked?: Relinked };
export type MpCheck = ImportRun<"check-mps", MpCheckResult>;

export type ControlAiImportResult = {
  pdfUrl: string;
  /** Names in the letter. */
  signatories: number;
  /** Of those, in our table. */
  matched: number;
  /** Statuses set and removed this run. */
  added: number;
  removed: number;
  problems: ControlAiMatchProblem[];
};
export type ControlAiImport = ImportRun<"import-controlai", ControlAiImportResult>;

/** Where supporters are, looked up after a Luma import: the postcodes and towns looked up, and whether postcodes.io failed partway. */
export type PlacesLookup = { postcodes: number; towns: number; failed: boolean };

/** What a run of the Luma import did: counts of what it copied, and what stopped it, if anything did. */
export type LumaImportResult = {
  /** Events added, changed or removed. */
  events: number;
  /** Events whose guest list was read in full. */
  eventsSynced: number;
  /** Events still waiting for their guest list, for the next run. */
  eventsLeft: number;
  /** Guest rows added, changed or marked as removed. */
  guestsChanged: number;
  /** Hosts added to or taken off events (runs kept before hosts were copied don't say). */
  hostsChanged?: number;
  /** People added or changed. */
  people: number;
  /** Contacts whose joining date was set. */
  contacts: number;
  /** Supporters made for people seen for the first time, and source records linked to a supporter. */
  supportersAdded: number;
  linked: number;
  requests: number;
  /** Upcoming events given tags on Luma (runs kept before events were tagged don't say). */
  eventsTagged?: number;
  /** Pages of the calendar's contacts read. */
  contactPages?: number;
  /** The postcodes and towns looked up at the end of the run (runs kept before this was recorded don't say). */
  places?: PlacesLookup;
  /** Why the run stopped before it was done: its time was up, or Luma's rate limit was near; in a run kept from before one run went at a time, another had the lock. */
  stoppedBy?: "time" | "rate-limit" | "running";
  /** Whether it worked out every supporter's facts and the supporters list again: after a change, or at least hourly. */
  refreshed?: boolean;
};
export type LumaImport = ImportRun<"import-luma", LumaImportResult>;

/**
 * What a run of the CiviCRM import did: contacts returned, added and
 * changed, and marked gone, unless the pull was so short that it `held`
 * them; opt-outs it opened or closed, and addresses it blocked for a hold.
 */
export type CivicrmImportResult = {
  contacts: number;
  added: number;
  changed: number;
  gone: number;
  held?: true;
  optOuts: number;
  blocked: number;
  /** Addresses whose hold CiviCRM lifted, unblocked; only when there were any. */
  unblocked?: number;
  /** Supporters made for contacts whose address nobody had, and contacts linked to a supporter (runs kept before CiviCRM made supporters don't say). */
  supportersAdded?: number;
  linked?: number;
  /** Our opt-outs, and lifts of "No bulk emails", sent to CiviCRM first; only when there were any. */
  updates?: CivicrmUpdatesResult;
};
export type CivicrmImport = ImportRun<"import-civicrm", CivicrmImportResult>;

/** What sending our updates to CiviCRM came to: applied, refused, or left to try again. */
export type CivicrmUpdatesResult = { sent: number; refused: number; unanswered: number };

/** What reading one connected Gmail account found. */
export type GmailRead = {
  account: string;
  replies: number;
  autoReplies: number;
  bounces: number;
  /** One-off emails kept, as threads with politicians, in an account that keeps them. */
  oneOffs?: number;
  /** The mailbox's history had gone, so it was searched instead. */
  restarted?: boolean;
  /** Why it couldn't be read. Read again next time, from where it got to, unless it was disconnected. */
  error?: string;
  /** Google refused its access, so it was disconnected, and isn't read again until it's connected again. */
  disconnected?: boolean;
  /** The letters inbox's: messages relayed, spam that matched no letter, and letters matched only by being the latest. */
  relayed?: number;
  spam?: number;
  uncertain?: number;
  /** The letters inbox's messages it couldn't account for, which a person has to look at. */
  notUnderstood?: NotUnderstood[];
};

/**
 * Why a message in the letters inbox wasn't understood: to a proxy we
 * don't have, or none of ours; from neither of a letter's two parties;
 * failing authentication; over its letter's cap on relays; or a bounce of
 * nothing we sent.
 */
export type NotUnderstoodReason = "unknown_proxy" | "no_proxy" | "stranger" | "not_verified" | "over_cap" | "bounce";

/** A message the letters inbox couldn't account for: its Gmail ID, for a link, who it's from, its subject and why. */
export type NotUnderstood = { gmailMessageId: string; from: string; subject: string; reason: NotUnderstoodReason };

/**
 * What searching the mailboxes for addresses staff added to politicians' did
 * (lib/server/politician-aliases.ts): how many it searched for, the messages
 * it kept, how many are left for the next run, and whether it stopped as its
 * time ran out. A failure is a problem of the run (problems.ts).
 */
export type AddressSearch = {
  searched: number;
  kept: number;
  waiting: number;
  stopped?: { by: "time" };
};

/**
 * What a run of reading Gmail found, account by account, and what its search
 * for added addresses did, in a run that had any; or, in a run kept from
 * before one run went at a time, that another was reading, so it read nothing.
 */
export type GmailReadResult = { accounts: GmailRead[]; searched?: AddressSearch; stoppedBy?: "running" };
export type GmailReading = ImportRun<"read-gmail", GmailReadResult>;

/** What an hour's sending did: the mailings it started, their letters, and the letters inbox's queue. */
export type SendingResult = {
  /** The IDs of the mailings started this run. */
  started: number[];
  sent: number;
  skipped: number;
  failed: number;
  /** Letters of started mailings still to send. */
  left: number;
  /** The mailings waiting for their send time or a person. */
  waiting: string[];
  queue: { sent: number; left: number };
  /** Broadcasts to supporters started, their copies sent, skipped, failed and left, and broadcasts waiting for CiviCRM; runs kept before broadcasts were sent don't say. */
  broadcasts?: { started: number[]; sent: number; skipped: number; failed: number; waiting: number; left: number };
};
export type Sending = ImportRun<"send-mailings", SendingResult>;

/**
 * What a night's tidying deleted: runs from this log, audit log entries,
 * forgotten mailing drafts, and errors not seen for a month, which a run
 * kept from before they were tidied doesn't count.
 */
export type TidyingResult = { importRuns: number; auditEntries: number; drafts: number; errors?: number };
export type Tidying = ImportRun<"tidy-logs", TidyingResult>;

export type AnyImportRun =
  PoliticianSync | MpCheck | ControlAiImport | LumaImport | CivicrmImport | GmailReading | Sending | Tidying;

/** Whether a run left work for later: a Luma import cut short, by its time, its rate limit or another run. */
function moreToDo(run: Exclude<AnyImportRun, { status: "failed" }>): boolean {
  return run.job === "import-luma" && run.result.stoppedBy !== undefined;
}

/**
 * How a run ended, as its line in the import log says it: failed; else with
 * problems, if anything went wrong along the way; else incomplete, if it
 * left work for a later run; else its status.
 */
export function runStatus(run: AnyImportRun): string {
  if (run.status === "failed") return "failed";
  if (run.problems.length > 0) return "problems";
  if (moreToDo(run)) return "incomplete";
  return run.status;
}

/** How a run ended, as a colour: green when it went well, changing something or nothing; amber held, with problems or with more to do; red failed; none when it was discarded, or never ran. */
export function runTone(run: AnyImportRun | undefined): "green" | "amber" | "red" | undefined {
  if (!run) return undefined;
  const status = runStatus(run);
  if (status === "failed") return "red";
  if (status === "held" || status === "incomplete" || status === "problems") return "amber";
  return run.status === "discarded" ? undefined : "green";
}
