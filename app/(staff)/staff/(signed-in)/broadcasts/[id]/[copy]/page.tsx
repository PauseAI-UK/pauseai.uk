import type { Metadata } from "next";
import { found } from "@/lib/found";
import { messageCopy } from "@/lib/server/broadcast-pages";
import { requireStaff } from "@/lib/server/staff-auth";
import { mailingId } from "@/lib/staff-search";
import Breadcrumb from "../../../../_components/Breadcrumb";
import MessageCopyView from "../../../../_components/MessageCopyView";
import { replyToMessageNow } from "../../../../broadcast-actions";

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

/** Thread: one supporter's message of a broadcast, and every reply. */
export default async function MessageCopyPage({ params }: Params) {
  await requireStaff("supporters");
  const one = await copyOf(params);
  return (
    <>
      <Breadcrumb href={`/staff/broadcasts/${one.messageId}`}>{one.title}</Breadcrumb>
      <MessageCopyView one={one} reply={replyToMessageNow} />
    </>
  );
}
