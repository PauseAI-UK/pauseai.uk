// The staff interface's dashboard, imports, audit log, accounts, login and
// Gmail, on fake runs and changes.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
import { keepSignedInGallery } from "@/app/(staff)/staff/_components/accounts/KeepSignedIn.gallery";
import { myGmailGallery } from "@/app/(staff)/staff/_components/email/MyGmail.gallery";
import { gmailConnectGallery } from "@/app/(staff)/staff/_components/email/GmailConnect.gallery";
import { staffSessionsGallery } from "@/app/(staff)/staff/_components/accounts/StaffSessions.gallery";
import { staffAccountsTableGallery } from "@/app/(staff)/staff/_components/accounts/StaffAccountsTable.gallery";
import { accountsNoticeGallery } from "@/app/(staff)/staff/_components/accounts/AccountsNotice.gallery";
import { loginCardGallery } from "@/app/(staff)/staff/_components/accounts/LoginCard.gallery";
import { devLoginGallery } from "@/app/(staff)/staff/_components/accounts/DevLogin.gallery";
import { loginFormGallery } from "@/app/(staff)/staff/_components/accounts/LoginForm.gallery";
import type { Group } from "../_components/types";
import { permissionTilesGallery } from "@/app/(staff)/staff/_components/supporters/PermissionTiles.gallery";
import { loggedGallery } from "@/app/(staff)/staff/_components/ui/Logged.gallery";
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
    ...permissionTilesGallery,
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
    ...loggedGallery,
    ...changesFiltersGallery,
    ...changesTableGallery,
    ...resultBoxGallery,
    ...runGallery,
    ...runBoxGallery,
    ...runTableGallery,
    ...runListGallery,
  ],
};
