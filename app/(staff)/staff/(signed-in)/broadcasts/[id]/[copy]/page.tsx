import type { Metadata } from "next";
import { found } from "@/lib/found";
import { messageCopy } from "@/lib/broadcasts/pages.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { mailingId } from "@/lib/staff-search";
import MessageCopyView from "../../../../_components/broadcasts/MessageCopyView";
import Page from "../../../../_components/ui/Page";
import { answerReplyNow, dealWithReplyNow } from "../../../../_components/broadcasts/actions";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

type Params = { params: Promise<{ id: string; copy: string }> };

/** The copy in the URL, or a 404. */
async function copyOf(params: Params["params"]) {
  const { id, copy } = await params;
  return found(await messageCopy(found(mailingId(id)), found(mailingId(copy))));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireStaff("supporters");
  return { title: (await copyOf(params)).title };
}

/** Thread: one supporter's message of a broadcast. */
export default async function MessageCopyPage({ params }: Params) {
  await requireStaff("supporters");
  const one = await copyOf(params);
  return (
    <Page
      kind="item"
      under="broadcasts"
      via={[{ href: `/staff/broadcasts/${one.messageId}`, label: one.title }]}
      here={broadcastsCopy.broadcastPages.copyCrumb(one.channel)}
    >
      <MessageCopyView one={one} actions={{ deal: dealWithReplyNow, answer: answerReplyNow }} />
    </Page>
  );
}
