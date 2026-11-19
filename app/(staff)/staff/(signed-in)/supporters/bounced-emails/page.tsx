import type { Metadata } from "next";
import { listBlocks } from "@/lib/oversight/blocks.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { emailsSearch } from "@/lib/staff-search";
import { clearedTo, filtersPath, pageParam } from "@/lib/list-params";
import { unblockAddress } from "../../../_components/oversight/actions";
import EmailBlockFilters from "../../../_components/email/EmailBlockFilters";
import BlocksTable from "../../../_components/oversight/BlocksTable";
import Page from "../../../_components/ui/Page";
import PageHead from "../../../_components/ui/PageHead";
import { supportersCopy } from "../../../_components/supporters/copy";

export const metadata: Metadata = { title: supportersCopy.bouncedEmails.title };

const PATH = "/staff/supporters/bounced-emails";

/** Every blocked address but politicians', staff's and unknown ones included, and every number WhatsApp couldn't reach. */
export default async function SupporterEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; found?: string; page?: string }>;
}) {
  await requireStaff("supporters");
  const { q, kind, found, page, filter } = emailsSearch(await searchParams);
  const list = await listBlocks("others", filter, page);
  return (
    <Page kind="list">
      <PageHead intro={supportersCopy.bouncedEmails.intro}>{supportersCopy.bouncedEmails.title}</PageHead>
      <EmailBlockFilters q={q} kind={kind} found={found} numbers action={PATH} />
      <BlocksTable
        list={list}
        page={page}
        href={(n) => filtersPath(PATH, { q, kind, found }, pageParam(n))}
        unblock={unblockAddress}
        letterLinks
        download={(format) => filtersPath(`${PATH}/download`, { q, kind, found, format })}
        clear={clearedTo(PATH, { q, kind, found })}
      />
    </Page>
  );
}
