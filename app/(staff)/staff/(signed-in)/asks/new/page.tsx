import type { Metadata } from "next";
import { requireStaff } from "@/lib/accounts/auth";
import { askFormSearch } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import { deleteAskNow, saveAskNow } from "../../../_components/asks/actions";
import AskForm from "../../../_components/asks/AskForm";
import Page from "../../../_components/ui/Page";
import PageHead from "../../../_components/ui/PageHead";
import { asksCopy } from "@/lib/asks/copy";

export const metadata: Metadata = { title: asksCopy.asks.newTitle };

/** A new ask: its form, which goes back to the page it came from, such as a mailing's. */
export default async function NewAskPage({ searchParams }: { searchParams: Promise<Record<string, ParamValue>> }) {
  await requireStaff();
  const { back, notice } = askFormSearch(await searchParams);
  return (
    <Page kind="form" under="asks" here={asksCopy.asks.newTitle}>
      <PageHead>{asksCopy.asks.newTitle}</PageHead>
      <AskForm ask={null} back={back} notice={notice} save={saveAskNow} remove={deleteAskNow} />
    </Page>
  );
}
