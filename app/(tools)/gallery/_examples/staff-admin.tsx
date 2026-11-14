import SentEmails from "@/app/(staff)/staff/_components/SentEmails";
import ErrorsSeen from "@/app/(staff)/staff/_components/ErrorsSeen";
import { exampleErrorDone, exampleErrorsSeen } from "@/app/(staff)/staff/_components/ErrorsSeen.examples";
// The staff interface's dashboard, imports, audit log, accounts, login and
// Gmail, on fake runs and changes.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
import { Button } from "@/components/ui/Button";
import ChangesTable from "@/app/(staff)/staff/_components/ChangesTable";
import { exampleChanges } from "@/app/(staff)/staff/_components/ChangesTable.examples";
import AuditDetail, { FieldChanges } from "@/app/(staff)/staff/_components/AuditDetail";
import { DotParts, LoggedJson } from "@/app/(staff)/staff/_components/Logged";
import ResultBox, { OPEN_UP_TO } from "@/app/(staff)/staff/_components/ResultBox";
import Run from "@/app/(staff)/staff/_components/Run";
import RunBox from "@/app/(staff)/staff/_components/RunBox";
import { ImportOverview } from "@/app/(staff)/staff/_components/ImportJob";
import RunList from "@/app/(staff)/staff/_components/RunList";
import RunTable from "@/app/(staff)/staff/_components/RunTable";
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
} from "@/app/(staff)/staff/_components/RunList.examples";
import ImportCard, { ImportCards } from "@/app/(staff)/staff/_components/ImportCard";
import ImportIcon from "@/app/(staff)/staff/_components/ImportIcon";
import { keepSignedInGallery } from "@/app/(staff)/staff/_components/accounts/KeepSignedIn.gallery";
import { myGmailGallery } from "@/app/(staff)/staff/_components/accounts/MyGmail.gallery";
import { gmailConnectGallery } from "@/app/(staff)/staff/_components/accounts/GmailConnect.gallery";
import { staffSessionsGallery } from "@/app/(staff)/staff/_components/accounts/StaffSessions.gallery";
import { staffAccountsTableGallery } from "@/app/(staff)/staff/_components/accounts/StaffAccountsTable.gallery";
import { accountsNoticeGallery } from "@/app/(staff)/staff/_components/accounts/AccountsNotice.gallery";
import { loginCardGallery } from "@/app/(staff)/staff/_components/accounts/LoginCard.gallery";
import { devLoginGallery } from "@/app/(staff)/staff/_components/accounts/DevLogin.gallery";
import { loginFormGallery } from "@/app/(staff)/staff/_components/accounts/LoginForm.gallery";
import StaffDashboard from "@/app/(staff)/staff/_components/StaffDashboard";
import StaffHome from "@/app/(staff)/staff/_components/StaffHome";
import { exampleDashboard, exampleQuietDashboard } from "@/app/(staff)/staff/_components/StaffDashboard.examples";
import Sparkline from "@/app/(staff)/staff/_components/Sparkline";
import StackedBars from "@/app/(staff)/staff/_components/StackedBars";
import PermissionTiles, { ContactLink } from "@/app/(staff)/staff/_components/PermissionTiles";
import {
  exampleBlockedPermissions,
  exampleMemberDetails,
  exampleSupporterDetails,
} from "@/app/(staff)/staff/_components/supporters/SupportersTable.examples";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";
import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import { changesSearch } from "@/lib/staff-search";
import { type ImportJob, NIGHTLY, type PoliticianImportJob } from "@/lib/import-runs";
import type { Group, Variant } from "../_components/types";
import {
  HeldImportExample,
  ImportJobPageExample,
  JobActionsExample,
  ErrorSeenViewExample,
  ChangesFiltersExample,
} from "./staff.client";
import { politiciansCopy } from "@/app/(staff)/staff/_components/politicians/copy";
import { exampleSentEmails } from "@/app/(staff)/staff/_components/SentEmails.examples";

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
              problems: [{ what: staffCopy.problems.job.civicrmTooFew, error: "120 returned, 1536 before" }],
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
                what: staffCopy.problems.job.couldntRead("jo@pauseai.uk"),
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
            { id: 4, problems: [{ what: staffCopy.problems.job.notUnderstood, error: "2", told: true }] },
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
                  what: staffCopy.problems.job.couldntRead("al@pauseai.uk"),
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

export const staffAdmin: Group = {
  id: "staff-admin",
  title: "The staff interface: admin and accounts",
  examples: [
    {
      name: "SentEmails",
      file: "app/(staff)/staff/_components/SentEmails.tsx",
      variants: [
        {
          label: "A letter, one bounced, an imported mailing and a sign-in",
          render: () => (
            <StaffPage as="div">
              <SentEmails
                emails={exampleSentEmails}
                total={4}
                pages={1}
                page={1}
                pageSize={100}
                search={{ q: "", purpose: [], outcome: [], backend: [], link: [], sort: "", dir: "", page: "" }}
              />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ErrorsSeen",
      file: "app/(staff)/staff/_components/ErrorsSeen.tsx",
      variants: [
        {
          label: "To do: a page's error, a problem, and two from browsers",
          render: () => (
            <StaffPage as="div">
              <ErrorsSeen done={false} errors={exampleErrorsSeen} total={4} pages={1} page={1} pageSize={100} />
            </StaffPage>
          ),
        },
        {
          label: "Nothing has gone wrong",
          render: () => (
            <StaffPage as="div">
              <ErrorsSeen done={false} errors={[]} total={0} pages={1} page={1} pageSize={100} />
            </StaffPage>
          ),
        },
        {
          label: "Done: who marked each, and when",
          render: () => (
            <StaffPage as="div">
              <ErrorsSeen done errors={[exampleErrorDone]} total={1} pages={1} page={1} pageSize={100} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ErrorSeenView",
      file: "app/(staff)/staff/_components/ErrorSeenView.tsx",
      variants: [
        {
          label: "A Postgres error in a page, with its stack trace",
          render: () => (
            <StaffPage as="div">
              <ErrorSeenViewExample which={0} />
            </StaffPage>
          ),
        },
        {
          label: "A problem, which has no stack trace",
          render: () => (
            <StaffPage as="div">
              <ErrorSeenViewExample which={1} />
            </StaffPage>
          ),
        },
        {
          label: "A page that fell over in a browser",
          render: () => (
            <StaffPage as="div">
              <ErrorSeenViewExample which={2} />
            </StaffPage>
          ),
        },
        {
          label: "Marked done",
          render: () => (
            <StaffPage as="div">
              <ErrorSeenViewExample which="done" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "PermissionTiles",
      file: "app/(staff)/staff/_components/PermissionTiles.tsx",
      variants: [
        {
          label: "Will and won't email, by topic, and a phone number we may not use",
          render: () => (
            <StaffPage as="div">
              <PermissionTiles permissions={exampleSupporterDetails.permissions} />
            </StaffPage>
          ),
        },
        {
          label: "A member from CiviCRM, with No bulk emails set there, who follows the Luma calendar",
          render: () => (
            <StaffPage as="div">
              <PermissionTiles
                permissions={exampleMemberDetails.permissions.map((p) =>
                  p.topic === "events"
                    ? { ...p, send: "yes", reason: "following", at: new Date("2026-10-23T09:00:00Z") }
                    : p,
                )}
              />
            </StaffPage>
          ),
        },
        {
          label: "A volunteer's phone number",
          render: () => (
            <StaffPage as="div">
              <PermissionTiles permissions={exampleMemberDetails.permissions.slice(3)} />
            </StaffPage>
          ),
        },
        {
          label: "A blocked address",
          render: () => (
            <StaffPage as="div">
              <PermissionTiles permissions={exampleBlockedPermissions} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ContactLink",
      file: "app/(staff)/staff/_components/PermissionTiles.tsx",
      variants: [
        {
          label: "An address to email, a number to text on WhatsApp, and one to call",
          render: () => (
            <StaffPage as="div">
              <p>
                <ContactLink address="jane.smith@example.com" way="email" />
              </p>
              <p>
                <ContactLink address="+447700900123" way="text" />
              </p>
              <p>
                <ContactLink address="+447700900123" way="call" />
              </p>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "StaffDashboard",
      file: "app/(staff)/staff/_components/StaffDashboard.tsx",
      variants: [
        {
          label: "A busy week with something waiting of each kind, for someone who may see supporters",
          render: () => (
            <StaffPage as="div">
              <StaffDashboard dashboard={exampleDashboard} permissions={["supporters"]} />
            </StaffPage>
          ),
        },
        {
          label: "For someone who may not: the supporter tiles aren't links",
          render: () => (
            <StaffPage as="div">
              <StaffDashboard dashboard={exampleDashboard} permissions={[]} />
            </StaffPage>
          ),
        },
        {
          label: "A quiet month: nothing waiting, nothing counted",
          render: () => (
            <StaffPage as="div">
              <StaffDashboard dashboard={exampleQuietDashboard} permissions={["supporters"]} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "StackedBars",
      file: "app/(staff)/staff/_components/StackedBars.tsx",
      variants: [
        {
          label: "Eight weeks of new supporters by their earliest source: point at a bar for what it holds",
          render: () => (
            <StaffPage as="div">
              <div style={{ maxWidth: "24rem" }}>
                <StackedBars
                  name="New supporters, the last eight weeks"
                  parts={[
                    { key: "luma", label: "Luma" },
                    { key: "civicrm", label: "Member" },
                    { key: "email-your-mp", label: "Letter" },
                  ]}
                  bars={exampleDashboard.supportersBySource.map((point) => ({
                    counts: point.sources,
                    title: `From ${point.from.toISOString().slice(0, 10)}: ${point.count}`,
                  }))}
                  from={exampleDashboard.supportersBySource[0].from.toISOString().slice(0, 10)}
                  to={exampleDashboard.asOf.toISOString().slice(0, 10)}
                />
              </div>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "Sparkline",
      file: "app/(staff)/staff/_components/Sparkline.tsx",
      variants: [
        {
          label: "Eight weeks of registrations: point at it for a week's count",
          render: () => (
            <StaffPage as="div">
              <div style={{ maxWidth: "24rem" }}>
                <Sparkline
                  name="Event registrations, the last eight weeks"
                  values={exampleDashboard.series.eventRegistrations.map((point) => point.count)}
                  labels={exampleDashboard.series.eventRegistrations.map(
                    (point) => `From ${point.from.toISOString().slice(0, 10)}: ${point.count}`,
                  )}
                  from={exampleDashboard.series.eventRegistrations[0].from.toISOString().slice(0, 10)}
                  to={exampleDashboard.asOf.toISOString().slice(0, 10)}
                />
              </div>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "StaffHome",
      file: "app/(staff)/staff/_components/StaffHome.tsx",
      variants: [
        {
          label: "For an admin: the dashboard",
          render: () => (
            <StaffPage as="div">
              <StaffHome permissions={["admin", "supporters"]} dashboard={exampleDashboard} />
            </StaffPage>
          ),
        },
        {
          label: "For someone with no permissions: the dashboard, its supporter tiles not links",
          render: () => (
            <StaffPage as="div">
              <StaffHome permissions={[]} dashboard={exampleDashboard} />
            </StaffPage>
          ),
        },
      ],
    },
    ...myGmailGallery,
    ...gmailConnectGallery,
    ...staffSessionsGallery,
    ...staffAccountsTableGallery,
    ...accountsNoticeGallery,
    ...keepSignedInGallery,
    {
      name: "ImportIcon",
      file: "app/(staff)/staff/_components/ImportIcon.tsx",
      variants: [
        {
          label: "Each source",
          render: () => (
            <StaffPage as="div">
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                {(["luma", "civicrm", "gmail", "parliament", "controlai", "database"] as const).map((source) => (
                  <ImportIcon key={source} source={source} />
                ))}
              </div>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ImportCards",
      file: "app/(staff)/staff/_components/ImportCard.tsx",
      variants: [
        {
          label: "Two cards in the grid",
          render: () => (
            <StaffPage as="div">
              <ImportCards>
                <ImportCard
                  title="An import"
                  href="/staff/scheduled-jobs/signatories"
                  icon={<ImportIcon source="parliament" />}
                  tags={<Tag>Check only</Tag>}
                  intro="What it copies, and from where."
                >
                  <p>
                    <Tag tone="green">Done</Tag> 2026-10-15 02:00
                  </p>
                </ImportCard>
                <ImportCard
                  title="Another"
                  href="/staff/scheduled-jobs/luma"
                  icon={<ImportIcon source="luma" />}
                  intro="Never run."
                >
                  <p>Not imported yet.</p>
                </ImportCard>
              </ImportCards>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ImportCard",
      file: "app/(staff)/staff/_components/ImportCard.tsx",
      variants: [
        {
          label: "One card on its own",
          render: () => (
            <StaffPage as="div">
              <ImportCard
                title="An import"
                href="/staff/scheduled-jobs/luma"
                icon={<ImportIcon source="luma" />}
                intro="What it copies."
              >
                <p>Not imported yet.</p>
              </ImportCard>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ImportOverview",
      file: "app/(staff)/staff/_components/ImportJob.tsx",
      variants: [
        {
          label: "Every job: one stopped short, one running, one held, one failed, one never run",
          render: () => (
            <StaffPage as="div">
              <ImportOverview
                running={[undefined, { startedBy: "jo@pauseai.uk", startedAt: new Date("2026-10-21T11:47:00Z") }]}
                newest={[
                  exampleRun(
                    "import-luma",
                    { ...exampleLumaResult, stoppedBy: "time" },
                    { at: new Date("2026-10-21T11:17:00Z") },
                  ),
                  exampleRun("import-civicrm", exampleCivicrmResult, { at: new Date("2026-10-21T10:49:00Z") }),
                  exampleRun("read-gmail", exampleGmailResult, { at: new Date("2026-10-21T11:20:00Z") }),
                  undefined,
                  { ...exampleHeldImport, at: new Date("2026-10-21T06:21:00Z") },
                  exampleRun("import-scottish-parliament", exampleImportResult, {
                    at: new Date("2026-10-21T06:22:00Z"),
                  }),
                  undefined,
                  undefined,
                  exampleFailedRun("import-controlai", "No PDF linked", { at: new Date("2026-10-21T02:00:00Z") }),
                  exampleRun("import-controlai-statement", exampleControlAiStatementResult, {
                    at: new Date("2026-10-21T06:26:00Z"),
                  }),
                  undefined,
                ]}
              />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ImportJobPage",
      file: "app/(staff)/staff/_components/ImportJob.tsx",
      variants: [
        {
          label: "The MP check's page: its button and every run, by day",
          render: () => (
            <StaffPage as="div">
              <ImportJobPageExample />
            </StaffPage>
          ),
        },
        {
          label: "A job that has never run",
          render: () => (
            <StaffPage as="div">
              <ImportJobPageExample never />
            </StaffPage>
          ),
        },
        {
          label: "A press still running: the earlier runs plain",
          render: () => (
            <StaffPage as="div">
              <ImportJobPageExample running="jo@pauseai.uk" />
            </StaffPage>
          ),
        },
        {
          label: "A run of its schedule going",
          render: () => (
            <StaffPage as="div">
              <ImportJobPageExample running={NIGHTLY} />
            </StaffPage>
          ),
        },
      ],
    },
    ...loginCardGallery,
    ...devLoginGallery,
    ...loginFormGallery,
    {
      name: "JobActions",
      file: "app/(staff)/staff/_components/JobActions.tsx",
      variants: [
        {
          label: "A job's button",
          render: () => (
            <StaffPage as="div">
              <JobActionsExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "AuditDetail",
      file: "app/(staff)/staff/_components/AuditDetail.tsx",
      variants: [
        {
          label: "An MP's status set, in words, linked to their page and the campaign's",
          render: () => (
            <StaffPage as="div">
              <AuditDetail change={exampleChanges[0]} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "FieldChanges",
      file: "app/(staff)/staff/_components/AuditDetail.tsx",
      variants: [
        {
          label: "What an edit changed, each field before and after",
          render: () => (
            <StaffPage as="div">
              <FieldChanges changed={{ party: ["Labour", "Independent"], email: [null, "polly@example.org"] }} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "DotParts",
      file: "app/(staff)/staff/_components/Logged.tsx",
      variants: [
        {
          label: "Parts of a line, between middle dots",
          render: () => (
            <StaffPage as="div">
              <DotParts>{["Bounced", "Type HardBounce", "Address jo.mp@parliament.uk"]}</DotParts>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "LoggedJson",
      file: "app/(staff)/staff/_components/Logged.tsx",
      variants: [
        {
          label: "The {} button, which opens what was logged as JSON",
          render: () => (
            <StaffPage as="div">
              <LoggedJson id="gallery-logged-json" details={{ type: "HardBounce", description: "No such address" }} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ChangesFilters",
      file: "app/(staff)/staff/_components/ChangesFilters.tsx",
      variants: [
        {
          label: "Several of who chosen, one of what left out, and how recent",
          render: () => <ChangesFiltersExample />,
        },
      ],
    },
    {
      name: "ChangesTable",
      file: "app/(staff)/staff/_components/ChangesTable.tsx",
      variants: [
        {
          label: "One of each kind of entry, in words, and one of a kind it doesn't know",
          render: () => (
            <StaffPage as="div">
              <ChangesTable
                search={changesSearch({})}
                log={{ changes: exampleChanges, total: exampleChanges.length, pages: 1, pageSize: 100 }}
                page={1}
              />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ResultBox",
      file: "app/(staff)/staff/_components/ResultBox.tsx",
      variants: [
        {
          label: "One line",
          render: () => (
            <StaffPage as="div">
              <ResultBox summary="An example result, in one line" />
            </StaffPage>
          ),
        },
        {
          label: "A few lines open under it, with buttons",
          render: () => (
            <StaffPage as="div">
              <ResultBox
                summary="An example result with detail"
                lines={2}
                actions={
                  <>
                    <Button variant="primary" size="small" fit>
                      {politiciansCopy.politicianImports.apply}
                    </Button>
                    <Button variant="ghost" size="small" fit>
                      {politiciansCopy.politicianImports.discard}
                    </Button>
                  </>
                }
              >
                <ul>
                  <li>A line of detail</li>
                  <li>Another line</li>
                </ul>
              </ResultBox>
            </StaffPage>
          ),
        },
        {
          label: "Many lines, folded",
          render: () => (
            <StaffPage as="div">
              <ResultBox summary="An example result with a lot of detail" lines={OPEN_UP_TO + 1}>
                <p>Folded detail</p>
              </ResultBox>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "Run",
      file: "app/(staff)/staff/_components/Run.tsx",
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
    {
      name: "RunBox",
      file: "app/(staff)/staff/_components/RunBox.tsx",
      variants: [
        {
          label: "A run, with detail",
          render: () => (
            <StaffPage as="div">
              <RunBox
                run={exampleRun("import-parliament", exampleImportResult, { status: "applied" })}
                summary="an example summary"
                lines={1}
              >
                <p>Detail</p>
              </RunBox>
            </StaffPage>
          ),
        },
        {
          label: "A run that stopped before it finished, and one that failed",
          render: () => (
            <StaffPage as="div">
              <RunBox
                run={exampleRun("import-luma", { ...exampleLumaResult, stoppedBy: "time" })}
                summary="an example summary"
              />
              <RunBox run={exampleFailedRun("import-parliament", "An example error", { id: 5 })} summary={null} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "RunTable",
      file: "app/(staff)/staff/_components/RunTable.tsx",
      variants: [
        {
          label: "Luma: a run that stopped short, then a stretch that found nothing",
          render: () => (
            <StaffPage as="div">
              <RunTable
                header
                entries={[
                  { shape: "rows", runs: [exampleRun("import-luma", exampleLumaResult, { id: 22 })] },
                  {
                    shape: "run",
                    tone: "amber",
                    runs: [exampleRun("import-luma", { ...exampleLumaResult, stoppedBy: "time" }, { id: 23 })],
                  },
                  {
                    shape: "quiet",
                    runs: [
                      exampleRun("import-luma", exampleLumaResult, { id: 24, status: "unchanged" }),
                      exampleRun("import-luma", exampleLumaResult, {
                        id: 25,
                        at: new Date("2026-10-15T01:55:00Z"),
                        status: "unchanged",
                      }),
                    ],
                  },
                ]}
              />
            </StaffPage>
          ),
        },
        {
          label: "Gmail: a read that found something, and one that failed",
          render: () => (
            <StaffPage as="div">
              <RunTable
                header
                entries={[
                  { shape: "rows", runs: [exampleRun("read-gmail", exampleGmailResult, { id: 26 })] },
                  { shape: "run", tone: "red", runs: [exampleFailedRun("read-gmail", "Database down", { id: 27 })] },
                ]}
              />
            </StaffPage>
          ),
        },
        {
          label: "A job without counts: CiviCRM's, hourly, its run's words spanning the table",
          render: () => (
            <StaffPage as="div">
              <RunTable
                header
                entries={[{ shape: "run", runs: [exampleRun("import-civicrm", exampleCivicrmResult, { id: 28 })] }]}
              />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "RunList",
      file: "app/(staff)/staff/_components/RunList.tsx",
      variants: [
        {
          label:
            "A job that runs often: the day's table, the newest run green, a row for runs that found nothing and an amber one for a problem",
          render: () => (
            <StaffPage as="div">
              <RunList
                none="None"
                runs={[
                  exampleRun("import-luma", exampleLumaResult, { id: 31 }),
                  exampleRun("import-luma", exampleLumaResult, { id: 32 }),
                  exampleRun("import-luma", exampleLumaResult, { id: 33, status: "unchanged" }),
                  exampleRun("import-luma", exampleLumaResult, { id: 34, status: "unchanged" }),
                  exampleRun("import-luma", { ...exampleLumaResult, stoppedBy: "time" }, { id: 35 }),
                ]}
              />
            </StaffPage>
          ),
        },
        {
          label: "A job's page: each day headed",
          render: () => (
            <StaffPage as="div">
              <RunList
                none="None"
                runs={[
                  exampleRun("import-parliament", exampleImportResult, { id: 7, at: new Date("2026-11-03T06:21:00Z") }),
                  exampleRun("import-controlai", exampleControlAiResult, {
                    id: 8,
                    at: new Date("2026-11-02T02:00:00Z"),
                  }),
                  exampleRun("import-senedd", exampleImportResult, {
                    id: 6,
                    at: new Date("2026-11-02T00:30:00Z"),
                    status: "discarded",
                    decidedBy: "jo@pauseai.uk",
                  }),
                ]}
              />
            </StaffPage>
          ),
        },
        {
          label: "None",
          render: () => (
            <StaffPage as="div">
              <RunList runs={[]} none="An example line saying there are none." />
            </StaffPage>
          ),
        },
      ],
    },
  ],
};
