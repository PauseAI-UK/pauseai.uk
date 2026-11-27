import type { Metadata } from "next";
import ProsePage from "@/components/ui/ProsePage";
import { whatsappCopy as copy } from "@/lib/content/whatsapp";
import { pageMetadata } from "@/lib/metadata";
import WaitingRoomDown from "./_components/WaitingRoomDown";

export const metadata: Metadata = pageMetadata({
  title: copy.title,
  description: copy.body,
  path: "/whatsapp",
});

/** Where every button for the WhatsApp community leads. */
export default function WhatsAppPage() {
  return (
    <ProsePage>
      <WaitingRoomDown />
    </ProsePage>
  );
}
