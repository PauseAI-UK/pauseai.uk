"use client";

// A mailing's letter's thread on its page, on the client, as what opens an
// answer (AnswerableReply's) is a function its Reply button is given.
import type { ReactNode } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Muted } from "@/components/ui/Text";
import { named } from "@/lib/email-parsing/addresses";
import type { FormResult } from "@/lib/form-result";
import type { LetterThread as Thread, ThreadMessage } from "@/lib/letters/threads.server";
import { staffTime } from "@/lib/staff-time";
import AnswerableReply, { ReplyButton, type AnswerAction } from "./AnswerableReply";
import { MailingLetter } from "./MailingLetter";
import LetterThread from "../letters/LetterThread";
import { Refusal, ResultForm } from "../ui/ResultForm";
import styles from "./AnswerableReply.module.css";
import { mailingsCopy } from "./copy";
import { StaffSentence } from "../ui/StaffMember";
import { SetAnswer, type SetStatus } from "../politicians/AskRow";
import { answeredByHand } from "@/lib/asks/asks";
import type { Ask } from "@/lib/asks/records.server";
import type { Politician } from "@/lib/politicians/records.server";

const copy = mailingsCopy.answers;

/** The reply waiting for staff, the latest of the politician's side's, with the mailbox it came to. */
export type WaitingReply = { id: number; account: string };

/**
 * One of a mailing's letters' thread (LetterThread), each message saying
 * who dealt with it: who said a reply needed nothing, and who sent our
 * answer from this page. Under the reply waiting for staff (`waiting`),
 * if any: Reply, which opens an answer at the foot of the thread, from the
 * mailbox it came to, as the letter's From name; or, if the staff member
 * can't answer from that mailbox (`canAnswer`), whose mailbox it came to,
 * as only they can. Beside either, Set answer, for the answer to the
 * mailing's ask (`asked`) where staff record it, and Nothing to do
 * (`deal`); a reply someone
 * else has dealt with since is said at the page's top.
 */
export default function MailingReplyThread({
  thread,
  link,
  waiting,
  canAnswer,
  asked,
  deal,
  answer,
}: {
  thread: Thread;
  link?: ReactNode;
  waiting: WaitingReply | null;
  canAnswer: boolean;
  /** The politician, the mailing's ask, if it makes one, and what sets their answer to it, among the reply's buttons. */
  asked?: { politician: Politician; ask: Ask | undefined; setStatus: SetStatus };
  deal: (form: FormData) => Promise<FormResult<"gone">>;
  answer: AnswerAction;
}) {
  const reply = waiting && thread.messages.find((message) => message.id === waiting.id);
  // Set answer, for an ask staff record, plainer beside Reply.
  const setAnswer = asked?.ask && answeredByHand(asked.ask.slug) && (
    <SetAnswer
      politician={asked.politician}
      ask={asked.ask}
      setStatus={asked.setStatus}
      look={canAnswer ? "ghost" : "primary"}
    />
  );

  const foot = (write?: () => void) =>
    function Foot(message: ThreadMessage) {
      return (
        <>
          {message.dealtBy && (
            <p className={styles.dealt}>
              <StaffSentence
                words={(who) => copy.nothingDone(who, staffTime(message.dealtAt!))}
                email={message.dealtBy}
              />
            </p>
          )}
          {message.sentBy && (
            <p className={styles.dealt}>
              <StaffSentence words={copy.sentBy} email={message.sentBy} />
            </p>
          )}
          {message === reply && (
            <div className={`${styles.actions} ${styles.buttons}`}>
              {canAnswer ? (
                write && <ReplyButton write={write} />
              ) : (
                <Muted>{copy.answerElsewhere(waiting!.account)}</Muted>
              )}
              {setAnswer}
              <ResultForm action={deal} says={mailingsCopy.refusals.nothingToDo} atTop={["gone"]}>
                <input type="hidden" name="replyId" value={message.id} />
                <SubmitButton variant="ghost" size="small" fit>
                  {copy.nothing}
                </SubmitButton>
                <Refusal />
              </ResultForm>
            </div>
          )}
        </>
      );
    };

  const shown = (write?: () => void) => (
    <LetterThread thread={thread} link={link} showLetter={(doc) => <MailingLetter doc={doc} />} foot={foot(write)} />
  );

  if (!reply || !canAnswer) return shown();
  return (
    <AnswerableReply
      replyId={reply.id}
      from={named(thread.fromName, waiting.account)}
      to={named(reply.fromName, reply.fromAddress)}
      subject={reply.subject}
      answer={answer}
    >
      {shown}
    </AnswerableReply>
  );
}
