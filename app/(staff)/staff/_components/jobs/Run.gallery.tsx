// Run in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example, Variant } from "@/app/(tools)/gallery/_components/types";
import Run from "./Run";
import {
  exampleControlAiResult,
  exampleControlAiStatementResult,
  exampleHeldImport,
  exampleImportResult,
  exampleFailedRun,
  exampleLumaResult,
  exampleDisconnectedGmail,
  exampleGmailResult,
  exampleLettersInboxRead,
  exampleCivicrmResult,
  exampleRun,
  exampleSendingResult,
  exampleTidyingResult,
} from "./RunList.examples";
import StaffPage from "../ui/StaffPage";
import { type ImportJob, type PoliticianImportJob } from "@/lib/import-runs";
import { jobsCopy } from "./copy";
import { HeldImportExample } from "./Run.gallery.client";

/** A body's import, as its page shows it: what it changed, and what relinking the one-off threads did. */
const importRun = (job: PoliticianImportJob, label: string): Variant => ({
  label,
  render: () => (
    <StaffPage as="div">
      <Run
        run={exampleRun(job, {
          ...exampleImportResult,
          changes: { ...exampleHeldImport.result.changes, renamed: [], unofficial: [] },
          relinked: { read: 0, unread: 0, linked: 2, unlinked: 0, offices: 1 },
        })}
      />
    </StaffPage>
  ),
});

// A run of each job, as its job's page shows it. A held import, with its buttons, is in the client file.
const RUNS: Record<ImportJob, Variant> = {
  "import-parliament": {
    label: "Parliament's import, held for a decision",
    render: () => (
      <StaffPage as="div">
        <HeldImportExample />
      </StaffPage>
    ),
  },
  "import-scottish-parliament": importRun("import-scottish-parliament", "The Scottish Parliament's import"),
  "import-senedd": importRun("import-senedd", "The Senedd's import"),
  "import-ni-assembly": importRun("import-ni-assembly", "The NI Assembly's import"),
  "import-controlai-statement": {
    label: "A read of ControlAI's statement",
    render: () => (
      <StaffPage as="div">
        <Run run={exampleRun("import-controlai-statement", exampleControlAiStatementResult)} />
      </StaffPage>
    ),
  },
  "import-controlai": {
    label: "A read of ControlAI's letter, with names it couldn't place",
    render: () => (
      <StaffPage as="div">
        <Run
          run={exampleRun("import-controlai", {
            ...exampleControlAiResult,
            problems: [
              { name: "Baroness Nobody", kind: "nobody", candidates: [] },
              { name: "Lord Sample", kind: "several", candidates: ["Lord Sample", "Lord Sample of Elsewhere"] },
            ],
          })}
        />
      </StaffPage>
    ),
  },
  "import-luma": {
    label: "A Luma import cut short by its time, and one that changed hosts and looked up places",
    render: () => (
      <StaffPage as="div">
        <Run run={exampleRun("import-luma", { ...exampleLumaResult, eventsLeft: 4, stoppedBy: "time" })} />
        <Run
          run={exampleRun(
            "import-luma",
            {
              ...exampleLumaResult,
              hostsChanged: 1,
              contactPages: 10,
              places: { postcodes: 12, towns: 3, failed: false },
            },
            { id: 2 },
          )}
        />
      </StaffPage>
    ),
  },
  "import-civicrm": {
    label: "A pull from CiviCRM, and one too short to mark anyone gone",
    render: () => (
      <StaffPage as="div">
        <Run run={exampleRun("import-civicrm", exampleCivicrmResult)} />
        <Run
          run={exampleRun(
            "import-civicrm",
            { ...exampleCivicrmResult, contacts: 120, gone: 0, held: true },
            {
              id: 3,
              problems: [{ what: jobsCopy.problems.civicrmTooFew, error: "120 returned, 1536 before" }],
            },
          )}
        />
      </StaffPage>
    ),
  },
  "read-gmail": {
    label:
      "A read of Gmail, one account unread; one that disconnected an account; one with mail in the letters inbox not understood",
    render: () => (
      <StaffPage as="div">
        <Run
          run={exampleRun("read-gmail", exampleGmailResult, {
            problems: [
              {
                what: jobsCopy.problems.couldntRead("jo@pauseai.uk"),
                error: "Gmail answered 500 for /history",
              },
            ],
          })}
          open
        />
        <Run
          run={exampleRun(
            "read-gmail",
            { accounts: [exampleLettersInboxRead] },
            { id: 4, problems: [{ what: jobsCopy.problems.notUnderstood, error: "2", told: true }] },
          )}
          open
        />
        <Run
          run={exampleRun(
            "read-gmail",
            { accounts: [exampleGmailResult.accounts[0], exampleDisconnectedGmail] },
            {
              id: 3,
              problems: [
                {
                  what: jobsCopy.problems.couldntRead("al@pauseai.uk"),
                  error: "Google refused the token request: 400 invalid_grant",
                  told: true,
                },
              ],
            },
          )}
          open
        />
        <Run
          run={exampleRun(
            "read-gmail",
            { accounts: [{ ...exampleGmailResult.accounts[0], restarted: true }] },
            { id: 2, startedBy: "jo@pauseai.uk" },
          )}
        />
      </StaffPage>
    ),
  },
  "send-mailings": {
    label: "An hour's sending",
    render: () => (
      <StaffPage as="div">
        <Run run={exampleRun("send-mailings", exampleSendingResult)} open />
      </StaffPage>
    ),
  },
  "tidy-logs": {
    label: "A night's tidying",
    render: () => (
      <StaffPage as="div">
        <Run run={exampleRun("tidy-logs", exampleTidyingResult)} open />
      </StaffPage>
    ),
  },
};

export const runGallery: Example[] = [
  {
    name: "Run",
    file: "app/(staff)/staff/_components/jobs/Run.tsx",
    variants: [
      ...Object.values(RUNS),
      {
        label: "A run that failed",
        render: () => (
          <StaffPage as="div">
            <Run run={exampleFailedRun("tidy-logs", "An example error", { id: 4 })} />
          </StaffPage>
        ),
      },
    ],
  },
];
