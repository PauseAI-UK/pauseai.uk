import type { Metadata } from "next";
import { found } from "@/lib/found";
import { askToEdit } from "@/lib/campaigns/records";
import { requireStaff } from "@/lib/accounts/auth";
import { askFormSearch } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import { deleteAskNow, saveAskNow } from "../../../../_components/campaigns/actions";
import AskForm from "../../../../_components/campaigns/AskForm";
import Page from "../../../../_components/ui/Page";
import PageHead from "../../../../_components/ui/PageHead";
import { campaignsCopy } from "@/lib/campaigns/copy";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, ParamValue>> };

export async function generateMetadata({ params }: Pick<Params, "params">): Promise<Metadata> {
  await requireStaff();
  return { title: campaignsCopy.asks.editTitle(found(await askToEdit((await params).slug)).title) };
}

/** An ask, to change or delete. */
export default async function AskPage({ params, searchParams }: Params) {
  await requireStaff();
  const ask = found(await askToEdit((await params).slug));
  const { back, notice } = askFormSearch(await searchParams);
  return (
    <Page
      kind="form"
      under="asks"
      via={[{ href: `/staff/asks/${ask.slug}`, label: ask.title }]}
      here={campaignsCopy.asks.edit}
    >
      <PageHead>{campaignsCopy.asks.editTitle(ask.title)}</PageHead>
      <AskForm ask={ask} back={back} notice={notice} save={saveAskNow} remove={deleteAskNow} />
    </Page>
  );
}
