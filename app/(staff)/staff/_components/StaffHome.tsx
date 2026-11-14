import { staffCopy } from "@/lib/content/staff-interface";
import type { Dashboard } from "@/lib/staff-dashboard";
import type { Permission } from "@/lib/accounts/permissions";
import { staffDay } from "@/lib/staff-time";
import StaffDashboard from "./StaffDashboard";
import PageHead from "./ui/PageHead";

/** The home page's body: its title, the day under it, and the dashboard. The pages and permissions are in the sidebar. */
export default function StaffHome({ permissions, dashboard }: { permissions: Permission[]; dashboard: Dashboard }) {
  return (
    <>
      <PageHead intro={staffDay(dashboard.asOf)}>{staffCopy.home.title}</PageHead>
      <StaffDashboard dashboard={dashboard} permissions={permissions} />
    </>
  );
}
