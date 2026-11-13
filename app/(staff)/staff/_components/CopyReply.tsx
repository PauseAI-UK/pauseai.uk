"use client";

// A reply in a copy's thread (MessageCopyView), on the client, as what opens
// its answer (AnswerableReply's) is a function its buttons are given.
import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import { named } from "@/lib/email-parsing/addresses";
import { answerSubject } from "@/lib/email-parsing/subjects";
import type { BroadcastAnswer } from "@/lib/server/broadcast-answers";
import type { MessageCopy } from "@/lib/server/broadcast-pages";
import type { BroadcastReply } from "@/lib/server/broadcast-replies";
import { staffTime } from "@/lib/staff-time";
import AnswerableReply, { type AnswerAction } from "./AnswerableReply";
import { MailingLetter } from "./MailingLetter";
import ReplyActions, { ReplyButton } from "./ReplyActions";
import ThreadEmail from "./ThreadEmail";
import styles from "./MessageCopyView.module.css";

const copy = staffCopy.broadcastPages;

/** Who a reply is from: their name as their copy had it, when it's from the address the copy went to. */
const sender = (reply: BroadcastReply, one: MessageCopy) =>
  named(reply.from === one.address ? one.name : null, reply.from);

/** Our answer to a reply, in the thread after it: who sent it, or that it may not have gone. */
function Answer({ answer, reply, one }: { answer: BroadcastAnswer; reply: BroadcastReply; one: MessageCopy }) {
  return (
    <ThreadEmail
      from={named(one.fromName, one.sentFrom)}
      to={sender(reply, one)}
      at={answer.sentAt}
      subject={answerSubject(reply.subject)}
    >
      <MailingLetter doc={answer.body} />
      <p className={styles.dealt}>
        {answer.sentAt ? copy.replies.sentBy(answer.sentBy) : copy.replies.stillSending(one.sentFrom)}
      </p>
    </ThreadEmail>
  );
}

/**
 * A reply under our email, as it came; then what to record it as, or what
 * was, but nothing for an automatic one; then our answers to it, and one to
 * write (`answer`), but to an automatic reply.
 */
export default function Reply({
  reply,
  one,
  actions,
}: {
  reply: BroadcastReply;
  one: MessageCopy;
  actions?: ReplyHandlers;
}) {
  const when = reply.dealtAt && staffTime(reply.dealtAt);
  const ours = named(one.fromName, one.sentFrom);
  // Reply, while its answer isn't open: in its buttons, or under what it was recorded as.
  const email = (write?: () => void) => (
    <ThreadEmail from={sender(reply, one)} to={ours} at={reply.receivedAt} subject={reply.subject}>
      {reply.text ? <p className={styles.text}>{reply.text}</p> : <Muted>{copy.replies.noText}</Muted>}
      {reply.automatic ? null : reply.outcome && reply.outcome !== "answered" ? (
        <>
          <p className={styles.dealt}>
            {(reply.outcome === "opted-out" ? copy.replies.optedOut : copy.replies.nothingDone)(reply.dealtBy!, when!)}
          </p>
          {write && (
            <p className={styles.write}>
              <ReplyButton write={write} />
            </p>
          )}
        </>
      ) : (
        actions && (
          <ReplyActions
            replyId={reply.id}
            topics={one.topics}
            deal={actions.deal}
            answered={reply.outcome === "answered"}
            write={write}
          />
        )
      )}
    </ThreadEmail>
  );
  const answers = one.answers
    .filter((answer) => answer.replyId === reply.id)
    .map((answer) => <Answer key={answer.id} answer={answer} reply={reply} one={one} />);
  return reply.automatic || !actions ? (
    <>
      {email()}
      {answers}
    </>
  ) : (
    <AnswerableReply
      replyId={reply.id}
      from={ours}
      to={sender(reply, one)}
      subject={reply.subject}
      answer={actions.answer}
      doNotEmail={reply.doNotEmail}
    >
      {(write) => (
        <>
          {email(write)}
          {answers}
        </>
      )}
    </AnswerableReply>
  );
}

/** What staff can do with a reply: record what it is (`deal`), and answer it. */
export type ReplyHandlers = { deal: (form: FormData) => void | Promise<void>; answer: AnswerAction };
