import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { found } from "@/lib/found";
import { askToEdit } from "@/lib/server/asks";
import { requireStaff } from "@/lib/accounts/auth";
import { askFormSearch } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import { deleteAskNow, saveAskNow } from "../../../../actions";
import AskForm from "../../../../_components/AskForm";
import Page from "../../../../_components/ui/Page";
import PageHead from "../../../../_components/ui/PageHead";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, ParamValue>> };

export async function generateMetadata({ params }: Pick<Params, "params">): Promise<Metadata> {
  await requireStaff();
  return { title: staffCopy.asks.editTitle(found(await askToEdit((await params).slug)).title) };
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
      here={staffCopy.asks.edit}
    >
      <PageHead>{staffCopy.asks.editTitle(ask.title)}</PageHead>
      <AskForm ask={ask} back={back} notice={notice} save={saveAskNow} remove={deleteAskNow} />
    </Page>
  );
}
