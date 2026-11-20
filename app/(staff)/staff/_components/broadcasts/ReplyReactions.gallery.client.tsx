"use client";

// ReplyReactions' examples, which log what's pressed (ReplyReactions.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import ReplyReactions from "./ReplyReactions";
import { exampleTextReactions, exampleUndeliveredReaction } from "./BroadcastWriter.examples";

/**
 * The emoji under Jane's thanks: none of ours yet; `reacted`, Jo's 👍, put
 * in place of a ❤️; `undelivered`, a 🙏 WhatsApp couldn't deliver;
 * `refused`, WhatsApp refusing each press; `tooOld`, a message too old for
 * another.
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
  return (
    <Logged>
      {(log) => (
        <ReplyReactions
          replyId={12}
          reactions={reactions}
          reactable={!tooOld}
          react={async (replyId, emoji) => {
            log("react")(replyId, emoji);
            return refused ? { sent: false, reason: "failed" } : { sent: true };
          }}
        />
      )}
    </Logged>
  );
}
