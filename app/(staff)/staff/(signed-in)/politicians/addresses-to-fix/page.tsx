import type { Metadata } from "next";
import { listBlocks } from "@/lib/oversight/blocks.server";
import { canSeeSupporters, requireStaff } from "@/lib/accounts/auth.server";
import { emailsSearch } from "@/lib/staff-search";
import { ADDRESSES_TO_FIX_LIST } from "@/lib/staff-lists";
import { type ParamValue } from "@/lib/list-params";
import { unblockAddress } from "../../../_components/oversight/actions";
import EmailBlockFilters from "../../../_components/email/EmailBlockFilters";
import BlocksTable from "../../../_components/oversight/BlocksTable";
import Page from "../../../_components/ui/Page";
import PageHead from "../../../_components/ui/PageHead";
import { politiciansCopy } from "../../../_components/politicians/copy";

export const metadata: Metadata = { title: politiciansCopy.addressesToFix.title };

/** Politicians' blocked addresses. The letters they name lead to them only with `supporters`. */
export default async function MpEmailsPage({
  searchParams,
}: {
  searchParams: Promise<Partial<Record<string, ParamValue>>>;
}) {
  const letterLinks = canSeeSupporters(await requireStaff());
  const { search, page, filter } = emailsSearch(await searchParams);
  const list = await listBlocks("politicians", filter, page);
  return (
    <Page kind="list">
      <PageHead intro={politiciansCopy.addressesToFix.intro}>{politiciansCopy.addressesToFix.title}</PageHead>
      <EmailBlockFilters search={search} numbers={false} action={ADDRESSES_TO_FIX_LIST.path} />
      <BlocksTable
        list={list}
        of={ADDRESSES_TO_FIX_LIST}
        search={search}
        page={page}
        unblock={unblockAddress}
        letterLinks={letterLinks}
      />
    </Page>
  );
}
