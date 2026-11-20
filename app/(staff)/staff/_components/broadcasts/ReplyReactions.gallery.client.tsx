"use client";

// ReplyReactions' examples, which log what's pressed (ReplyReactions.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import ReplyReactions, { OurReaction, standingOf } from "./ReplyReactions";
import { exampleTextReactions, exampleUndeliveredReaction } from "./BroadcastWriter.examples";

/**
 * Jane's thanks, with the smiley beside it: no emoji of ours yet;
 * `reacted`, Jo's 👍, put in place of a ❤️; `undelivered`, a 🙏 WhatsApp
 * couldn't deliver; `refused`, WhatsApp refusing each press; `tooOld`, a
 * message too old for another, or not her latest.
 */
export function ReplyReactionsExample({
  reacted = false,
  undelivered = false,
  refused = false,
  tooOld = false,
}: {
  reacted?: boolean;
  undelivered?: boolean;
  refused?: boolean;
  tooOld?: boolean;
}) {
  const reactions = undelivered ? [exampleUndeliveredReaction] : reacted ? exampleTextReactions : [];
  const ours = standingOf(reactions);
  return (
    <Logged>
      {(log) => (
        <>
          <ReplyReactions
            replyId={12}
            who="Jane Example"
            when="7 Nov 2026, 08:00"
            reactions={reactions}
            reactable={!tooOld}
            react={async (replyId, emoji) => {
              log("react")(replyId, emoji);
              return refused ? { sent: false, reason: "failed" } : { sent: true };
            }}
          >
            <p>Great, thanks!</p>
          </ReplyReactions>
          {/* The line the reply's foot has for ours. */}
          {ours && <OurReaction reaction={ours} className="" />}
        </>
      )}
    </Logged>
  );
}
