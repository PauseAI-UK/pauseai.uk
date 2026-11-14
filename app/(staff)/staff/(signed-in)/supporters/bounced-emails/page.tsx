import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { listBlocks, recentProblems } from "@/lib/server/email.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { emailsSearch } from "@/lib/staff-search";
import { clearedTo, filtersPath } from "@/lib/list-params";
import { unblockAddress } from "../../../actions";
import EmailBlockFilters from "../../../_components/EmailBlockFilters";
import EmailBlocksTable from "../../../_components/EmailBlocksTable";
import EmailProblemsTable from "../../../_components/EmailProblemsTable";
import Page from "../../../_components/ui/Page";
import PageHead from "../../../_components/ui/PageHead";
import { supportersCopy } from "../../../_components/supporters/copy";

export const metadata: Metadata = { title: supportersCopy.bouncedEmails.title };

/** Every blocked address but politicians', staff's and unknown ones included, and their bounces and complaints. */
export default async function SupporterEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  await requireStaff("supporters");
  const { q, kind, filter } = emailsSearch(await searchParams);
  const [blocks, problems] = await Promise.all([listBlocks("others", filter), recentProblems("others")]);
  return (
    <Page kind="list">
      <PageHead intro={supportersCopy.bouncedEmails.intro}>{supportersCopy.bouncedEmails.title}</PageHead>
      <EmailBlockFilters q={q} kind={kind} action="/staff/supporters/bounced-emails" />
      <EmailBlocksTable
        blocks={blocks}
        unblock={unblockAddress}
        letterLinks
        download={(format) => filtersPath("/staff/supporters/bounced-emails/download", { q, kind, format })}
        clear={clearedTo("/staff/supporters/bounced-emails", { q, kind })}
      />
      <h2>{staffCopy.emails.problemsTitle}</h2>
      <EmailProblemsTable problems={problems} letterLinks />
    </Page>
  );
}
