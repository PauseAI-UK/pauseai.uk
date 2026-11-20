"use client";

// A reply in a copy's thread (MessageCopyView), on the client, as what opens
// its answer (AnswerableReply's) is a function its buttons are given.
import type { ReactNode } from "react";
import { staffMemberText } from "@/lib/staff-member";
import { Muted } from "@/components/ui/Text";
import { named } from "@/lib/email-parsing/addresses";
import { phoneWords } from "@/lib/phone";
import { answerSubject } from "@/lib/email-parsing/subjects";
import type { BroadcastAnswer } from "@/lib/broadcasts/answers.server";
import type { MessageCopy } from "@/lib/broadcasts/pages.server";
import type { BroadcastReply } from "@/lib/broadcasts/replies.server";
import { staffTime } from "@/lib/staff-time";
import AnswerableReply, { type AnswerAction } from "./AnswerableReply";
import { MailingLetter } from "../mailings/MailingLetter";
import ReplyActions, { ReplyButton } from "./ReplyActions";
import ReplyReactions, { OurReaction, standingOf, type ReactAction } from "./ReplyReactions";
import { ChatBubble, ChatWall, LinkedText, TextWords } from "./TextBubble";
import ThreadEmail from "../letters/ThreadEmail";
import { FIELDS_AS_WORDS, SITE_ACTOR, TEXT_SENDER_NAME } from "@/lib/broadcasts/broadcasts";
import { kindWords } from "@/lib/broadcasts/whatsapp-messages";
import { toText } from "@/lib/letters/format";
import { letterFor } from "@/lib/mailings/doc";
import styles from "./MessageCopyView.module.css";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { receiptOf } from "@/lib/broadcasts/receipts";

const copy = broadcastsCopy.broadcastPages;

/** Who a reply is from: their name as their copy had it, when it's from the address the copy went to. */
const sender = (reply: BroadcastReply, one: MessageCopy) => {
  const name = reply.from === one.address ? one.name : null;
  // A text's, as WhatsApp names them: their name, or else their number as staff pages write it.
  if (one.channel === "text") return name || phoneWords(reply.from);
  return named(name, reply.from);
};

/**
 * The words of the message of ours a reaction is to, for the bubble to
 * quote the start of: our answer WhatsApp calls that, or else the
 * broadcast's own text.
 */
function reactedTo(reply: BroadcastReply, one: MessageCopy): string {
  const answer = one.answers.find((each) => each.providerId !== null && each.providerId === reply.reactionTo);
  return toText(answer ? answer.body : letterFor(one.body, one.merge ?? FIELDS_AS_WORDS));
}

/**
 * Our answer to a reply, in the thread after it: who sent it, or that it may
 * not have gone; to a text, as a bubble. The last in the thread has its
 * buttons at its foot (`foot`).
 */
function Answer({
  answer,
  reply,
  one,
  foot,
}: {
  answer: BroadcastAnswer;
  reply: BroadcastReply;
  one: MessageCopy;
  foot?: ReactNode;
}) {
  // Who sent it: the site itself, for its answer to a STOP; the mailbox, for one written in its Gmail; or the staff member.
  const sentBy =
    answer.sentBy === SITE_ACTOR
      ? copy.replies.sentAutomatically
      : answer.fromGmail
        ? copy.replies.sentInGmail(answer.sentBy)
        : copy.replies.sentBy(staffMemberText(answer.sentBy));
  if (one.channel === "text") {
    const bubble = (
      <ChatWall>
        <ChatBubble
          who={TEXT_SENDER_NAME}
          when={answer.sentAt ? `${sentBy} · ${staffTime(answer.sentAt)}` : ""}
          ours
          receipt={answer.sentAt ? receiptOf(answer.events) : undefined}
        >
          <TextWords words={answer.body} />
          {!answer.sentAt && <p className={styles.dealt}>{copy.replies.stillSending(one.sentFrom)}</p>}
        </ChatBubble>
      </ChatWall>
    );
    // With the thread's buttons, in a card as their reply is, the buttons at its foot.
    return foot ? (
      <div className={styles.textReply}>
        {bubble}
        <div className={styles.textFoot}>{foot}</div>
      </div>
    ) : (
      bubble
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
      {foot}
    </ThreadEmail>
  );
}

/**
 * A reply under our email or text, as it came, a text's as a bubble; then
 * what it was recorded as; then our answers to it. Their latest that isn't
 * automatic has the thread's buttons, at its foot: what to record it as, and
 * Reply, or Follow up under our last answer, which opens one to write
 * (`answer`), but to a text's more than a day old, which WhatsApp takes no
 * answer to.
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
  const reaction = reply.kind === "reaction";
  const kind = kindWords(reply.kind);
  // A text's words as WhatsApp shows them, each web address a link; a reaction's, its emoji, large.
  const said = reply.text && (
    <p className={reaction ? styles.emoji : styles.text}>{text ? <LinkedText text={reply.text} /> : reply.text}</p>
  );
  // What they sent: for a reaction, the start of our message it's to, then its emoji; for any other that's more
  // than words, what it was, over the words it came with; else its words.
  const words = reaction ? (
    <>
      <span className={styles.quote}>{reactedTo(reply, one)}</span>
      {said}
    </>
  ) : kind ? (
    <>
      <span className={styles.kind}>{kind}</span>
      {said}
    </>
  ) : (
    said || <Muted>{copy.replies.noText}</Muted>
  );
  // Under a reaction, that it is one, before when; then, on a line under that, when they took it back, if they did.
  const reacted = reaction ? `${reply.text ? copy.replies.reacted : copy.replies.reactedNotKept} · ` : "";
  const came = `${reacted}${staffTime(reply.receivedAt)}`;
  const cameAndWent = reply.removedAt ? (
    <>
      {came}
      <br />
      {copy.replies.reactionRemoved(staffTime(reply.removedAt))}
    </>
  ) : (
    came
  );
  // What it was recorded as, but answered, which our answer after it says.
  const recorded = reply.outcome && reply.outcome !== "answered" && (
    <p className={styles.dealt}>
      {reply.dealtBy === SITE_ACTOR
        ? copy.replies.optedOutAutomatically(when!)
        : (reply.outcome === "opted-out" ? copy.replies.optedOut : copy.replies.nothingDone)(
            staffMemberText(reply.dealtBy!),
            when!,
          )}
    </p>
  );
  const answered = one.answers.some((answer) => answer.replyId === reply.id);
  // The thread has one set of buttons, for their latest message: what to record it as, and Reply, while its answer
  // isn't open, Follow up once we've answered it; or, once recorded, Reply alone. Dealing with it deals with any
  // before it too.
  const latest = one.replies.findLast((each) => !each.automatic) === reply;
  const buttons = (write?: () => void) =>
    !latest
      ? null
      : recorded
        ? write && (
            <p className={styles.write}>
              <ReplyButton write={write} followUp={answered} />
            </p>
          )
        : actions && (
            <ReplyActions
              replyId={reply.id}
              topics={one.topics}
              deal={actions.deal}
              answered={reply.outcome === "answered"}
              text={text}
              write={write}
              followUp={answered}
            />
          );
  // A text's reply in a card, as an email's is: the chat, then at its foot what it was recorded as and the
  // buttons, unless our answer after it has them, or why it can't be answered now: only under their latest
  // message, while it's unanswered, as an earlier one, or one we answered, needs no answer now.
  const reactions = one.reactions.filter((reaction) => reaction.replyId === reply.id);
  const textReply = (write?: () => void) => {
    const closed = !reply.answerable && actions && latest && !answered;
    const own = !answered && buttons(write);
    // Who put our emoji on it, as what it was recorded as is said.
    const ourEmoji = standingOf(reactions);
    const foot = (recorded || ourEmoji || own) && (
      <>
        {recorded}
        {ourEmoji && <OurReaction reaction={ourEmoji} className={styles.dealt} />}
        {own}
      </>
    );
    return (
      <div className={styles.textReply}>
        {/* An emoji goes only on their latest message, which is the one to deal with. */}
        <ReplyReactions
          replyId={reply.id}
          who={sender(reply, one)}
          when={cameAndWent}
          reactions={reactions}
          reactable={reply.reactable && latest}
          react={actions?.react}
        >
          {words}
        </ReplyReactions>
        {(closed || foot) && (
          <div className={styles.textFoot}>
            {closed && <Muted>{copy.replies.windowClosed}</Muted>}
            {foot}
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
        {recorded}
        {/* The buttons, unless our answer after it has them. */}
        {!answered && buttons(write)}
      </ThreadEmail>
    );
  // Our answers to it, the last with the buttons.
  const answers = (write?: () => void) =>
    one.answers
      .filter((answer) => answer.replyId === reply.id)
      .map((answer, i, all) => (
        <Answer
          key={answer.id}
          answer={answer}
          reply={reply}
          one={one}
          foot={i === all.length - 1 ? buttons(write) : undefined}
        />
      ));
  // Only their latest is answered, so ours is written at the foot of the thread, after all they said.
  return reply.automatic || !actions || !reply.answerable || !latest ? (
    <>
      {email()}
      {answers()}
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
          {answers(write)}
        </>
      )}
    </AnswerableReply>
  );
}

/** What staff can do with a reply: record what it is (`deal`), answer it, and put an emoji on a text's (`react`). */
export type ReplyHandlers = {
  deal: (form: FormData) => void | Promise<void>;
  answer: AnswerAction;
  react: ReactAction;
};
