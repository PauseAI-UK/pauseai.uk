import type { Metadata } from "next";
import { requireStaff } from "@/lib/accounts/auth";
import { listStaffAccounts } from "@/lib/accounts/staff-accounts";
import { accountsSearch } from "@/lib/staff-search";
import { endStaffSessionsNow, removeStaffAccountNow, saveStaffAccountNow } from "../../_components/accounts/actions";
import AccountsNotice from "../../_components/accounts/AccountsNotice";
import StaffAccountsTable, { AddStaff } from "../../_components/accounts/StaffAccountsTable";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";
import { accountsCopy } from "../../_components/accounts/copy";

/** Who may use the staff pages, and what each may do, for admins to change. */
export const metadata: Metadata = { title: accountsCopy.accounts.title };

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; sort?: string; dir?: string }>;
}) {
  const { email } = await requireStaff("admin");
  const { notice, sort } = accountsSearch(await searchParams);
  const accounts = await listStaffAccounts(sort);
  return (
    <Page kind="list">
      <PageHead intro={accountsCopy.accounts.intro} action={<AddStaff accounts={accounts} add={saveStaffAccountNow} />}>
        {accountsCopy.accounts.title}
      </PageHead>
      <AccountsNotice notice={notice} />
      <StaffAccountsTable
        accounts={accounts}
        you={email}
        sort={sort}
        save={saveStaffAccountNow}
        remove={removeStaffAccountNow}
        endSessions={endStaffSessionsNow}
      />
    </Page>
  );
}
