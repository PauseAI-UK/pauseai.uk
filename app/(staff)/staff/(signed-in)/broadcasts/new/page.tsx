import type { Metadata } from "next";
import { newBroadcastPageData } from "@/lib/broadcasts/pages.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import ChannelWriter from "../../../_components/broadcasts/ChannelWriter";
import Page from "../../../_components/ui/Page";
import { BroadcastWho } from "../../../_components/broadcasts/BroadcastFor";
import { broadcastWriterActions } from "../../../_components/broadcasts/writer-actions";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

export const metadata: Metadata = { title: broadcastsCopy.broadcastPages.newBroadcast };

/**
 * New broadcast: the writer, its Consent to choose first, which makes the
 * draft; everything after it greyed till then, to show what's to come,
 * an email's or a text's as the channel is picked.
 */
export default async function NewBroadcastPage() {
  const { email } = await requireStaff("supporters");
  const { draft, data } = await newBroadcastPageData(email);
  return (
    <Page kind="form" under="broadcasts" here={broadcastsCopy.broadcastPages.newBroadcast}>
      <ChannelWriter
        fresh
        data={data}
        draft={draft}
        who={<BroadcastWho params={draft.filter.params} choices={data.choices} />}
        actions={broadcastWriterActions}
      />
    </Page>
  );
}
