import { staffCopy } from "@/lib/content/staff-interface";
import type { MailingGroup } from "@/lib/mailing-groups";
import type { BroadcastSummary } from "@/lib/server/broadcast-pages";
import { textSender } from "@/lib/broadcasts";
import MailingsOverview, { type OverviewLook, type Sentence } from "./MailingsOverview";
import { BroadcastChannelMark, broadcastCounts } from "./BroadcastView";

const copy = staffCopy.broadcastPages;

const words = copy.standing;

/**
 * Where a broadcast stands, where it has more to say than a mailing: its
 * words with WhatsApp, or rejected by it; stopped by itself, and why, and
 * how many of how many went.
 */
function sentence(b: BroadcastSummary): Sentence | undefined {
  if (b.state === "draft" && b.rejected) return { tone: "red", text: words.rejected };
  if (b.state === "draft" && b.waiting) return { tone: "blue", text: words.waiting };
  if (b.state === "cancelled" && b.gaveUp) return { tone: "red", text: words.gaveUp[b.waitReason!]!(b.sent, b.to) };
  return undefined;
}

const LOOK: OverviewLook<BroadcastSummary> = {
  base: "/staff/broadcasts",
  counts: broadcastCounts,
  sentence,
  untitled: copy.untitled,
  none: copy.none,
  mark: (broadcast) => <BroadcastChannelMark channel={broadcast.channel} />,
  // The channel's word alone, as the mark beside it is its picture.
  lead: (broadcast) => copy.channels[broadcast.channel],
  // A text's number, which isn't an address to put in <>.
  from: (broadcast) =>
    broadcast.channel === "text" ? textSender(broadcast.fromName!, broadcast.sentFrom!) : undefined,
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
