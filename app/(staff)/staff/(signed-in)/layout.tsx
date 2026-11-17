import { requireStaff } from "@/lib/accounts/auth.server";
import { newPagesFor } from "@/lib/accounts/nav-seen.server";
import SiteUpdated from "../_components/shell/SiteUpdated";
import StaffNav from "../_components/shell/StaffNav";
import StaffPage from "../_components/ui/StaffPage";

/**
 * Every signed-in staff page: the page's frame, with the navigation beside
 * it, drawn once and kept as staff move between pages, so only the page
 * changes, once the next one has arrived (StaffLink); and, over it, that the
 * site's been updated, once a button finds so (SiteUpdated). Each page still
 * calls requireStaff() for what it needs; this one asks only for an account,
 * for the navigation.
 */
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const { email, permissions } = await requireStaff();
  const fresh = await newPagesFor(email, permissions);
  return (
    <StaffPage nav={<StaffNav email={email} permissions={permissions} fresh={fresh} />}>
      {children}
      <SiteUpdated />
    </StaffPage>
  );
}
