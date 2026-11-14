import {
  type AnyImportRun,
  type ControlAiImportResult,
  type ControlAiStatementResult,
  type GmailRead,
  type GmailReadResult,
  type ImportJob,
  type LumaImportResult,
  type CivicrmImportResult,
  NIGHTLY,
  type PoliticianImport,
  type PoliticianImportJob,
  type PoliticianImportResult,
  type Problem,
  type SendingResult,
  type TidyingResult,
} from "@/lib/import-runs";

type Results = Record<PoliticianImportJob, PoliticianImportResult> & {
  "import-controlai": ControlAiImportResult;
  "import-controlai-statement": ControlAiStatementResult;
  "import-luma": LumaImportResult;
  "import-civicrm": CivicrmImportResult;
  "read-gmail": GmailReadResult;
  "send-mailings": SendingResult;
  "tidy-logs": TidyingResult;
};
/** A job's runs: the run type whose jobs include it, as the bodies' imports share one. */
type RunOf<Job extends ImportJob> = AnyImportRun extends infer Run
  ? Run extends { job: infer Jobs }
    ? Job extends Jobs
      ? Run
      : never
    : never
  : never;

/** A run from the import log that went well, with `result`. */
export function exampleRun<Job extends ImportJob>(
  job: Job,
  result: Results[Job],
  run: Partial<RunOf<Job>> = {},
): RunOf<Job> {
  return {
    id: 1,
    at: new Date("2026-10-15T02:00:00Z"),
    job,
    startedBy: NIGHTLY,
    decidedBy: null,
    status: "ok",
    error: null,
    problems: [] as Problem[],
    result,
    ...run,
  } as RunOf<Job>;
}

/** A run from the import log that failed, with `error`. */
export const exampleFailedRun = <Job extends ImportJob>(
  job: Job,
  error: string,
  run: Partial<RunOf<Job>>,
): RunOf<Job> => ({ ...exampleRun(job, {} as Results[Job]), status: "failed", error, ...run }) as RunOf<Job>;

/** What a body's import did that changed nothing, and what relinking the one-off threads did after. */
export const exampleImportResult: PoliticianImportResult = {
  changes: { added: [], changed: [], left: [], renamed: [], unofficial: [], salutations: [] },
  vacant: [],
  relinked: { read: 0, unread: 0, linked: 0, unlinked: 0, offices: 0 },
};

/**
 * Parliament's import held for staff to apply or discard: a new MP and a
 * new peer, one who retired, one changed, one renamed, a seat no postcode
 * finds and a salutation unlike the rule's.
 */
export const exampleHeldImport: PoliticianImport = exampleRun(
  "import-parliament",
  {
    changes: {
      added: [
        {
          officialId: 5001,
          house: "commons",
          name: "Sam Newcomer",
          constituency: "Ipswich",
          party: "Labour",
          country: "england",
          emails: ["sam.newcomer.mp@parliament.uk"],
          websites: [],
          salutation: "Mr Newcomer",
        },
        {
          officialId: 5002,
          house: "lords",
          name: "Lord Example",
          constituency: null,
          party: "Crossbench",
          country: null,
          emails: [],
          websites: [],
          salutation: "Lord Example",
        },
      ],
      changed: [{ id: 7, name: "Polly Placeholder", changed: { party: ["Labour", "Labour (Co-op)"] } }],
      left: [
        {
          id: 8,
          name: "Rita Retired",
          house: "commons",
          constituency: "Old Seat",
          status: "retired",
          date: "2026-10-01",
          reason: "Retirement",
        },
      ],
      renamed: [{ id: 9, from: "Dora Dummy", to: "Dora Smith" }],
      unofficial: [{ name: "Mo Example", constituency: "Manchester Centre" }],
      salutations: [{ id: 7, name: "Polly Placeholder", ours: "Polly", rule: "Ms Placeholder" }],
    },
    members: [],
    endings: [],
  },
  { id: 4, at: new Date("2026-10-13T06:21:00Z"), status: "held" },
);

/** What a run of the Luma import did: every event read, nothing left over. */
export const exampleLumaResult: LumaImportResult = {
  events: 2,
  eventsSynced: 9,
  eventsLeft: 0,
  guestsChanged: 14,
  people: 3,
  contacts: 1,
  supportersAdded: 2,
  linked: 3,
  requests: 21,
};

/** What a pull from CiviCRM did: a few new contacts, a couple gone from the chapter, an unsubscribe and a hold. */
export const exampleCivicrmResult: CivicrmImportResult = {
  contacts: 1536,
  added: 4,
  changed: 3,
  gone: 2,
  optOuts: 1,
  blocked: 1,
};

/** What a read of Gmail found: one account read, and one that couldn't be this time. */
export const exampleGmailResult: GmailReadResult = {
  accounts: [
    { account: "mailings@pauseai.uk", replies: 2, autoReplies: 5, bounces: 1 },
    {
      account: "jo@pauseai.uk",
      replies: 0,
      autoReplies: 0,
      bounces: 0,
      error: "Error: Gmail answered 500 for /history",
    },
  ],
};

/** An account in a read of Gmail that Google refused, so it was disconnected. */
export const exampleDisconnectedGmail: GmailRead = {
  account: "al@pauseai.uk",
  replies: 0,
  autoReplies: 0,
  bounces: 0,
  error: "Error: Google refused the token request: 400 invalid_grant",
  disconnected: true,
};

/** The letters inbox in a read of Gmail: replies relayed, spam counted, and two messages it couldn't account for. */
export const exampleLettersInboxRead: GmailRead = {
  account: "fixture-letters@pauseai.uk",
  replies: 3,
  autoReplies: 1,
  bounces: 0,
  relayed: 4,
  spam: 2,
  uncertain: 1,
  notUnderstood: [
    { gmailMessageId: "18c0ffee00000001", from: "someone@example.com", subject: "Hello", reason: "stranger" },
    { gmailMessageId: "18c0ffee00000002", from: "office@parliament.uk", subject: "Re: Pause", reason: "not_verified" },
  ],
};

/** What a read of ControlAI's letter found, with every name placed. */
export const exampleControlAiResult: ControlAiImportResult = {
  pdfUrl: "https://images.controlai.com/letter.pdf",
  signatories: 86,
  matched: 74,
  added: 2,
  removed: 1,
  problems: [],
};

/** What a read of ControlAI's statement found, with every supporter placed. */
export const exampleControlAiStatementResult: ControlAiStatementResult = {
  supporters: 190,
  matched: 190,
  added: 3,
  removed: 0,
  unmatched: [],
};

/** What an hour's sending did: a mailing started and most of it sent. */
export const exampleSendingResult: SendingResult = {
  started: [12],
  sent: 40,
  skipped: 1,
  failed: 0,
  left: 110,
  waiting: [],
  queue: { sent: 2, left: 0 },
};

/** What a night's tidying deleted. */
export const exampleTidyingResult: TidyingResult = { importRuns: 288, auditEntries: 12, drafts: 1, errors: 3 };
