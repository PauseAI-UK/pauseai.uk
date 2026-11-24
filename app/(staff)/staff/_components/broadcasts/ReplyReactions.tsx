"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import IconButton from "@/components/ui/IconButton";
import { useSave } from "@/components/ui/useSave";
import type { BroadcastReaction, ReactionResult } from "@/lib/broadcasts/answers.server";
import { REACTIONS } from "@/lib/broadcasts/broadcasts";
import { staffMemberText } from "@/lib/staff-member";
import { staffTime } from "@/lib/staff-time";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { ChatBubble, ChatWall } from "./TextBubble";
import chat from "./Broadcasts.module.css";
import styles from "./ReplyActions.module.css";
import answers from "../mailings/AnswerableReply.module.css";

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
 * place; while one is on its way they're faint, and one that didn't go
 * says so under the message. Who put ours there and when is in the reply's
 * foot (OurReaction).
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
  // Whether WhatsApp refused the last one pressed; `broke`, whether sending it threw.
  const [refused, setRefused] = useState(false);
  const [send, pending, broke] = useSave(react!, {
    done: (result) => {
      setRefused(!result.sent);
      if (result.sent) setOpen(false);
    },
  });
  const failed = refused || broke;
  const standing = standingOf(reactions);
  // Ours pressed again takes it away; another puts it in place of ours.
  const press = (pressed: string) => {
    setRefused(false);
    send(replyId, pressed === standing?.emoji ? "" : pressed);
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
    <ChatWall>
      <ChatBubble who={who} when={when} beside={smiley} badge={standing?.emoji}>
        {children}
      </ChatBubble>
      {failed && <p className={answers.problem}>{copy.reactionNotSent}</p>}
    </ChatWall>
  );
}

/** The emoji of ours on a reply, of `reactions` the ones we put on it: the latest we didn't take away; undefined for none. */
export const standingOf = (reactions: BroadcastReaction[]) => reactions.findLast((reaction) => !reaction.removedAt);

/**
 * Under someone's message, as what it was recorded as is: who put our
 * emoji on it and when, and, on a line under, that WhatsApp couldn't deliver
 * it, if it said so.
 */
export function OurReaction({ reaction, className }: { reaction: BroadcastReaction; className: string }) {
  const failure = reaction.events.find((event) => event.kind === "failed");
  return (
    <p className={className}>
      {copy.reactedBy(reaction.emoji, staffMemberText(reaction.sentBy), staffTime(reaction.sentAt))}
      {failure && (
        <>
          <br />
          <span>{copy.undelivered(failure.details.title as string | null)}</span>
        </>
      )}
    </p>
  );
}
