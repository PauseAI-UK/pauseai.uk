"use client";

// MessageCopyView's example, which logs what's done with a reply (MessageCopyView.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import MessageCopyView from "./MessageCopyView";
import { sent } from "./AnswerableReply.gallery.client";
import {
  exampleBroadcastAnswers,
  exampleBroadcastReplies,
  exampleMessageCopy,
  exampleTextAnswers,
  exampleTextKinds,
  exampleTextReplies,
  exampleTextReplyPastDay,
} from "./BroadcastWriter.examples";

/**
 * Thread: a text as the conversation, or an email as the thread, with
 * `replies` under it: for an email, one to look at, one dealt with, one
 * answered, and an automatic one; for a text, one answered, one to look at,
 * and, `pastDay`, one too old for WhatsApp to take an answer to; or, `kinds`,
 * a text's replies that are more than words, after the one answered:
 * reactions, a photo, a place, a voice note.
 */
export function MessageCopyViewExample({
  email = false,
  replies = false,
  pastDay = false,
  kinds = false,
}: {
  email?: boolean;
  replies?: boolean;
  pastDay?: boolean;
  kinds?: boolean;
}) {
  const text = {
    ...exampleMessageCopy,
    replies: kinds
      ? [exampleTextReplies[0], ...exampleTextKinds]
      : replies
        ? [...exampleTextReplies, ...(pastDay ? [exampleTextReplyPastDay] : [])]
        : [],
    answers: replies || kinds ? exampleTextAnswers : [],
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
        answers: replies ? exampleBroadcastAnswers : [],
      }
    : text;
  return <Logged>{(log) => <MessageCopyView one={one} actions={{ deal: log("deal"), answer: sent(log) }} />}</Logged>;
}
