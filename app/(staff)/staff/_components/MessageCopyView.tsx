import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import { letterFor } from "@/lib/mailing-doc";
import { named } from "@/lib/email-parsing/addresses";
import type { MessageCopy } from "@/lib/server/broadcast-pages";
import type { BroadcastReply } from "@/lib/server/broadcast-replies";
import type { BroadcastAnswer } from "@/lib/server/broadcast-answers";
import { answerSubject } from "@/lib/email-parsing/subjects";
import AnswerableReply, { type AnswerAction } from "./AnswerableReply";
import ReplyActions from "./ReplyActions";
import styles from "./MessageCopyView.module.css";
import { staffTime } from "@/lib/staff-time";
import { FIELDS_AS_WORDS, TEXT_SENDER_NAME } from "@/lib/broadcasts";
import { MailingLetter } from "./MailingLetter";
import { CopyStatus } from "./BroadcastView";
import { ChatBubble, ChatWall, TextWords } from "./TextBubble";
import { LetterHistory, type HistoryEntry } from "./LetterHistory";
import { Thread } from "./LetterThread";
import ThreadEmail from "./ThreadEmail";
import Grid, { Card, Column, spanClass } from "./ui/Grid";
import PageHead from "./ui/PageHead";
import StaffLink from "./ui/StaffLink";

const copy = staffCopy.broadcastPages;

/** The message as they got it: a text as a conversation, an email as a mail app shows it. */
function Message({ one, name }: { one: MessageCopy; name: string }) {
  const merge = one.merge ?? FIELDS_AS_WORDS;
  if (one.channel === "text") {
    return (
      <ChatWall>
        <ChatBubble who={TEXT_SENDER_NAME} when={one.sentAt ? staffTime(one.sentAt) : ""} ours>
          <TextWords words={letterFor(one.body, merge)} />
        </ChatBubble>
      </ChatWall>
    );
  }
  return (
    <ThreadEmail
      from={named(one.fromName, one.sentFrom)}
      to={one.address ? named(name, one.address) : name}
      at={one.sentAt}
      subject={one.subject}
    >
      <MailingLetter doc={letterFor(one.body, merge)} />
    </ThreadEmail>
  );
}

/**
 * A copy's history, as a letter's shows it: each thing its provider
 * reported, who dealt with each reply, and who answered it, newest first, in
 * words. An answer is its own line, so a reply's being answered isn't
 * another.
 */
function historyOf(one: MessageCopy): HistoryEntry[] {
  const dealt = one.replies.flatMap((reply) =>
    reply.dealtAt && reply.outcome !== "answered"
      ? [
          {
            at: reply.dealtAt,
            status: "dealt",
            details: {},
            label: (reply.outcome === "opted-out" ? copy.replies.historyOptedOut : copy.replies.historyNothing)(
              reply.dealtBy!,
            ),
          },
        ]
      : [],
  );
  return [
    ...one.events.map((event) => ({
      at: event.at,
      status: event.kind,
      details: event.details,
      label: copy.events[event.kind as keyof typeof copy.events],
    })),
    ...dealt,
    ...one.answers.flatMap((answer) =>
      answer.sentAt
        ? [
            {
              at: answer.sentAt,
              status: "answered",
              details: {},
              label: copy.replies.historyAnswered(answer.sentBy),
            },
          ]
        : [],
    ),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
}

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
 * was, or that it's automatic; then our answers to it, and one to write
 * (`answer`), but to an automatic reply.
 */
function Reply({ reply, one, actions }: { reply: BroadcastReply; one: MessageCopy; actions?: ReplyHandlers }) {
  const when = reply.dealtAt && staffTime(reply.dealtAt);
  const ours = named(one.fromName, one.sentFrom);
  const email = (
    <ThreadEmail from={sender(reply, one)} to={ours} at={reply.receivedAt} subject={reply.subject}>
      {reply.text ? <p className={styles.text}>{reply.text}</p> : <Muted>{copy.replies.noText}</Muted>}
      {reply.automatic ? (
        <p className={styles.dealt}>{copy.replies.automatic}</p>
      ) : reply.outcome && reply.outcome !== "answered" ? (
        <p className={styles.dealt}>
          {(reply.outcome === "opted-out" ? copy.replies.optedOut : copy.replies.nothingDone)(reply.dealtBy!, when!)}
        </p>
      ) : (
        actions && (
          <ReplyActions
            replyId={reply.id}
            topics={one.topics}
            deal={actions.deal}
            answered={reply.outcome === "answered"}
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
      {email}
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
      {email}
      {answers}
    </AnswerableReply>
  );
}

/** What staff can do with a reply: record what it is (`deal`), and answer it. */
export type ReplyHandlers = { deal: (form: FormData) => void | Promise<void>; answer: AnswerAction };

/**
 * Thread: one supporter's copy of a broadcast, laid out as a letter of a
 * mailing is: its title and how it stands; under it who it's to, leading to
 * their page, and where they are; then the message as they got it, beside
 * what its provider reported, a stop among it. Each reply comes under it,
 * with what staff can record it as and their answers (`actions`). The thread
 * says who it's from and to and when, so nothing repeats it.
 */
export default function MessageCopyView({ one, actions }: { one: MessageCopy; actions?: ReplyHandlers }) {
  const name = one.name ?? (one.supporterId ? staffCopy.supporters.noName : copy.erased);
  const has = (kind: string) => one.events.some((event) => event.kind === kind);
  return (
    <>
      <PageHead
        tags={
          <CopyStatus copyOf={{ ...one, read: has("read"), bounced: has("bounced"), optedOut: has("opted-out") }} />
        }
        facts={[
          one.supporterId ? <StaffLink href={`/staff/supporters/${one.supporterId}`}>{name}</StaffLink> : name,
          one.place,
        ]}
      >
        {copy.copyTitle(one.channel, name)}
      </PageHead>
      <Grid>
        <div className={spanClass(3)}>
          <Thread title={copy.threadTitle}>
            <Message one={one} name={name} />
            {one.replies.map((reply) => (
              <Reply key={reply.id} reply={reply} one={one} actions={actions} />
            ))}
          </Thread>
        </div>
        <Column span={3}>
          <Card look="log" title={staffCopy.letters.detail.historyTitle} id="letter-history">
            <LetterHistory events={historyOf(one)} />
          </Card>
        </Column>
      </Grid>
    </>
  );
}
