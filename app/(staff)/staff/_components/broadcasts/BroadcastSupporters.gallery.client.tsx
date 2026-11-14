"use client";

// BroadcastSupporters' examples (BroadcastSupporters.gallery.tsx).
import { supportersSearch } from "@/lib/staff-search";
import { ChoosingBroadcastFrame, BroadcastSupporters } from "./BroadcastSupporters";
import { nothing } from "./BroadcastView.gallery.client";

const yes = supportersSearch({ contact: "email:newsletter:yes", near: "LS1" });

/** Broadcast to N supporters, with a Consent filter answered yes. */
export function BroadcastSupportersExample() {
  return (
    <>
      <BroadcastSupporters search={yes} total={430} action={nothing} />
    </>
  );
}

/** The list choosing who a draft goes to. */
export function ChoosingBroadcastFrameExample() {
  return (
    <ChoosingBroadcastFrame
      choosing={{ id: 3, title: "Events near you", channel: "email", topics: ["newsletter"], blank: false }}
      search={yes}
      total={430}
      keep={nothing}
    >
      <p>The list.</p>
    </ChoosingBroadcastFrame>
  );
}
