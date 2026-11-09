import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import { letterFor } from "@/lib/mailing-doc";
import { named } from "@/lib/email-parsing/addresses";
import type { MessageCopy } from "@/lib/server/broadcast-pages";
import { staffTime } from "@/lib/staff-time";
import { FIELDS_AS_WORDS, TEXT_SENDER_NAME } from "@/lib/broadcasts";
import { MailingLetter } from "./MailingLetter";
import { copyStatus } from "./BroadcastView";
import { ChatBubble, ChatWall, TextWords } from "./TextBubble";
import ThreadEmail from "./ThreadEmail";
import Band, { BandFact } from "./ui/Band";
import Grid, { Card } from "./ui/Grid";
import StaffLink from "./ui/StaffLink";
import view from "./MailingView.module.css";
import styles from "./Broadcasts.module.css";

const copy = staffCopy.broadcastPages;

/** The message as they got it: a text as a conversation, an email as a thread. */
function Thread({ one, name }: { one: MessageCopy; name: string }) {
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
    <div className={styles.thread}>
      <ThreadEmail
        from={named(one.fromName, one.sentFrom)}
        to={one.address ? named(name, one.address) : name}
        at={one.sentAt}
        subject={one.subject}
      >
        <MailingLetter doc={letterFor(one.body, merge)} />
      </ThreadEmail>
    </div>
  );
}

/**
 * Thread: one supporter's copy of a broadcast, the broadcasts'
 * equivalent of a letter's page. When it was sent, delivered and, for a
 * text, read; the message as they got it; and beside it how to stop, and the
 * way to everything else about them.
 */
export default function MessageCopyView({ one }: { one: MessageCopy }) {
  const name = one.name ?? (one.supporterId ? staffCopy.supporters.noName : copy.erased);
  const { words, tone } = copyStatus({ ...one, read: Boolean(one.readAt) }, one.channel);
  return (
    <div className={view.page}>
      <Band
        title={name}
        tag={<Tag tone={tone}>{words}</Tag>}
        subtitle={copy.copySubtitle(one.title, one.channel, one.to)}
      >
        <BandFact label={copy.facts.sent} detail={copy.byBackend[one.channel]}>
          {one.sentAt && staffTime(one.sentAt)}
        </BandFact>
        <BandFact label={copy.facts.delivered}>{one.deliveredAt && staffTime(one.deliveredAt)}</BandFact>
        <BandFact label={copy.facts.read}>{one.readAt && staffTime(one.readAt)}</BandFact>
        <BandFact label={copy.facts.supporter}>
          {one.supporterId && <StaffLink href={`/staff/supporters/${one.supporterId}`}>{name}</StaffLink>}
        </BandFact>
      </Band>
      <Grid>
        <Card span={4} title={copy.threadTitle} id="thread-title">
          <Thread one={one} name={name} />
        </Card>
        <Card span={2} look="aside" title={copy.standingTitle} id="standing-title">
          <p>{words}.</p>
          <p>{copy.standing[one.channel](name)}</p>
          {one.supporterId && (
            <p>
              <StaffLink href={`/staff/supporters/${one.supporterId}`}>{copy.everythingElse(name)}</StaffLink>
            </p>
          )}
        </Card>
      </Grid>
    </div>
  );
}
