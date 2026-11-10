import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { found } from "@/lib/found";
import { broadcastPageData, broadcastTitle } from "@/lib/server/broadcast-pages";
import { requireStaff } from "@/lib/server/staff-auth";
import { mailingId } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import Breadcrumb from "../../../_components/Breadcrumb";
import BroadcastFor from "../../../_components/BroadcastFor";
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
  const data = found(await broadcastPageData(found(mailingId((await params).id)), await searchParams, email));
  return (
    <>
      <Breadcrumb href="/staff/broadcasts">{staffCopy.nav.broadcasts}</Breadcrumb>
      <BroadcastFor data={data} actions={broadcastWriterActions} />
    </>
  );
}
