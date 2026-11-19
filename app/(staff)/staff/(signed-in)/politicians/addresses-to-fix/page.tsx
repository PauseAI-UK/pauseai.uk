import type { Metadata } from "next";
import { listBlocks } from "@/lib/oversight/blocks.server";
import { canSeeSupporters, requireStaff } from "@/lib/accounts/auth.server";
import { emailsSearch } from "@/lib/staff-search";
import { clearedTo, filtersPath, pageParam } from "@/lib/list-params";
import { unblockAddress } from "../../../_components/oversight/actions";
import EmailBlockFilters from "../../../_components/email/EmailBlockFilters";
import BlocksTable from "../../../_components/oversight/BlocksTable";
import Page from "../../../_components/ui/Page";
import PageHead from "../../../_components/ui/PageHead";
import { politiciansCopy } from "../../../_components/politicians/copy";

export const metadata: Metadata = { title: politiciansCopy.addressesToFix.title };

const PATH = "/staff/politicians/addresses-to-fix";

/** Politicians' blocked addresses. The letters they name lead to them only with `supporters`. */
export default async function MpEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; found?: string; page?: string }>;
}) {
  const letterLinks = canSeeSupporters(await requireStaff());
  const { q, kind, found, page, filter } = emailsSearch(await searchParams);
  const list = await listBlocks("politicians", filter, page);
  return (
    <Page kind="list">
      <PageHead intro={politiciansCopy.addressesToFix.intro}>{politiciansCopy.addressesToFix.title}</PageHead>
      <EmailBlockFilters q={q} kind={kind} found={found} numbers={false} action={PATH} />
      <BlocksTable
        list={list}
        page={page}
        href={(n) => filtersPath(PATH, { q, kind, found }, pageParam(n))}
        unblock={unblockAddress}
        letterLinks={letterLinks}
        download={(format) => filtersPath(`${PATH}/download`, { q, kind, found, format })}
        clear={clearedTo(PATH, { q, kind, found })}
      />
    </Page>
  );
}
