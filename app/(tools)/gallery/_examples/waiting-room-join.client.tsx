"use client";

import WaitingRoomJoin from "@/app/(site)/whatsapp/beta/_components/WaitingRoomJoin";
import { Logged } from "../_components/wiring";

/** The WhatsApp waiting room's page, with no Turnstile, its ask logged and answered with an example chat link. */
export function WaitingRoomJoinExample() {
  return (
    <Logged>
      {(log) => (
        <WaitingRoomJoin
          ask={async (token, utmSource) => {
            log("ask")({ token, utmSource });
            return { ok: true, link: "https://wa.me/447700900000?text=Hi%20(site)" };
          }}
        />
      )}
    </Logged>
  );
}
