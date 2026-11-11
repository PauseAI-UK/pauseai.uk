// The import log's types, shared by the server (lib/server/import-runs.ts)
// and the staff components that show a run (app/(staff)/staff/_components/Run.tsx).
import type { ControlAiMatchProblem } from "./controlai-letter";
import type { MpProblem } from "./mp-check";
import type { PoliticianChanges, PoliticianRecord, Renamed } from "./politician-sync";

/**
 * How often a job runs on its own: every 5 minutes, hourly or nightly, each
 * by a scheduled function in netlify/functions/<job>/ whose cron says the
 * same (netlify/scheduled.test.ts); or a one-off, which only staff run.
 */
export type JobSchedule = "frequent" | "hourly" | "nightly" | "oneOff";

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
  "import-old-letters": { slug: "old-letters", schedule: "oneOff", budgetMs: 20_000 },
  "import-luma": { slug: "luma", schedule: "frequent", budgetMs: 20_000 },
  "import-members": { slug: "members", schedule: "hourly" },
  "import-civicrm": { slug: "civicrm", schedule: "hourly" },
  "read-gmail": { slug: "gmail", schedule: "frequent" },
  "send-mailings": { slug: "sending", schedule: "hourly", budgetMs: 8_000 },
  "sync-politicians": { slug: "politicians", schedule: "nightly" },
  "sync-emails": { slug: "emails", schedule: "oneOff" },
  "check-mps": { slug: "mp-check", schedule: "nightly" },
  "import-controlai": { slug: "controlai", schedule: "nightly" },
  "import-web-form-letters": { slug: "web-form-letters", schedule: "oneOff" },
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

/** The jobs that run on a schedule, each called by its scheduled function at /api/cron/<job>. */
export const SCHEDULED_JOBS = IMPORT_JOBS.filter((job) => jobSchedule(job) !== "oneOff");

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

export type MpCheckResult = { problems: MpProblem[] };
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

/** What a run of the members import did: counts of what it copied. */
export type MembersImportResult = {
  /** Members read from the membership dataset. */
  members: number;
  /** Members added, changed, or marked as removed. */
  added: number;
  changed: number;
  removed: number;
  /** Supporters made for people seen for the first time, and source records linked to a supporter. */
  supportersAdded: number;
  linked: number;
  /** New members' contacts found by looking them up in CiviCRM, if any were. */
  civicrm?: number;
};
export type MembersImport = ImportRun<"import-members", MembersImportResult>;

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
};
export type CivicrmImport = ImportRun<"import-civicrm", CivicrmImportResult>;

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

/** What a run of reading Gmail found, account by account; or, in a run kept from before one run went at a time, that another was reading, so it read nothing. */
export type GmailReadResult = { accounts: GmailRead[]; stoppedBy?: "running" };
export type GmailReading = ImportRun<"read-gmail", GmailReadResult>;

/** What a run of the Emails sync did: the emails read, those it added, and those it couldn't. */
export type EmailSyncResult = {
  read: number;
  added: number;
  /** Emails to a politician who isn't here yet, for a later run. */
  waiting: number;
  /** Emails linked to no politician, or several. */
  noPolitician: number;
  /** Emails with no known mailing's box ticked, or several: by record, with the boxes ticked. */
  unplaced: { airtableId: string; mailings: string[] }[];
};
export type EmailSync = ImportRun<"sync-emails", EmailSyncResult>;

/** What the one-off import of pauseai.info's web form letters did: the letters read, and what became of each. */
export type WebFormImportResult = {
  read: number;
  imported: number;
  /** Marked as spam, invalid, or never sent. */
  skipped: number;
  /** Already imported, or already here from the same sender to the same politician for the same ask. */
  alreadyHere: number;
  /** To a politician who isn't here, or to none or several. */
  noPolitician: number;
  supportersAdded: number;
  linked: number;
};
export type WebFormImport = ImportRun<"import-web-form-letters", WebFormImportResult>;

/** How far the import of old letters has got, over all its runs. */
export type OldLettersProgress = {
  read: number;
  left: number;
  joined: number;
  replies: number;
  autoReplies: number;
  oneOffs: number;
  /** Runs Gmail stopped, of those the log still has. */
  refusals: number;
  /** What's joined or added, by mailing or form letter's campaign, and what they're called. */
  byMailing: Record<string, number>;
  titles: Record<string, string>;
};

/** What a run of the import of old letters did: how far it got, and what it found. */
export type OldLettersImportResult = {
  /** It read everything listed, and did the last steps. */
  finished: boolean;
  /** Why it stopped short: Gmail refused a request. */
  stoppedBy?: "gmail";
  /** What Gmail said. */
  stoppedWhy?: string;
  /** How many of its searches it has listed: its place, between its calls. */
  searchesDone?: number;
  /** The first message of the last kept thread whose missing messages it has listed: its place, between its calls. */
  threadsDone?: number;
  /** Messages listed and read this run, and how many are left. */
  listed: number;
  read: number;
  left: number;
  requests: number;
  /** Form letters' and Postmark letters' texts copied. */
  formTexts: number;
  postmarkTexts: number;
  /** Letters joined to their sent emails, added from them, and not joined, by mailing, or for a form letter its campaign. */
  joined: Record<string, number>;
  added: Record<string, number>;
  notJoined: Record<string, number>;
  /** What those are called, by the key each is counted under. */
  titles?: Record<string, string>;
  replies: number;
  autoReplies: number;
  oneOffs: number;
  /** Gmail IDs of messages Gmail wouldn't give. */
  unreadable: string[];
  /** Mail in policy@ and the group's archive that matched nothing, which only staff with supporters see. */
  unmatched: { from: string; subject: string }[];
  /** Mailings given a template, and letters that keep their own text as they don't fit theirs. */
  templates: number;
  ownText: number;
  /** Letters with a person's reply newly marked. */
  repliedSet: number;
};
export type OldLettersImport = ImportRun<"import-old-letters", OldLettersImportResult>;

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
  | PoliticianSync
  | EmailSync
  | MpCheck
  | ControlAiImport
  | LumaImport
  | MembersImport
  | CivicrmImport
  | GmailReading
  | WebFormImport
  | OldLettersImport
  | Sending
  | Tidying;

/** Whether a run left work for later: a Luma import cut short, by its time, its rate limit or another run; the old letters import until it has read everything. */
function moreToDo(run: Exclude<AnyImportRun, { status: "failed" }>): boolean {
  if (run.job === "import-luma") return run.result.stoppedBy !== undefined;
  return run.job === "import-old-letters" && !run.result.finished;
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
