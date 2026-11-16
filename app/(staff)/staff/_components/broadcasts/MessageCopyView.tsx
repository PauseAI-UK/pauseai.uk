import { letterFor } from "@/lib/mailings/doc";
import { named } from "@/lib/email-parsing/addresses";
import type { MessageCopy } from "@/lib/broadcasts/pages.server";
import Reply, { type ReplyHandlers } from "./CopyReply";
import { staffTime } from "@/lib/staff-time";
import { FIELDS_AS_WORDS, SITE_ACTOR, TEXT_SENDER_NAME } from "@/lib/broadcasts/broadcasts";
import { MailingLetter } from "../mailings/MailingLetter";
import { CopyStatus } from "../letters/CopyStatus";
import { ChatBubble, ChatWall, TextWords } from "./TextBubble";
import { LetterHistory, type HistoryEntry } from "../letters/LetterHistory";
import { Thread } from "../letters/LetterThread";
import ThreadEmail from "../letters/ThreadEmail";
import bubble from "./Broadcasts.module.css";
import Grid, { Card, Column } from "../ui/Grid";
import PageHead from "../ui/PageHead";
import StaffLink from "../ui/StaffLink";
import Strip from "../ui/Strip";
import { supportersCopy } from "../supporters/copy";
import { lettersCopy } from "../letters/copy";
import { mailingsCopy } from "../mailings/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { receiptOf } from "@/lib/broadcasts/receipts";

const copy = broadcastsCopy.broadcastPages;

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
      ? copy.notReached.refused(
          one.channel === "text"
            ? mailingsCopy.mailingPages.sendFacts.whatsApp
            : mailingsCopy.mailingPages.sendBy.names[one.sendBy],
        )
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
        <ChatBubble
          who={TEXT_SENDER_NAME}
          when={one.sentAt ? staffTime(one.sentAt) : ""}
          ours
          receipt={one.sentAt ? receiptOf(one.events) : undefined}
        >
          <TextWords words={letterFor(one.body, merge)} />
          {/* Its footer, as they got it, where we know it. */}
          {one.footer && <span className={bubble.footer}>{one.footer}</span>}
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

/** Entries newest first, as a history lists them. */
const newestFirst = (entries: HistoryEntry[]) => entries.sort((a, b) => b.at.getTime() - a.at.getTime());

/** Entries to go under another, if there are any. */
const under = (entries: HistoryEntry[]) => (entries.length ? { under: newestFirst(entries) } : {});

/** What its provider said became of a sent copy, which goes under Sent. */
const RECEIPTS = new Set(["delivered", "read", "failed", "bounced"]);

/**
 * A copy's history, as a letter's shows it, newest first, in words, who did
 * it on a line under it (By): what its provider reported, Sent tagged with
 * what sent it and what it then said of it under it (delivered, read,
 * failed, bounced), or on lines of their own with no Sent recorded; each
 * reply dealt with; and each of our replies, with what WhatsApp said became
 * of it under it. Our reply is its own line, so a reply's being answered
 * isn't another.
 */
function historyOf(one: MessageCopy): HistoryEntry[] {
  const entry = (event: MessageCopy["events"][number]): HistoryEntry => ({
    at: event.at,
    status: event.kind,
    details: event.details,
    label: copy.events[event.kind as keyof typeof copy.events],
  });
  const sent = one.events.find((event) => event.kind === "sent");
  const own = one.events.filter((event) => event.kind !== "sent" && !(sent && RECEIPTS.has(event.kind)));
  const tag =
    one.channel === "text"
      ? mailingsCopy.mailingPages.sendFacts.whatsApp
      : mailingsCopy.mailingPages.sendBy.names[one.sendBy];
  // A STOP the site recorded is already there, as WhatsApp's opt-out.
  const dealt = one.replies.flatMap((reply): HistoryEntry[] =>
    reply.dealtAt && reply.outcome !== "answered" && reply.dealtBy !== SITE_ACTOR
      ? [
          {
            at: reply.dealtAt,
            status: "dealt",
            details: { by: reply.dealtBy!, ...(reply.outcome === "opted-out" && { how: copy.replies.how }) },
            label: reply.outcome === "opted-out" ? copy.replies.historyOptedOut : copy.replies.historyNothing,
          },
        ]
      : [],
  );
  const ours = one.answers.flatMap((answer): HistoryEntry[] =>
    answer.sentAt
      ? [
          {
            at: answer.sentAt,
            status: "answered",
            details: { by: answer.sentBy === SITE_ACTOR ? copy.replies.automatically : answer.sentBy },
            label: copy.replies.historyAnswered,
            ...under(
              answer.events.map((event) => ({
                at: event.at,
                status: event.kind,
                details: event.details,
                label: copy.replies.historyOurs[event.kind]!,
              })),
            ),
          },
        ]
      : [],
  );
  return newestFirst([
    ...(sent
      ? [{ ...entry(sent), tag, ...under(one.events.filter((event) => RECEIPTS.has(event.kind)).map(entry)) }]
      : []),
    ...own.map(entry),
    ...dealt,
    ...ours,
  ]);
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
  const name = one.name ?? (one.supporterId ? supportersCopy.supporters.noName : copy.erased);
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
          <Card look="log" title={lettersCopy.letters.detail.historyTitle} id="letter-history">
            <LetterHistory events={historyOf(one)} logged={false} />
          </Card>
        </Column>
      </Grid>
    </>
  );
}
