import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { PartMark } from "../mailings/PartBox";

/** A fork: one line that becomes two. */
function ForkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12h6" />
      <path d="M9 12c5 0 4-6 12-6" />
      <path d="M9 12c5 0 4 6 12 6" />
    </svg>
  );
}

/**
 * Marks a WhatsApp template that has two variants, beside its name: in the
 * Template dropdown, and on the Broadcasts list beside a broadcast on one.
 * Who each variant is for shows when the mouse is over it, from who the
 * conditional one is for (`who`).
 */
export default function TwoVariants({ who }: { who: string }) {
  return (
    <PartMark icon={<ForkIcon />} title={broadcastsCopy.broadcastPages.twoVariantsFor(who)}>
      {broadcastsCopy.broadcastPages.twoVariants}
    </PartMark>
  );
}
