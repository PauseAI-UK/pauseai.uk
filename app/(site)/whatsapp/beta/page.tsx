import type { Metadata } from "next";
import ProsePage from "@/components/ui/ProsePage";
import { waitingRoomJoinCopy as copy } from "@/lib/content/whatsapp";
import { pageMetadata } from "@/lib/metadata";
import { config } from "@/lib/server/config.server";
import { connection } from "next/server";
import { joiningNumber } from "@/lib/broadcasts/waiting-room.server";
import WaitingRoomJoin from "./_components/WaitingRoomJoin";

export const metadata: Metadata = {
  ...pageMetadata({ title: copy.title, description: copy.description, path: "/whatsapp/beta" }),
  // Linked from nowhere while it's tried: not for search engines either.
  robots: { index: false, follow: false },
};

/** Joining the WhatsApp community through its waiting room: a chat with our number, or that it's closed. */
export default async function WaitingRoomPage() {
  await connection();
  return (
    <ProsePage>
      <WaitingRoomJoin open={Boolean(await joiningNumber())} turnstileSiteKey={config.turnstileSiteKey} />
    </ProsePage>
  );
}
