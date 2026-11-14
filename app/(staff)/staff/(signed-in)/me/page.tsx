import type { Metadata } from "next";
import { keepsPoliticianThreads } from "@/lib/one-off";
import { gmailAccount } from "@/lib/accounts/gmail-accounts.server";
import { isLettersInboxAddress } from "@/lib/server/letters-inbox.server";
import { listSessions, requireStaff } from "@/lib/accounts/auth.server";
import { firstOf, type ParamValue } from "@/lib/list-params";
import { disconnectMyGmail } from "../../_components/accounts/actions";
import MyGmail from "../../_components/accounts/MyGmail";
import StaffSessions from "../../_components/accounts/StaffSessions";
import Grid from "../../_components/ui/Grid";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";
import { accountsCopy } from "../../_components/accounts/copy";

export const metadata: Metadata = { title: accountsCopy.me.title };

/** Your own page, from your address in the navigation: your address, then two cards, your sessions with the way to end them all, and your Gmail. */
export default async function MePage({ searchParams }: { searchParams: Promise<Record<string, ParamValue>> }) {
  const { email, token } = await requireStaff();
  const [account, sessions] = await Promise.all([gmailAccount(email), listSessions(email, token)]);
  return (
    <Page kind="board">
      <PageHead intro={email}>{accountsCopy.me.title}</PageHead>
      <Grid even>
        <StaffSessions sessions={sessions} />
        <MyGmail
          me={email}
          lettersInbox={isLettersInboxAddress(email)}
          account={account}
          outcome={firstOf((await searchParams).gmail)}
          disconnect={disconnectMyGmail}
          keepsThreads={keepsPoliticianThreads(email)}
        />
      </Grid>
    </Page>
  );
}
