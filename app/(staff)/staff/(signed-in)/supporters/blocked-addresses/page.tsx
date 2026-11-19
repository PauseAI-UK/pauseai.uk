import type { Metadata } from "next";
import { listBlocks } from "@/lib/oversight/blocks.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { emailsSearch } from "@/lib/staff-search";
import { BLOCKED_ADDRESSES_LIST } from "@/lib/staff-lists";
import { type ParamValue } from "@/lib/list-params";
import { unblockAddress } from "../../../_components/oversight/actions";
import EmailBlockFilters from "../../../_components/email/EmailBlockFilters";
import BlocksTable from "../../../_components/oversight/BlocksTable";
import Page from "../../../_components/ui/Page";
import PageHead from "../../../_components/ui/PageHead";
import { supportersCopy } from "../../../_components/supporters/copy";
import { shellCopy } from "../../../_components/shell/copy";

export const metadata: Metadata = { title: shellCopy.nav.supporterEmails };

/** Every blocked address but politicians', staff's and unknown ones included, and every number WhatsApp couldn't reach. */
export default async function SupporterEmailsPage({
  searchParams,
}: {
  searchParams: Promise<Partial<Record<string, ParamValue>>>;
}) {
  await requireStaff("supporters");
  const { search, page, filter } = emailsSearch(await searchParams);
  const list = await listBlocks("others", filter, page);
  return (
    <Page kind="list">
      <PageHead intro={supportersCopy.blockedAddresses.intro}>{shellCopy.nav.supporterEmails}</PageHead>
      <EmailBlockFilters search={search} numbers action={BLOCKED_ADDRESSES_LIST.path} />
      <BlocksTable
        list={list}
        of={BLOCKED_ADDRESSES_LIST}
        search={search}
        page={page}
        unblock={unblockAddress}
        letterLinks
      />
    </Page>
  );
}
