// The staff interface's dashboard, imports, audit log, accounts, login and
// Gmail, on fake runs and changes.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
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
import PermissionTiles, { ContactLink } from "@/app/(staff)/staff/_components/PermissionTiles";
import {
  exampleBlockedPermissions,
  exampleMemberDetails,
  exampleSupporterDetails,
} from "@/app/(staff)/staff/_components/supporters/SupportersTable.examples";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";
import type { Group } from "../_components/types";
import { staffHomeGallery } from "@/app/(staff)/staff/_components/dashboard/StaffHome.gallery";
import { sparklineGallery } from "@/app/(staff)/staff/_components/dashboard/Sparkline.gallery";
import { stackedBarsGallery } from "@/app/(staff)/staff/_components/dashboard/StackedBars.gallery";
import { staffDashboardGallery } from "@/app/(staff)/staff/_components/dashboard/StaffDashboard.gallery";
import { changesTableGallery } from "@/app/(staff)/staff/_components/oversight/ChangesTable.gallery";
import { changesFiltersGallery } from "@/app/(staff)/staff/_components/oversight/ChangesFilters.gallery";
import { fieldChangesGallery } from "@/app/(staff)/staff/_components/politicians/FieldChanges.gallery";
import { auditDetailGallery } from "@/app/(staff)/staff/_components/oversight/AuditDetail.gallery";
import { errorSeenViewGallery } from "@/app/(staff)/staff/_components/oversight/ErrorSeenView.gallery";
import { errorsSeenGallery } from "@/app/(staff)/staff/_components/oversight/ErrorsSeen.gallery";
import { sentEmailsGallery } from "@/app/(staff)/staff/_components/oversight/SentEmails.gallery";
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
    ...sentEmailsGallery,
    ...errorsSeenGallery,
    ...errorSeenViewGallery,
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
    ...staffDashboardGallery,
    ...stackedBarsGallery,
    ...sparklineGallery,
    ...staffHomeGallery,
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
    ...auditDetailGallery,
    ...fieldChangesGallery,
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
    ...changesFiltersGallery,
    ...changesTableGallery,
    ...resultBoxGallery,
    ...runGallery,
    ...runBoxGallery,
    ...runTableGallery,
    ...runListGallery,
  ],
};
