"use client";

// AnswerableReply's example, which logs the answer sent (AnswerableReply.gallery.tsx), and the answer MessageCopyView's uses.
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import ThreadEmail from "../letters/ThreadEmail";
import AnswerableReply, { type AnswerAction } from "./AnswerableReply";
import { ReplyButton } from "./ReplyActions";

/** An answer that logs what it'd send, and goes. */
export const sent =
  (log: (name: string) => (...args: unknown[]) => void): AnswerAction =>
  async (...args) => {
    log("answer")(...args);
    return { sent: true };
  };

/** A reply in the thread with its Reply button, and its answer opened, being written. */
export function AnswerableReplyExample({ opened = false }: { opened?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <AnswerableReply
          replyId={1}
          from="PauseAI UK <hello@pauseai.uk>"
          to="jane@example.com"
          subject="Re: Thank you for marching"
          answer={sent(log)}
          opened={opened}
        >
          {(write) => (
            <ThreadEmail
              from="jane@example.com"
              to="PauseAI UK <hello@pauseai.uk>"
              at={new Date("2026-11-07T09:30:00Z")}
              subject="Re: Thank you for marching"
            >
              <p>Could you take me off this list please?</p>
              {write && <ReplyButton write={write} />}
            </ThreadEmail>
          )}
        </AnswerableReply>
      )}
    </Logged>
  );
}
