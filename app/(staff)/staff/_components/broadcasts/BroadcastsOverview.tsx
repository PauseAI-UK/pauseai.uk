import type { MailingGroup } from "@/lib/mailings/groups";
import type { BroadcastSummary } from "@/lib/broadcasts/pages.server";
import { textSender } from "@/lib/broadcasts/broadcasts";
import MailingsOverview, { type OverviewLook, type Sentence } from "../mailings/MailingsOverview";
import { BroadcastChannelMark, broadcastCounts, pauseInBrief } from "./BroadcastView";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

const copy = broadcastsCopy.broadcastPages;

const words = copy.standing;

/**
 * Where a broadcast stands, where it has more to say than a mailing: its
 * template with WhatsApp, a draft's or one scheduled's, before its time or
 * after; approved by it, or rejected; stopped by itself, and why, and
 * how many of how many went; or sending with nothing going out for now,
 * which its bar says in place of that it's sending.
 */
function sentence(b: BroadcastSummary): Sentence | undefined {
  if (b.state === "sending" && b.pause) return { tone: "grey", text: copy.paused.bar(b.sent + b.failed, b.to) };
  if (b.state === "draft" && b.rejected) return { tone: "red", text: words.rejected };
  if ((b.state === "draft" || b.state === "scheduled") && b.waiting) return { tone: "blue", text: words.waiting };
  if (b.state === "draft" && b.approved) return { tone: "green", text: words.approved(b.to) };
  if (b.state === "cancelled" && b.gaveUp) return { tone: "red", text: words.gaveUp[b.waitReason!]!(b.sent, b.to) };
  return undefined;
}

const LOOK: OverviewLook<BroadcastSummary> = {
  base: "/staff/broadcasts",
  counts: broadcastCounts,
  sentence,
  // Waiting for WhatsApp's approval, its sentence says so, as it does before its time.
  paused: (broadcast) =>
    broadcast.pause && !(broadcast.pause.kind === "waiting" && broadcast.pause.reason === "approval")
      ? pauseInBrief(broadcast.pause)
      : undefined,
  // One stopped didn't reach those it never sent to, which isn't fine, as it is for those who'd opted out.
  notFine: (broadcast) => (broadcast.state === "cancelled" ? ["not-sent"] : []),
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
