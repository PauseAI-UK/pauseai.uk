import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { keepsPoliticianThreads } from "@/lib/one-off";
import { gmailAccount } from "@/lib/server/gmail-accounts";
import { isLettersInboxAddress } from "@/lib/server/letters-inbox";
import { listSessions, requireStaff } from "@/lib/server/staff-auth";
import { firstOf, type ParamValue } from "@/lib/list-params";
import { disconnectMyGmail } from "../../actions";
import MyGmail from "../../_components/MyGmail";
import StaffSessions from "../../_components/StaffSessions";
import Grid from "../../_components/ui/Grid";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";

export const metadata: Metadata = { title: staffCopy.me.title };

/** Your own page, from your address in the navigation: your address, then two cards, your sessions with the way to end them all, and your Gmail. */
export default async function MePage({ searchParams }: { searchParams: Promise<Record<string, ParamValue>> }) {
  const { email, token } = await requireStaff();
  const [account, sessions] = await Promise.all([gmailAccount(email), listSessions(email, token)]);
  return (
    <Page kind="board">
      <PageHead intro={email}>{staffCopy.me.title}</PageHead>
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
