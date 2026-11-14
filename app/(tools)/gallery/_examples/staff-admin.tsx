import SentEmails from "@/app/(staff)/staff/_components/SentEmails";
import ErrorsSeen from "@/app/(staff)/staff/_components/ErrorsSeen";
import { exampleErrorDone, exampleErrorsSeen } from "@/app/(staff)/staff/_components/ErrorsSeen.examples";
// The staff interface's dashboard, imports, audit log, accounts, login and
// Gmail, on fake runs and changes.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
import ChangesTable from "@/app/(staff)/staff/_components/ChangesTable";
import { exampleChanges } from "@/app/(staff)/staff/_components/ChangesTable.examples";
import AuditDetail, { FieldChanges } from "@/app/(staff)/staff/_components/AuditDetail";
import { DotParts, LoggedJson } from "@/app/(staff)/staff/_components/Logged";
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
import { changesSearch } from "@/lib/staff-search";
import type { Group } from "../_components/types";
import { ErrorSeenViewExample, ChangesFiltersExample } from "./staff.client";
import { exampleSentEmails } from "@/app/(staff)/staff/_components/SentEmails.examples";
import { importIconGallery } from "@/app/(staff)/staff/_components/jobs/ImportIcon.gallery";
import { importCardGallery } from "@/app/(staff)/staff/_components/jobs/ImportCard.gallery";
import { importJobGallery } from "@/app/(staff)/staff/_components/jobs/ImportJob.gallery";
import { jobActionsGallery } from "@/app/(staff)/staff/_components/jobs/JobActions.gallery";
import { resultBoxGallery } from "@/app/(staff)/staff/_components/jobs/ResultBox.gallery";
import { runGallery } from "@/app/(staff)/staff/_components/jobs/Run.gallery";
import { runBoxGallery } from "@/app/(staff)/staff/_components/jobs/RunBox.gallery";
import { runTableGallery } from "@/app/(staff)/staff/_components/jobs/RunTable.gallery";
import { runListGallery } from "@/app/(staff)/staff/_components/jobs/RunList.gallery";

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
    ...importIconGallery,
    ...importCardGallery,
    ...importJobGallery,
    ...loginCardGallery,
    ...devLoginGallery,
    ...loginFormGallery,
    ...jobActionsGallery,
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
    ...resultBoxGallery,
    ...runGallery,
    ...runBoxGallery,
    ...runTableGallery,
    ...runListGallery,
  ],
};
