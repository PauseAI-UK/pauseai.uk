"use client";

// BroadcastFor's example (BroadcastFor.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import BroadcastFor from "./BroadcastFor";
import { exampleBroadcastSent } from "./BroadcastWriter.examples";
import { broadcastActions } from "./BroadcastWriter.gallery.client";
import { nothing } from "./BroadcastView.gallery.client";

/** A broadcast's page, as it stands: here, sent. */
export function BroadcastForExample() {
  return (
    <Logged>
      {(log) => (
        <BroadcastFor
          data={exampleBroadcastSent}
          actions={{ ...broadcastActions(log), stop: nothing, reschedule: nothing, resume: nothing }}
        />
      )}
    </Logged>
  );
}
