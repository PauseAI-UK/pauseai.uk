import type { Metadata } from "next";
import { listSentEmails } from "@/lib/server/sent-emails.server";
import { canSeeSupporters, requireStaff } from "@/lib/accounts/auth.server";
import { sentEmailsSearch, type SentEmailsSearch } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import SentEmails from "../../_components/SentEmails";
import Page from "../../_components/ui/Page";
import { shellCopy } from "../../_components/shell/copy";

export const metadata: Metadata = { title: shellCopy.nav.sentEmails };

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
