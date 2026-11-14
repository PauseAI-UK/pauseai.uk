import type { Metadata } from "next";
import { found } from "@/lib/found";
import { broadcastCrumb, broadcastPageData, broadcastTitle } from "@/lib/server/broadcast-pages.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { mailingId } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import BroadcastFor from "../../../_components/BroadcastFor";
import Page from "../../../_components/ui/Page";
import { broadcastWriterActions } from "../writer-actions";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: ParamValue; tab?: ParamValue }>;
};

export async function generateMetadata({ params }: Pick<Params, "params">): Promise<Metadata> {
  await requireStaff("supporters");
  return { title: found(await broadcastTitle(found(mailingId((await params).id)))) };
}

/** A broadcast to supporters: a draft, to write; or one scheduled or sent. */
export default async function BroadcastPage({ params, searchParams }: Params) {
  const { email } = await requireStaff("supporters");
  const id = found(mailingId((await params).id));
  const [data, here] = await Promise.all([broadcastPageData(id, await searchParams, email), broadcastCrumb(id)]);
  return (
    <Page kind="record" under="broadcasts" here={found(here)}>
      <BroadcastFor data={found(data)} actions={broadcastWriterActions} />
    </Page>
  );
}
