"use client";

// MessageCopyView's example, which logs what's done with a reply (MessageCopyView.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import MessageCopyView from "./MessageCopyView";
import { sent } from "./AnswerableReply.gallery.client";
import type { BroadcastAnswer, ReactionResult } from "@/lib/broadcasts/answers.server";
import type { BroadcastReply } from "@/lib/broadcasts/replies.server";
import {
  exampleBroadcastAnswers,
  exampleBroadcastReplies,
  exampleMessageCopy,
  exampleTextAnswers,
  exampleTextKinds,
  exampleTextReactions,
  exampleTextReplies,
  exampleTextReplyPastDay,
} from "./BroadcastWriter.examples";

/** The answer to Jane's question, written in hello@'s Gmail rather than on the site. */
const exampleGmailAnswers: BroadcastAnswer[] = exampleBroadcastAnswers.map((answer) => ({
  ...answer,
  sentBy: "hello@pauseai.uk",
  fromGmail: true,
}));

/** A reply to a text more than 30 days old, which WhatsApp takes no emoji on either. */
const exampleTextReplyPastMonth: BroadcastReply = { ...exampleTextReplyPastDay, id: 14, reactable: false };

/**
 * Thread: a text as the conversation, or an email as the thread, with
 * `replies` under it: for an email, one to look at, one dealt with, one
 * answered, and an automatic one; for a text, one answered, one to look at,
 * and, `pastDay`, one too old for WhatsApp to take an answer to; or, `kinds`,
 * a text's replies that are more than words, after the one answered:
 * reactions, a photo, a place, a voice note. `reacted`, Jo's emoji on
 * their thanks, which settled it, and one too old for an emoji; `gmail`, an
 * email's answer written in hello@'s Gmail.
 */
export function MessageCopyViewExample({
  email = false,
  replies = false,
  pastDay = false,
  kinds = false,
  reacted = false,
  gmail = false,
}: {
  email?: boolean;
  replies?: boolean;
  pastDay?: boolean;
  kinds?: boolean;
  reacted?: boolean;
  gmail?: boolean;
}) {
  const thanks = reacted
    ? [
        {
          ...exampleTextReplies[1],
          outcome: "answered" as const,
          dealtBy: "jo@pauseai.uk",
          dealtAt: new Date("2026-11-07T08:21:00Z"),
        },
      ]
    : [exampleTextReplies[1]];
  const text = {
    ...exampleMessageCopy,
    replies: kinds
      ? [exampleTextReplies[0], ...exampleTextKinds]
      : replies || reacted
        ? [
            exampleTextReplies[0],
            ...thanks,
            ...(pastDay ? [exampleTextReplyPastDay] : []),
            ...(reacted ? [exampleTextReplyPastMonth] : []),
          ]
        : [],
    answers: replies || kinds || reacted ? exampleTextAnswers : [],
    reactions: reacted ? exampleTextReactions : [],
  };
  const one = email
    ? {
        ...exampleMessageCopy,
        channel: "email" as const,
        subject: "Thank you for marching",
        sentFrom: "hello@pauseai.uk",
        address: "jane@example.com",
        readAt: null,
        topics: ["newsletter" as const],
        replies: replies ? exampleBroadcastReplies : [],
        answers: replies ? (gmail ? exampleGmailAnswers : exampleBroadcastAnswers) : [],
      }
    : text;
  return (
    <Logged>
      {(log) => <MessageCopyView one={one} actions={{ deal: log("deal"), answer: sent(log), react: reactedTo(log) }} />}
    </Logged>
  );
}

/** An emoji put on a reply, logged, which always goes. */
export const reactedTo =
  (log: (name: string) => (...args: unknown[]) => void) =>
  async (replyId: number, emoji: string): Promise<ReactionResult> => {
    log("react")(replyId, emoji);
    return { sent: true };
  };
