import { staffCopy } from "@/lib/content/staff-interface";
import { letterFor } from "@/lib/mailing-doc";
import { named } from "@/lib/email-parsing/addresses";
import type { MessageCopy } from "@/lib/server/broadcast-pages";
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

/** A copy's history, as a letter's shows it: each thing its provider reported, newest first, in words. */
function historyOf(one: MessageCopy): HistoryEntry[] {
  return one.events.map((event) => ({
    at: event.at,
    status: event.kind,
    details: event.details,
    label: copy.events[event.kind as keyof typeof copy.events],
  }));
}

/**
 * Thread: one supporter's copy of a broadcast, laid out as a letter of a
 * mailing is: its title and how it stands; under it who it's to, leading to
 * their page, and where they are; then the message as they got it, beside
 * what its provider reported, a stop among it. The thread says who it's from
 * and to and when, so nothing repeats it.
 */
export default function MessageCopyView({ one }: { one: MessageCopy }) {
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
