import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import type { MailingGroup } from "@/lib/mailing-groups";
import type { BroadcastSummary } from "@/lib/server/broadcast-pages";
import { textSender } from "@/lib/broadcasts";
import MailingsOverview, { type OverviewLook } from "./MailingsOverview";
import { BroadcastChannelName, broadcastCounts } from "./BroadcastView";

const copy = staffCopy.broadcastPages;

const LOOK: OverviewLook<BroadcastSummary> = {
  base: "/staff/broadcasts",
  counts: broadcastCounts,
  untitled: copy.untitled,
  none: copy.none,
  lead: (broadcast) => <BroadcastChannelName channel={broadcast.channel} />,
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
