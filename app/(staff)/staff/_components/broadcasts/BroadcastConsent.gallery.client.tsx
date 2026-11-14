"use client";

// BroadcastConsent's example, which logs what's picked (BroadcastConsent.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import BroadcastConsent from "./BroadcastConsent";

/** The Consent: neither channel chosen yet, as on New broadcast; texts chosen, their topics to pick; and one with words of its own, so only by its channel. */
export function BroadcastConsentExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <BroadcastConsent
            value=""
            channel="email"
            written={false}
            pending={false}
            pick={log("pick")}
            shown=""
            show={log("show")}
          />
          <BroadcastConsent
            value=""
            channel="email"
            written={false}
            pending={false}
            pick={log("pick")}
            shown="phone"
            show={log("show")}
          />
          <BroadcastConsent
            value="email:newsletter:yes"
            channel="email"
            written
            pending={false}
            pick={log("pick")}
            shown="email"
            show={log("show")}
          />
        </>
      )}
    </Logged>
  );
}
