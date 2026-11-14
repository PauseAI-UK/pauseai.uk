import type { Metadata } from "next";
import { requireStaff } from "@/lib/accounts/auth.server";
import { dashboardOf, spanOf } from "@/lib/dashboard/dashboard";
import { eventsTiles } from "@/lib/dashboard/events.server";
import { needsAPerson } from "@/lib/dashboard/needs-a-person.server";
import { politiciansTiles } from "@/lib/dashboard/politicians.server";
import { supportersTiles } from "@/lib/dashboard/supporters.server";
import { now } from "@/lib/now";
import { dashboardWindow } from "@/lib/time-windows";
import StaffHome from "../_components/dashboard/StaffHome";
import Page from "../_components/ui/Page";
import { dashboardCopy } from "../_components/dashboard/copy";

export const metadata: Metadata = { title: dashboardCopy.home.title };

/**
 * The staff home: the dashboard, over the window the URL asks for, each group
 * of tiles loading its own numbers. The pages this staff member can see, and
 * their sessions, are in the sidebar.
 */
export default async function StaffHomePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { permissions } = await requireStaff();
  const { days } = await searchParams;
  const span = spanOf(dashboardWindow(days), now());
  const [supporters, politicians, events, actions] = await Promise.all([
    supportersTiles(span),
    politiciansTiles(span),
    eventsTiles(span),
    needsAPerson(),
  ]);
  return (
    <Page kind="board">
      <StaffHome
        permissions={permissions}
        dashboard={dashboardOf(span, { supporters, politicians, events }, actions)}
      />
    </Page>
  );
}
