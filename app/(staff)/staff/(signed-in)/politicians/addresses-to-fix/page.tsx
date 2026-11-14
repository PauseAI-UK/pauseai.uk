import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { listBlocks, recentProblems } from "@/lib/server/email.server";
import { canSeeSupporters, requireStaff } from "@/lib/accounts/auth.server";
import { emailsSearch } from "@/lib/staff-search";
import { clearedTo, filtersPath } from "@/lib/list-params";
import { unblockAddress } from "../../../actions";
import EmailBlockFilters from "../../../_components/EmailBlockFilters";
import EmailBlocksTable from "../../../_components/EmailBlocksTable";
import EmailProblemsTable from "../../../_components/EmailProblemsTable";
import Page from "../../../_components/ui/Page";
import PageHead from "../../../_components/ui/PageHead";
import { politiciansCopy } from "../../../_components/politicians/copy";

export const metadata: Metadata = { title: politiciansCopy.addressesToFix.title };

/** Politicians' blocked addresses, and their bounces and complaints. The letters they name lead to them only with `supporters`. */
export default async function MpEmailsPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  const letterLinks = canSeeSupporters(await requireStaff());
  const { q, kind, filter } = emailsSearch(await searchParams);
  const [blocks, problems] = await Promise.all([listBlocks("politicians", filter), recentProblems("politicians")]);
  return (
    <Page kind="list">
      <PageHead intro={politiciansCopy.addressesToFix.intro}>{politiciansCopy.addressesToFix.title}</PageHead>
      <EmailBlockFilters q={q} kind={kind} action="/staff/politicians/addresses-to-fix" />
      <EmailBlocksTable
        blocks={blocks}
        unblock={unblockAddress}
        letterLinks={letterLinks}
        download={(format) => filtersPath("/staff/politicians/addresses-to-fix/download", { q, kind, format })}
        clear={clearedTo("/staff/politicians/addresses-to-fix", { q, kind })}
      />
      <h2>{staffCopy.emails.problemsTitle}</h2>
      <EmailProblemsTable problems={problems} letterLinks={letterLinks} />
    </Page>
  );
}
