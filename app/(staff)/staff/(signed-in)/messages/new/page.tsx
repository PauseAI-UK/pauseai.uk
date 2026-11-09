import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { newMessagePageData } from "@/lib/server/message-pages";
import { requireStaff } from "@/lib/server/staff-auth";
import Breadcrumb from "../../../_components/Breadcrumb";
import ChannelWriter from "../../../_components/ChannelWriter";
import { MessageWho } from "../../../_components/MessageFor";
import { messageWriterActions } from "../writer-actions";

export const metadata: Metadata = { title: staffCopy.messagePages.newMessage };

/**
 * New broadcast: the writer, its Consent to choose first, which makes the
 * draft; everything after it greyed till then, to show what's to come,
 * an email's or a text's as the channel is picked.
 */
export default async function NewMessagePage() {
  const { email } = await requireStaff("supporters");
  const { draft, data } = await newMessagePageData(email);
  return (
    <>
      <Breadcrumb href="/staff/messages">{staffCopy.nav.messages}</Breadcrumb>
      <ChannelWriter
        fresh
        data={data}
        draft={draft}
        who={<MessageWho params={draft.filter.params} choices={data.choices} />}
        actions={messageWriterActions}
      />
    </>
  );
}
