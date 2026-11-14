"use client";

// BroadcastFor's example (BroadcastFor.gallery.tsx).
import BroadcastFor from "./BroadcastFor";
import { exampleBroadcastSent } from "./BroadcastWriter.examples";
import { broadcastActions } from "./BroadcastWriter.gallery.client";
import { nothing } from "./BroadcastView.gallery.client";

/** A broadcast's page, as it stands: here, sent. */
export function BroadcastForExample() {
  return (
    <BroadcastFor
      data={exampleBroadcastSent}
      actions={{
        ...broadcastActions(() => () => {}),
        stop: nothing,
        reschedule: nothing,
        resume: nothing,
      }}
    />
  );
}
