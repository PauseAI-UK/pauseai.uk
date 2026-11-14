import type { Metadata } from "next";
import { requireStaff } from "@/lib/accounts/auth";
import { askFormSearch } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import { deleteAskNow, saveAskNow } from "../../../_components/campaigns/actions";
import AskForm from "../../../_components/campaigns/AskForm";
import Page from "../../../_components/ui/Page";
import PageHead from "../../../_components/ui/PageHead";
import { campaignsCopy } from "@/lib/campaigns/copy";

export const metadata: Metadata = { title: campaignsCopy.asks.newTitle };

/** A new ask: its form, which goes back to the page it came from, such as a mailing's. */
export default async function NewAskPage({ searchParams }: { searchParams: Promise<Record<string, ParamValue>> }) {
  await requireStaff();
  const { back, notice } = askFormSearch(await searchParams);
  return (
    <Page kind="form" under="asks" here={campaignsCopy.asks.newTitle}>
      <PageHead>{campaignsCopy.asks.newTitle}</PageHead>
      <AskForm ask={null} back={back} notice={notice} save={saveAskNow} remove={deleteAskNow} />
    </Page>
  );
}
