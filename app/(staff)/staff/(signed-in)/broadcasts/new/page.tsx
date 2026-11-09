import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { newBroadcastPageData } from "@/lib/server/broadcast-pages";
import { requireStaff } from "@/lib/server/staff-auth";
import Breadcrumb from "../../../_components/Breadcrumb";
import ChannelWriter from "../../../_components/ChannelWriter";
import { BroadcastWho } from "../../../_components/BroadcastFor";
import { broadcastWriterActions } from "../writer-actions";

export const metadata: Metadata = { title: staffCopy.broadcastPages.newBroadcast };

/**
 * New broadcast: the writer, its Consent to choose first, which makes the
 * draft; everything after it greyed till then, to show what's to come,
 * an email's or a text's as the channel is picked.
 */
export default async function NewBroadcastPage() {
  const { email } = await requireStaff("supporters");
  const { draft, data } = await newBroadcastPageData(email);
  return (
    <>
      <Breadcrumb href="/staff/broadcasts">{staffCopy.nav.broadcasts}</Breadcrumb>
      <ChannelWriter
        fresh
        data={data}
        draft={draft}
        who={<BroadcastWho params={draft.filter.params} choices={data.choices} />}
        actions={broadcastWriterActions}
      />
    </>
  );
}
