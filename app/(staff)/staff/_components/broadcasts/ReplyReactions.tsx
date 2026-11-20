"use client";

import { useState, useTransition } from "react";
import { Toggles } from "@/components/ui/Controls";
import { Muted } from "@/components/ui/Text";
import type { BroadcastReaction, ReactionResult } from "@/lib/broadcasts/answers.server";
import { REACTIONS } from "@/lib/broadcasts/broadcasts";
import { staffMemberText } from "@/lib/staff-member";
import { staffTime } from "@/lib/staff-time";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import styles from "./ReplyActions.module.css";

const copy = broadcastsCopy.broadcastPages.replies;

/** Puts an emoji on a reply, or takes ours away (an empty one), saying whether it went. */
export type ReactAction = (replyId: number, emoji: string) => Promise<ReactionResult>;

/**
 * Under someone's message to us on WhatsApp: the emoji staff can put on it
 * (REACTIONS), ours pressed, at most one, as WhatsApp allows; pressing ours
 * takes it away, pressing another puts it in its place. Then who put ours
 * there and when, and that WhatsApp couldn't deliver it, if it said so.
 * Without `react`, or once the message is too old to take one
 * (`reactable`), only what we put there.
 */
export default function ReplyReactions({
  replyId,
  reactions,
  reactable,
  react,
}: {
  replyId: number;
  /** The emoji we put on this reply, oldest first. */
  reactions: BroadcastReaction[];
  reactable: boolean;
  react?: ReactAction;
}) {
  const [pending, startTransition] = useTransition();
  const [waiting, setWaiting] = useState<string>();
  const [failed, setFailed] = useState(false);
  const standing = reactions.findLast((reaction) => !reaction.removedAt);
  const failure = standing?.events.find((event) => event.kind === "failed");
  const press = (values: string[]) => {
    const emoji = values.find((value) => value !== standing?.emoji) ?? "";
    setWaiting(emoji || standing!.emoji);
    setFailed(false);
    startTransition(async () => {
      const result = await react!(replyId, emoji);
      setFailed(!result.sent);
    });
  };
  if (!standing && !(react && reactable)) return null;
  return (
    <div className={styles.reactions}>
      {react && reactable && (
        <Toggles
          label={copy.react}
          options={REACTIONS.map((emoji) => ({ value: emoji, label: emoji }))}
          values={standing ? [standing.emoji] : []}
          onChange={press}
          busy={pending}
          waiting={waiting}
        />
      )}
      {standing && (
        <Muted>
          {copy.ourReaction(standing.emoji, staffMemberText(standing.sentBy), staffTime(standing.sentAt))}
          {failure && (
            <>
              <br />
              <span>{copy.undelivered(failure.details.title as string | null)}</span>
            </>
          )}
        </Muted>
      )}
      {failed && <p className={styles.problem}>{copy.reactionNotSent}</p>}
    </div>
  );
}
