import type { Metadata } from "next";
import { devLoginAccounts } from "@/lib/accounts/dev-login.server";
import { localLogin } from "@/lib/accounts/local-login.server";
import DevLogin from "../_components/accounts/DevLogin";
import LoginCard from "../_components/accounts/LoginCard";
import LoginForm from "../_components/accounts/LoginForm";
import StaffNav from "../_components/shell/StaffNav";
import StaffPage from "../_components/ui/StaffPage";
import { accountsCopy } from "../_components/accounts/copy";

// Open to anyone: it's where staff log in, so it doesn't call requireStaff().
// On a local build without fixtures, the card prints a link instead of
// going to Google (lib/accounts/local-login.server.ts). In a fixture build,
// the dev login sits under the card. Both log in to the
// page in `next`, if it's a staff page.
export const metadata: Metadata = { title: accountsCopy.login.title };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ failed?: string; other?: string; printed?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <StaffPage>
      <StaffNav />
      <LoginCard title={accountsCopy.login.title}>
        <LoginForm {...params} local={localLogin()} />
      </LoginCard>
      <DevLogin accounts={await devLoginAccounts()} next={params.next} />
    </StaffPage>
  );
}
