import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { listSentEmails } from "@/lib/server/sent-emails";
import { canSeeSupporters, requireStaff } from "@/lib/server/staff-auth";
import { sentEmailsSearch, type SentEmailsSearch } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import SentEmails from "../../_components/SentEmails";
import Page from "../../_components/ui/Page";

export const metadata: Metadata = { title: staffCopy.nav.sentEmails };

/** Everything in the send log, newest first, with just a search and filters over the table. */
export default async function SentEmailsPage({
  searchParams,
}: {
  searchParams: Promise<Partial<Record<keyof SentEmailsSearch, ParamValue>>>;
}) {
  const supporters = canSeeSupporters(await requireStaff("admin"));
  const { filter, ...search } = sentEmailsSearch(await searchParams);
  return (
    <Page kind="list">
      <SentEmails {...await listSentEmails(filter, supporters)} search={search} supporters={supporters} />
    </Page>
  );
}
