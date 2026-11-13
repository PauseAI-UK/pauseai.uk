import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import type { MailingGroup } from "@/lib/mailing-groups";
import type { BroadcastSummary } from "@/lib/server/broadcast-pages";
import { textSender } from "@/lib/broadcasts";
import MailingsOverview, { type OverviewLook } from "./MailingsOverview";
import { BroadcastChannelMark, broadcastCounts } from "./BroadcastView";

const copy = staffCopy.broadcastPages;

const LOOK: OverviewLook<BroadcastSummary> = {
  base: "/staff/broadcasts",
  // Only those it has: all nine don't fit a row. Its page has every one, lined up.
  counts: (broadcast) => broadcastCounts(broadcast).filter((count) => count.n),
  whileSending: ["look", "opted-out", "error", "unreached"],
  untitled: copy.untitled,
  none: copy.none,
  mark: (broadcast) => <BroadcastChannelMark channel={broadcast.channel} />,
  // The channel's word alone, as the mark beside it is its picture.
  lead: (broadcast) => copy.channels[broadcast.channel],
  // A text's number, which isn't an address to put in <>.
  from: (broadcast) =>
    broadcast.channel === "text" ? textSender(broadcast.fromName!, broadcast.sentFrom!) : undefined,
  // What WhatsApp is doing with a draft's new words: reviewing them, or rejected them.
  holdUp: (broadcast) =>
    broadcast.waiting ? (
      <Tag tone="amber">{copy.waitingTag}</Tag>
    ) : (
      broadcast.rejected && <Tag tone="red">{copy.rejectedTag}</Tag>
    ),
};

/**
 * The list of broadcasts, emails and texts together, as the list of mailings is, each row with its channel;
 * `pulse`, the one whose words were just sent for approval, drawing the eye.
 */
export default function BroadcastsOverview({
  groups,
  now,
  pulse,
}: {
  groups: MailingGroup<BroadcastSummary>[];
  now: string;
  pulse?: number;
}) {
  return <MailingsOverview groups={groups} now={now} look={LOOK} pulse={pulse} />;
}
