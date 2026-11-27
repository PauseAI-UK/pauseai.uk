import type { Metadata } from "next";
import ProsePage from "@/components/ui/ProsePage";
import { waitingRoomJoinCopy as copy } from "@/lib/content/whatsapp";
import { pageMetadata } from "@/lib/metadata";
import { config } from "@/lib/server/config.server";
import WaitingRoomJoin from "./_components/WaitingRoomJoin";

export const metadata: Metadata = {
  ...pageMetadata({ title: copy.title, description: copy.description, path: "/whatsapp/beta" }),
  // Linked from nowhere while it's tried: not for search engines either.
  robots: { index: false, follow: false },
};

/** Joining the WhatsApp community through its waiting room: a chat with our number. */
export default function WaitingRoomPage() {
  return (
    <ProsePage>
      <WaitingRoomJoin turnstileSiteKey={config.turnstileSiteKey} />
    </ProsePage>
  );
}
