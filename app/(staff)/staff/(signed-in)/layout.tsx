import { requireStaff } from "@/lib/accounts/auth.server";
import { newPagesFor } from "@/lib/accounts/nav-seen.server";
import { staffNames } from "@/lib/accounts/staff-accounts.server";
import SiteUpdated from "../_components/shell/SiteUpdated";
import StaffNav from "../_components/shell/StaffNav";
import { RefusalPlace } from "../_components/ui/ResultForm";
import { StaffNames } from "../_components/ui/StaffNames";
import StaffPage from "../_components/ui/StaffPage";

/**
 * Every signed-in staff page: the page's frame, with the navigation beside
 * it, drawn once and kept as staff move between pages, so only the page
 * changes, once the next one has arrived (StaffLink); and, over it, that the
 * site's been updated, once a button finds so (SiteUpdated); every staff
 * member's name, for StaffMember's bubble (StaffNames); and at the page's
 * top, what a form in it says there (RefusalPlace). Each page still
 * calls requireStaff() for what it needs; this one asks only for an account,
 * for the navigation.
 */
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const { email, permissions } = await requireStaff();
  const [fresh, names] = await Promise.all([newPagesFor(email, permissions), staffNames()]);
  return (
    <StaffNames names={names}>
      <StaffPage nav={<StaffNav email={email} permissions={permissions} fresh={fresh} />}>
        <RefusalPlace>{children}</RefusalPlace>
        <SiteUpdated />
      </StaffPage>
    </StaffNames>
  );
}
