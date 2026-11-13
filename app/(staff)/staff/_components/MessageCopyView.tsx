import { staffCopy } from "@/lib/content/staff-interface";
import { letterFor } from "@/lib/mailing-doc";
import { named } from "@/lib/email-parsing/addresses";
import type { MessageCopy } from "@/lib/server/broadcast-pages";
import Reply, { type ReplyHandlers } from "./CopyReply";
import { staffTime } from "@/lib/staff-time";
import { FIELDS_AS_WORDS, TEXT_SENDER_NAME } from "@/lib/broadcasts";
import { MailingLetter } from "./MailingLetter";
import { CopyStatus } from "./BroadcastView";
import { ChatBubble, ChatWall, TextWords } from "./TextBubble";
import { LetterHistory, type HistoryEntry } from "./LetterHistory";
import { Thread } from "./LetterThread";
import ThreadEmail from "./ThreadEmail";
import Grid, { Card, Column } from "./ui/Grid";
import PageHead from "./ui/PageHead";
import StaffLink from "./ui/StaffLink";
import Strip from "./ui/Strip";

const copy = staffCopy.broadcastPages;

/**
 * Over a copy that never reached them, so the message below it isn't taken
 * for what they got: refused as it was sent; never sent, and why, as its
 * lozenge says; or not yet. One that went, though it then failed or
 * bounced, has none.
 */
function NotReached({ one }: { one: MessageCopy }) {
  if (one.sentAt) return null;
  const words =
    one.status === "failed"
      ? copy.notReached.refused(one.channel === "text" ? copy.sendFacts.whatsApp : copy.sendBy.names[one.sendBy])
      : ["scheduled", "sending"].includes(one.status)
        ? copy.notReached.notYet
        : copy.notReached.never(
            // Its broadcast stopped by itself (an error, why it gave up), or by us.
            copy.notReached.why[
              one.status === "skipped" ? one.skipReason! : one.state === "error" ? one.why! : "cancelled"
            ],
          );
  return <Strip tone="amber">{words}</Strip>;
}

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
 * reported, each reply dealt with, and each answer, newest first, in words,
 * who did it on a line under it (By). An answer is its own line, so a reply's being answered isn't
 * another.
 */
function historyOf(one: MessageCopy): HistoryEntry[] {
  const dealt = one.replies.flatMap((reply) =>
    reply.dealtAt && reply.outcome !== "answered"
      ? [
          {
            at: reply.dealtAt,
            status: "dealt",
            details: {
              by: reply.dealtBy!,
              ...(reply.outcome === "opted-out" && { how: copy.replies.how }),
            },
            label: reply.outcome === "opted-out" ? copy.replies.historyOptedOut : copy.replies.historyNothing,
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
              details: { by: answer.sentBy },
              label: copy.replies.historyAnswered,
            },
          ]
        : [],
    ),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
}

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
  return (
    <>
      <PageHead
        tags={<CopyStatus copyOf={one} />}
        facts={[
          one.supporterId ? <StaffLink href={`/staff/supporters/${one.supporterId}`}>{name}</StaffLink> : name,
          one.place,
        ]}
      >
        {copy.copyTitle(one.channel, name)}
      </PageHead>
      <Grid>
        <Column span={3}>
          <NotReached one={one} />
          <Thread title={copy.threadTitle}>
            <Message one={one} name={name} />
            {one.replies.map((reply) => (
              <Reply key={reply.id} reply={reply} one={one} actions={actions} />
            ))}
          </Thread>
        </Column>
        <Column span={3}>
          <Card look="log" title={staffCopy.letters.detail.historyTitle} id="letter-history">
            <LetterHistory events={historyOf(one)} logged={false} />
          </Card>
        </Column>
      </Grid>
    </>
  );
}
