"use client";

// A reply in a copy's thread (MessageCopyView), on the client, as what opens
// its answer (AnswerableReply's) is a function its buttons are given.
import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import { named } from "@/lib/email-parsing/addresses";
import { phoneWords } from "@/lib/phone";
import { answerSubject } from "@/lib/email-parsing/subjects";
import type { BroadcastAnswer } from "@/lib/server/broadcast-answers.server";
import type { MessageCopy } from "@/lib/server/broadcast-pages.server";
import type { BroadcastReply } from "@/lib/server/broadcast-replies.server";
import { staffTime } from "@/lib/staff-time";
import AnswerableReply, { type AnswerAction } from "./AnswerableReply";
import { MailingLetter } from "./mailings/MailingLetter";
import ReplyActions, { ReplyButton } from "./ReplyActions";
import { ChatBubble, ChatWall, LinkedText, TextWords } from "./TextBubble";
import ThreadEmail from "./letters/ThreadEmail";
import { SITE_ACTOR, TEXT_SENDER_NAME } from "@/lib/broadcasts";
import styles from "./MessageCopyView.module.css";

const copy = staffCopy.broadcastPages;

/** Who a reply is from: their name as their copy had it, when it's from the address the copy went to. */
const sender = (reply: BroadcastReply, one: MessageCopy) => {
  const name = reply.from === one.address ? one.name : null;
  // A text's, as WhatsApp names them: their name, or else their number as staff pages write it.
  if (one.channel === "text") return name || phoneWords(reply.from);
  return named(name, reply.from);
};

/** Our answer to a reply, in the thread after it: who sent it, or that it may not have gone; to a text, as a bubble. */
function Answer({ answer, reply, one }: { answer: BroadcastAnswer; reply: BroadcastReply; one: MessageCopy }) {
  // Who sent it: the site itself, for its answer to a STOP, or the staff member.
  const sentBy = answer.sentBy === SITE_ACTOR ? copy.replies.sentAutomatically : copy.replies.sentBy(answer.sentBy);
  if (one.channel === "text") {
    // Who sent it on the line with the time, as a chat app puts what it says of a message there.
    return (
      <ChatWall>
        <ChatBubble who={TEXT_SENDER_NAME} when={answer.sentAt ? `${sentBy} · ${staffTime(answer.sentAt)}` : ""} ours>
          <TextWords words={answer.body} />
          {!answer.sentAt && <p className={styles.dealt}>{copy.replies.stillSending(one.sentFrom)}</p>}
        </ChatBubble>
      </ChatWall>
    );
  }
  const by = <p className={styles.dealt}>{answer.sentAt ? sentBy : copy.replies.stillSending(one.sentFrom)}</p>;
  return (
    <ThreadEmail
      from={named(one.fromName, one.sentFrom)}
      to={sender(reply, one)}
      at={answer.sentAt}
      subject={answerSubject(reply.subject)}
    >
      <MailingLetter doc={answer.body} />
      {by}
    </ThreadEmail>
  );
}

/**
 * A reply under our email or text, as it came, a text's as a bubble; then
 * what to record it as, or what was, but nothing for an automatic one; then
 * our answers to it, and one to write (`answer`), but to an automatic reply,
 * or to a text's more than a day old, which WhatsApp takes no answer to.
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
  const text = one.channel === "text";
  const ours = text ? TEXT_SENDER_NAME : named(one.fromName, one.sentFrom);
  // A text's words as WhatsApp shows them, each web address a link.
  const words = reply.text ? (
    <p className={styles.text}>{text ? <LinkedText text={reply.text} /> : reply.text}</p>
  ) : (
    <Muted>{copy.replies.noText}</Muted>
  );
  // Reply, while its answer isn't open: in its buttons, or under what it was recorded as.
  const dealt = (write?: () => void) =>
    reply.automatic ? null : reply.outcome && reply.outcome !== "answered" ? (
      <>
        <p className={styles.dealt}>
          {reply.dealtBy === SITE_ACTOR
            ? copy.replies.optedOutAutomatically(when!)
            : (reply.outcome === "opted-out" ? copy.replies.optedOut : copy.replies.nothingDone)(reply.dealtBy!, when!)}
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
          text={text}
          write={write}
        />
      )
    );
  // A text's reply in a card, as an email's is: the chat, then at its foot what to record it as and Reply, or
  // why it can't be answered now: only under their latest message, while it's unanswered, as an earlier one, or
  // one we answered, needs no answer now.
  const answered = one.answers.some((answer) => answer.replyId === reply.id);
  const latest = one.replies.at(-1)?.id === reply.id;
  const textReply = (write?: () => void) => {
    const closed = !reply.answerable && actions && latest && !answered;
    const done = dealt(write);
    return (
      <div className={styles.textReply}>
        <ChatWall>
          <ChatBubble who={sender(reply, one)} when={staffTime(reply.receivedAt)}>
            {words}
          </ChatBubble>
        </ChatWall>
        {(closed || done) && (
          <div className={styles.textFoot}>
            {closed && <Muted>{copy.replies.windowClosed}</Muted>}
            {done}
          </div>
        )}
      </div>
    );
  };
  const email = (write?: () => void) =>
    text ? (
      textReply(write)
    ) : (
      <ThreadEmail from={sender(reply, one)} to={ours} at={reply.receivedAt} subject={reply.subject}>
        {words}
        {dealt(write)}
      </ThreadEmail>
    );
  const answers = one.answers
    .filter((answer) => answer.replyId === reply.id)
    .map((answer) => <Answer key={answer.id} answer={answer} reply={reply} one={one} />);
  return reply.automatic || !actions || !reply.answerable ? (
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
      text={text}
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
