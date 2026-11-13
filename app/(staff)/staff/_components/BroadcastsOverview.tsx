import { staffCopy } from "@/lib/content/staff-interface";
import type { MailingGroup } from "@/lib/mailing-groups";
import type { BroadcastSummary } from "@/lib/server/broadcast-pages";
import { textSender } from "@/lib/broadcasts";
import MailingsOverview, { type OverviewLook } from "./MailingsOverview";
import { BroadcastChannelMark, broadcastCounts } from "./BroadcastView";
import { NeedsAndFine } from "./CopyCounts";
import { countsOpening } from "./ui/Counts";
import Progress from "./ui/Progress";
import StaffLink from "./ui/StaffLink";
import styles from "./BroadcastsOverview.module.css";

const copy = staffCopy.broadcastPages;

const words = copy.standing;

/**
 * Where one stands, as a sentence after a dot in its colour, red for
 * something wrong, blue for going out or waiting on WhatsApp, grey for
 * normal: a draft, its words with WhatsApp or rejected by it, scheduled,
 * sending, stopped by us or by itself and why, sent; and how many of how
 * many went, where some did.
 */
function sentence(b: BroadcastSummary): { tone: "red" | "blue" | "grey"; text: string } {
  if (b.state === "draft") {
    if (b.rejected) return { tone: "red", text: words.rejected };
    if (b.waiting) return { tone: "blue", text: words.waiting };
    return { tone: "grey", text: words.draft(b.to) };
  }
  if (b.state === "scheduled") return { tone: "blue", text: words.scheduled(b.to) };
  if (b.state === "sending") return { tone: "blue", text: staffCopy.mailingPages.sendingBar(b.sent, b.to) };
  if (b.state === "cancelled") {
    return b.gaveUp
      ? { tone: "red", text: words.gaveUp[b.waitReason!]!(b.sent, b.to) }
      : { tone: "grey", text: words.stopped(b.sent, b.to) };
  }
  return { tone: "grey", text: words.sent(b.to) };
}

/**
 * How one stands at its row's right: its sentence after its dot; while
 * sending, the sentence to the left of the bar of how far it's got, no dot,
 * as the bar says it; and once any went, what needs a look, the rest folded
 * behind how many are fine.
 */
function BroadcastStanding({ broadcast, href }: { broadcast: BroadcastSummary; href: string }) {
  const { tone, text } = sentence(broadcast);
  return (
    <span className={styles.standing}>
      {broadcast.state === "sending" ? (
        <StaffLink href={href} className={styles.bar}>
          <Progress
            value={broadcast.sent + broadcast.failed}
            max={broadcast.to}
            tone="blue"
            label={staffCopy.mailingPages.sentLabel}
          >
            <span className={styles.sentence}>{text}</span>
          </Progress>
        </StaffLink>
      ) : (
        <span className={styles.sentence}>
          <i className={styles.dot} data-tone={tone} aria-hidden="true" />
          {text}
        </span>
      )}
      {!["draft", "scheduled"].includes(broadcast.state) && (
        <NeedsAndFine counts={countsOpening(href, broadcastCounts(broadcast))} />
      )}
    </span>
  );
}

const LOOK: OverviewLook<BroadcastSummary> = {
  base: "/staff/broadcasts",
  counts: broadcastCounts,
  standing: (broadcast, href) => <BroadcastStanding broadcast={broadcast} href={href} />,
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
