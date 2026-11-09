import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { requireStaff } from "@/lib/server/staff-auth";
import NewMessage from "../../../_components/NewMessage";
import { newMessageChoosing } from "../../../message-actions";

export const metadata: Metadata = { title: staffCopy.messagePages.newMessage };

/** New broadcast: the Consent it goes under, then on to choose who. */
export default async function NewMessagePage() {
  await requireStaff("supporters");
  return <NewMessage action={newMessageChoosing} />;
}
