"use client";

// MailingReplyThread's examples, which log what's pressed (MailingReplyThread.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import type { LetterThread } from "@/lib/letters/threads.server";
import { exampleThread } from "../letters/LetterThread.examples";
import { sent } from "./AnswerableReply.gallery.client";
import MailingReplyThread from "./MailingReplyThread";

/** Polly's reply to Jo's letter, waiting for staff, with nothing of ours after it. */
export const exampleWaitingThread: LetterThread = { ...exampleThread, messages: exampleThread.messages.slice(0, 1) };

/**
 * Polly's reply and Jo's answer sent from the page, then Polly's second
 * reply, which Sam marked as needing nothing.
 */
export const exampleDealtThread: LetterThread = {
  ...exampleThread,
  messages: [
    exampleThread.messages[0],
    {
      ...exampleThread.messages[1],
      text: "Dear Polly,\n\nWonderful. Does Tuesday suit?\n\nJo",
      sentBy: "jo@pauseai.uk",
    },
    {
      ...exampleThread.messages[0],
      id: 3,
      at: new Date("2026-10-11T09:00:00Z"),
      text: "Tuesday is fine.\n\nPolly",
      quoted: "",
      dealtBy: "sam@pauseai.uk",
      dealtAt: new Date("2026-10-11T10:00:00Z"),
    },
  ],
};

/**
 * A mailing's letter's thread: with a reply waiting, which the staff member
 * can answer from its mailbox (`canAnswer`), or not; or with none waiting
 * (`dealt`), each message saying who dealt with it.
 */
export function MailingReplyThreadExample({
  canAnswer = true,
  dealt = false,
}: {
  canAnswer?: boolean;
  dealt?: boolean;
}) {
  return (
    <Logged>
      {(log) => (
        <MailingReplyThread
          thread={dealt ? exampleDealtThread : exampleWaitingThread}
          waiting={dealt ? null : { id: 1, account: "jo@pauseai.uk" }}
          canAnswer={canAnswer}
          deal={(form) => {
            log("deal")(form);
            return Promise.resolve({ ok: true });
          }}
          answer={sent(log)}
        />
      )}
    </Logged>
  );
}
