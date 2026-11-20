"use client";

import { useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import IconButton from "@/components/ui/IconButton";
import { Muted } from "@/components/ui/Text";
import type { BroadcastReaction, ReactionResult } from "@/lib/broadcasts/answers.server";
import { REACTIONS } from "@/lib/broadcasts/broadcasts";
import { staffMemberText } from "@/lib/staff-member";
import { staffTime } from "@/lib/staff-time";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { ChatBubble, ChatWall } from "./TextBubble";
import chat from "./Broadcasts.module.css";
import styles from "./ReplyActions.module.css";

const copy = broadcastsCopy.broadcastPages.replies;

/** Puts an emoji on a reply, or takes ours away (an empty one), saying whether it went. */
export type ReactAction = (replyId: number, emoji: string) => Promise<ReactionResult>;

/** A smiley, as WhatsApp's button for a reaction, in the colour of the words around it. */
function Smiley() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 14.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2" />
      </g>
      <circle cx="9" cy="10" r="1.2" fill="currentColor" />
      <circle cx="15" cy="10" r="1.2" fill="currentColor" />
    </svg>
  );
}

/**
 * Someone's message to us on WhatsApp, as a bubble, with the emoji we put
 * on it at its foot, as WhatsApp shows one. Beside their latest, while it
 * can take one (`reactable`), a smiley, as on WhatsApp Web: it opens the
 * emoji staff can put on it (REACTIONS) to its right, or, where a long
 * message leaves no room, floating under it; ours pressed, at most one, as
 * WhatsApp allows. Pressing ours takes it away, another puts it in its
 * place; while one is on its way they're faint. Under the conversation, who
 * put ours there and when, and that WhatsApp couldn't deliver it, if it said
 * so.
 */
export default function ReplyReactions({
  replyId,
  who,
  when,
  reactions,
  reactable,
  react,
  children,
}: {
  replyId: number;
  who: string;
  when: ReactNode;
  /** The emoji we put on this reply, oldest first. */
  reactions: BroadcastReaction[];
  reactable: boolean;
  react?: ReactAction;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const standing = reactions.findLast((reaction) => !reaction.removedAt);
  const failure = standing?.events.find((event) => event.kind === "failed");
  // Ours pressed again takes it away; another puts it in place of ours.
  const press = (pressed: string) => {
    const emoji = pressed === standing?.emoji ? "" : pressed;
    setFailed(false);
    startTransition(async () => {
      const result = await react!(replyId, emoji);
      setFailed(!result.sent);
      if (result.sent) setOpen(false);
    });
  };
  // Opened, the emoji go to the smiley's right if they fit in the conversation, or else float under it.
  const tray = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<"right" | "under">("right");
  useLayoutEffect(() => {
    if (!open) return;
    const wall = tray.current!.closest(`.${chat.wall}`)!;
    if (tray.current!.getBoundingClientRect().right > wall.getBoundingClientRect().right) setPlace("under");
  }, [open]);
  // Each opening looks for room afresh, to the right first.
  const toggle = () => {
    setPlace("right");
    setOpen(!open);
  };
  const offered = Boolean(react && reactable);
  const smiley = offered ? (
    <span className={styles.picker}>
      <IconButton look="outline" size={28} aria-label={copy.react} aria-expanded={open} onClick={toggle}>
        <Smiley />
      </IconButton>
      {open && (
        <span
          ref={tray}
          role="group"
          aria-label={copy.react}
          aria-busy={pending || undefined}
          data-place={place}
          className={styles.tray}
        >
          {REACTIONS.map((emoji) => (
            <button key={emoji} type="button" aria-pressed={emoji === standing?.emoji} onClick={() => press(emoji)}>
              {emoji}
            </button>
          ))}
        </span>
      )}
    </span>
  ) : undefined;
  return (
    <>
      <ChatWall>
        <ChatBubble who={who} when={when} beside={smiley} badge={standing?.emoji}>
          {children}
        </ChatBubble>
      </ChatWall>
      {(standing || failed) && (
        <div className={styles.reactions}>
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
      )}
    </>
  );
}
