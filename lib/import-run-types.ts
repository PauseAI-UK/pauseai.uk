// The import log's types (./import-runs.ts): each run, and each job's
// account of what it found. A file of their own, imported only as types, so
// adding to a job's result reaches no flow by itself.
import type { ControlAiMatchProblem } from "./controlai-letter";
import type { ImportJob, PoliticianImportJob } from "./import-runs";
import type { Ending, ImportChanges, OfficialMember } from "@/lib/politicians/import-changes";
import type { Problem } from "./problems";

/** ok or failed; a body's import is instead unchanged, held, applied or discarded. */
export type ImportRunStatus = "ok" | "failed" | "unchanged" | "held" | "applied" | "discarded";

/** One run of a job: how it ended, what went wrong along the way, and the job's own account of what it found, unless it failed. */
export type ImportRun<Job extends ImportJob, Result> = {
  id: number;
  at: Date;
  job: Job;
  problems: Problem[];
  /** NIGHTLY, a staff member's email, or null for a run kept before 16 Oct 2026, when this wasn't recorded. */
  startedBy: string | null;
  /** Who applied or discarded a held import. */
  decidedBy: string | null;
} & (
  | { status: "failed"; error: string; result: Record<string, never> }
  | { status: Exclude<ImportRunStatus, "failed">; error: null; result: Result }
);

/**
 * What relinking the one-off threads did (lib/letters/one-off-relink.server.ts):
 * messages whose quotes it read, those left to read, people linked to threads
 * and unlinked from them, and the offices' addresses it found.
 */
export type Relinked = { read: number; unread: number; linked: number; unlinked: number; offices: number };

/**
 * What an import of a body's members keeps: what it changed, or would; a
 * held one, the list it read and why its leavers left, to apply later.
 * Parliament's says which constituencies have no MP; an applied one, what
 * relinking the one-off threads did.
 */
export type PoliticianImportResult = {
  changes: ImportChanges;
  members?: OfficialMember[];
  endings?: [number, Ending][];
  vacant?: string[];
  relinked?: Relinked;
};
export type PoliticianImport = ImportRun<PoliticianImportJob, PoliticianImportResult>;

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

/**
 * What an import of ControlAI's statement did: the politicians its page
 * links to, those matched, the statuses set and removed, and each link it
 * couldn't match, which, with every sitting politician on our list, is a
 * fault.
 */
export type ControlAiStatementResult = {
  supporters: number;
  matched: number;
  added: number;
  removed: number;
  unmatched: string[];
};
export type ControlAiStatementImport = ImportRun<"import-controlai-statement", ControlAiStatementResult>;

/**
 * What an import of the EDM's signers did: how many signed, those matched,
 * the statuses set and removed, and each signer it couldn't match, by name
 * and Parliament's ID, which, with every MP on our list, is a fault.
 */
export type EdmResult = {
  signers: number;
  matched: number;
  added: number;
  removed: number;
  unmatched: string[];
};
export type EdmImport = ImportRun<"import-edm", EdmResult>;

/**
 * What a call of the press survey did (lib/press/survey.server.ts): the
 * week-long windows of Google News it searched and the pieces new to it,
 * then the finds it read, how many it found known, couldn't read, left
 * waiting for staff or set aside, how many are left to read, and how many
 * finds it told the notification inbox of.
 */
export type PressSurveyResult = {
  searched: number;
  found: number;
  read: number;
  known: number;
  unreadable: number;
  waiting: number;
  notOurs: number;
  left: number;
  told: number;
};
export type PressSurvey = ImportRun<"import-press", PressSurveyResult>;

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
  /** Answers to replies to broadcasts that staff wrote in its Gmail rather than on the site, kept. */
  answers?: number;
  /** It looked again at its replies to broadcasts of the last two weeks for answers written in Gmail, as it does about weekly. */
  caughtUp?: boolean;
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
 * (lib/politicians/aliases.server.ts): how many it searched for, the messages
 * it kept, how many are left for the next run, and whether it stopped as its
 * time ran out. A failure is a problem of the run (problems.server.ts).
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
  | PoliticianImport
  | ControlAiImport
  | ControlAiStatementImport
  | EdmImport
  | PressSurvey
  | LumaImport
  | CivicrmImport
  | GmailReading
  | Sending
  | Tidying;
