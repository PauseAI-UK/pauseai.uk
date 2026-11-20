import { letterFor } from "@/lib/mailings/doc";
import { staffMemberText } from "@/lib/staff-member";
import { named } from "@/lib/email-parsing/addresses";
import { gmailMessageLink } from "@/lib/email/gmail-links";
import type { MessageCopy } from "@/lib/broadcasts/pages.server";
import type { BroadcastReply } from "@/lib/broadcasts/replies.server";
import { phoneWords } from "@/lib/phone";
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
import own from "./MessageCopyView.module.css";
import ExternalLink from "../ui/ExternalLink";
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
 * A copy's history, as a letter's shows it, newest first, in words, with
 * who it was from and to, and who did it (By), on lines under it, and what
 * else it recorded in its {}: what its provider reported, Sent tagged with
 * what sent it and what it then said of it under it (delivered, read,
 * failed, bounced), or on lines of their own with no Sent recorded; each
 * reply, and each dealt with; and each of our replies, with what WhatsApp
 * said became of it under it. Our reply is its own line, so a reply's being
 * answered isn't another.
 */
function historyOf(one: MessageCopy): HistoryEntry[] {
  const entry = (event: MessageCopy["events"][number]): HistoryEntry => ({
    at: event.at,
    status: event.kind,
    details: event.details,
    label: copy.events[event.kind as keyof typeof copy.events],
  });
  // An address as it is; a number as staff pages write it, with whose it is, ours or the supporter's, where known, as
  // a number alone is hard to place.
  const shown = (address: string) => {
    if (one.channel !== "text") return address;
    // Every number in it is ours or theirs.
    const whose = address === one.sentFrom ? one.fromName : one.name;
    return whose ? copy.replies.numberOf(whose, phoneWords(address)) : phoneWords(address);
  };
  const ourAddress = shown(one.sentFrom);
  // What a reply came back by, and ours went by: WhatsApp for a text, and for an email the mailbox's Gmail; and its tag.
  const replyBackend = one.channel === "text" ? "whatsapp" : "gmail";
  const replyTag =
    one.channel === "text"
      ? mailingsCopy.mailingPages.sendFacts.whatsApp
      : mailingsCopy.mailingPages.sendBy.names.gmail;
  const sent = one.events.find((event) => event.kind === "sent");
  // Each reply is its own line, from the reply itself, so its event isn't another.
  const own = one.events.filter(
    (event) => event.kind !== "sent" && event.kind !== "replied" && !(sent && RECEIPTS.has(event.kind)),
  );
  const tag =
    one.channel === "text"
      ? mailingsCopy.mailingPages.sendFacts.whatsApp
      : mailingsCopy.mailingPages.sendBy.names[one.sendBy];
  const sentDetails = {
    from: ourAddress,
    ...(one.address && { to: shown(one.address) }),
    backend: one.channel === "text" ? "whatsapp" : one.sendBy,
    ...(one.providerId && { messageId: one.providerId }),
  };
  const replies = one.replies.flatMap((reply): HistoryEntry[] =>
    reply.automatic
      ? []
      : [
          {
            at: reply.receivedAt,
            status: "replied",
            label: copy.events.replied,
            tag: replyTag,
            details: { from: shown(reply.from), to: ourAddress, backend: replyBackend, messageId: reply.providerId },
          },
        ],
  );
  // A STOP the site recorded is already there, as WhatsApp's opt-out. Replies dealt with at once, as dealing with
  // their latest deals with those before it, are one line.
  const once = new Set<string>();
  const firstOf = (reply: BroadcastReply) => {
    const key = `${reply.dealtAt!.getTime()} ${reply.dealtBy} ${reply.outcome}`;
    return !once.has(key) && once.add(key);
  };
  const dealt = one.replies.flatMap((reply): HistoryEntry[] =>
    reply.dealtAt && reply.outcome !== "answered" && reply.dealtBy !== SITE_ACTOR && firstOf(reply)
      ? [
          {
            at: reply.dealtAt,
            status: "dealt",
            details: {
              by: staffMemberText(reply.dealtBy!),
              ...(reply.outcome === "opted-out" && { how: copy.replies.how }),
            },
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
            details: {
              by: answer.sentBy === SITE_ACTOR ? copy.replies.automatically : staffMemberText(answer.sentBy),
              from: ourAddress,
              // Every answer is to one of this copy's replies.
              to: shown(one.replies.find((reply) => reply.id === answer.replyId)!.from),
              backend: replyBackend,
              ...(answer.providerId && { messageId: answer.providerId }),
            },
            label: copy.replies.historyAnswered,
            tag: replyTag,
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
  // Each emoji we put on a reply to a text, with WhatsApp's failure of it under it, the only thing it tells of one.
  const reacted = one.reactions.map((reaction): HistoryEntry => ({
    at: reaction.sentAt,
    status: "answered",
    details: { by: staffMemberText(reaction.sentBy) },
    label: copy.replies.historyReacted(reaction.emoji),
    tag: replyTag,
    ...under(
      reaction.events.map((event) => ({
        at: event.at,
        status: event.kind,
        details: event.details,
        label: copy.replies.historyOurs[event.kind]!,
      })),
    ),
  }));
  return newestFirst([
    ...(sent
      ? [
          {
            ...entry(sent),
            details: sentDetails,
            tag,
            ...under(one.events.filter((event) => RECEIPTS.has(event.kind)).map(entry)),
          },
        ]
      : []),
    ...own.map(entry),
    ...replies,
    ...dealt,
    ...ours,
    ...reacted,
  ]);
}

/**
 * At the right of the thread's heading, while an email's has a reply read
 * from Gmail: the newest such in the mailbox it was read from, where Gmail
 * shows the conversation round it, our answers too.
 */
function OpenInGmail({ one }: { one: MessageCopy }) {
  const newest = one.replies.findLast((reply) => reply.account);
  if (!newest) return null;
  return (
    <ExternalLink href={gmailMessageLink(newest.account!, newest.providerId)}>
      {lettersCopy.lettersInbox.openInGmail}
    </ExternalLink>
  );
}

/**
 * Thread: one supporter's copy of a broadcast, laid out as a letter of a
 * mailing is: its title and how it stands; under it who it's to, leading to
 * their page, and where they are; then the message as they got it, beside
 * what its provider reported, a stop among it. Each reply comes under it,
 * with what staff can record it as and their answers (`actions`). The thread
 * says who it's from and to and when, so nothing repeats it.
 */
export default function MessageCopyView({
  one,
  actions,
  signer,
}: {
  one: MessageCopy;
  actions?: ReplyHandlers;
  /** The staff member's first name, which an email's answer is signed with. */
  signer?: string;
}) {
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
          <Thread title={copy.threadTitle} link={<OpenInGmail one={one} />}>
            {/* A text's thread is one conversation, its parts touching; an email's, a mail each, apart. */}
            <div className={one.channel === "text" ? own.chat : own.mails}>
              <Message one={one} name={name} />
              {one.replies.map((reply) => (
                <Reply key={reply.id} reply={reply} one={one} actions={actions} signer={signer} />
              ))}
            </div>
          </Thread>
        </Column>
        <Column span={3}>
          <Card look="log" title={lettersCopy.letters.detail.historyTitle} id="letter-history">
            <LetterHistory events={historyOf(one)} />
          </Card>
        </Column>
      </Grid>
    </>
  );
}
