import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextArea } from "@/components/ui/Controls";
import { Field, Hint } from "@/components/ui/Field";
import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import { letterFor } from "@/lib/mailing-doc";
import { named } from "@/lib/email-parsing/addresses";
import type { MessageCopy } from "@/lib/server/broadcast-pages";
import { staffTime } from "@/lib/staff-time";
import { FIELDS_AS_WORDS, BROADCAST_SENDER, TEXT_SENDER_NAME } from "@/lib/broadcasts";
import { MailingLetter } from "./MailingLetter";
import { copyStatus } from "./BroadcastView";
import { ChatBubble, ChatWall, LinkedText, TextWords } from "./TextBubble";
import ThreadText from "./ThreadText";
import thread from "./LetterThread.module.css";
import ThreadEmail from "./ThreadEmail";
import Band, { BandFact } from "./ui/Band";
import Grid, { Card } from "./ui/Grid";
import StaffLink from "./ui/StaffLink";
import view from "./MailingView.module.css";
import styles from "./Broadcasts.module.css";

const copy = staffCopy.broadcastPages;

type FormAction = (form: FormData) => void | Promise<void>;

/**
 * The message and every reply: a text as the conversation, an email as the
 * thread. A staff member's reply is as the supporter gets it, from PauseAI UK.
 */
function Thread({ one, name }: { one: MessageCopy; name: string }) {
  const merge = one.merge ?? FIELDS_AS_WORDS;
  const ours = named(one.fromName, one.sentFrom);
  const them = one.address ? named(name, one.address) : name;
  if (one.channel === "text") {
    return (
      <ChatWall>
        <ChatBubble who={TEXT_SENDER_NAME} when={staffTime(one.sentAt ?? one.now)} ours>
          <TextWords words={letterFor(one.body, merge)} />
        </ChatBubble>
        {one.replies.map((reply) => (
          <ChatBubble
            key={reply.id}
            who={reply.sentBy ? TEXT_SENDER_NAME : name}
            when={staffTime(reply.at)}
            ours={Boolean(reply.sentBy)}
          >
            <LinkedText text={reply.body} />
          </ChatBubble>
        ))}
      </ChatWall>
    );
  }
  return (
    <div className={styles.thread}>
      <ThreadEmail from={ours} to={them} at={one.sentAt} subject={one.subject}>
        <MailingLetter doc={letterFor(one.body, merge)} />
      </ThreadEmail>
      {one.replies.map((reply) => (
        <ThreadEmail
          key={reply.id}
          from={reply.sentBy ? named(BROADCAST_SENDER.name, BROADCAST_SENDER.email) : them}
          to={reply.sentBy ? them : ours}
          at={reply.at}
          subject={one.subject}
        >
          {/* Plain text, as the letters' threads show it: its lines kept, its links links. */}
          <div className={thread.text}>
            <ThreadText text={reply.body} />
          </div>
        </ThreadEmail>
      ))}
    </div>
  );
}

/** A box to reply from the site, so nobody needs the phone; a text only within its free window after their last message. */
function ReplyBox({ one, reply }: { one: MessageCopy; reply: FormAction }) {
  const email = one.channel === "email";
  const open = email || (one.replyUntil !== null && one.replyUntil > one.now);
  const can = one.sends && Boolean(one.address) && open;
  const hint = !one.sends
    ? copy.replyCantSend
    : email
      ? copy.replyEmail
      : open
        ? copy.replyWindow(staffTime(one.replyUntil!))
        : copy.replyClosed;
  return (
    <form action={reply} className={styles.replyForm}>
      <input type="hidden" name="id" value={one.messageId} />
      <input type="hidden" name="copy" value={one.id} />
      <Field label={copy.reply}>
        <TextArea name="body" rows={3} required disabled={!can} />
      </Field>
      <div>
        <SubmitButton variant="primary" fit disabled={!can}>
          {copy.sendReply[one.channel]}
        </SubmitButton>
      </div>
      <Hint>{hint}</Hint>
    </form>
  );
}

/**
 * Thread: one supporter's copy of a broadcast, the broadcasts'
 * equivalent of a letter's page. When it was sent, delivered and, for a
 * text, read; the message and every reply; a box to reply; and beside them
 * how to stop, and the way to everything else about them.
 */
export default function MessageCopyView({ one, reply }: { one: MessageCopy; reply: FormAction }) {
  const name = one.name ?? (one.supporterId ? staffCopy.supporters.noName : copy.erased);
  const fromThem = one.replies.filter((r) => !r.sentBy).length;
  const lastBy = one.replies.findLast((r) => r.sentBy)?.sentBy;
  const { words, tone } = copyStatus({ ...one, read: Boolean(one.readAt) }, one.channel);
  return (
    <div className={view.page}>
      <Band
        title={name}
        tag={fromThem ? <Tag tone="green">{copy.copyTag.replied}</Tag> : <Tag tone={tone}>{words}</Tag>}
        subtitle={copy.copySubtitle(one.title, one.channel, one.to)}
      >
        <BandFact label={copy.facts.sent} detail={copy.byBackend[one.channel]}>
          {one.sentAt && staffTime(one.sentAt)}
        </BandFact>
        <BandFact label={copy.facts.delivered}>{one.deliveredAt && staffTime(one.deliveredAt)}</BandFact>
        <BandFact label={copy.facts.read}>{one.readAt && staffTime(one.readAt)}</BandFact>
        <BandFact label={copy.facts.replies} detail={lastBy && copy.lastAnswered(lastBy)}>
          {one.replies.length || null}
        </BandFact>
        <BandFact label={copy.facts.supporter}>
          {one.supporterId && <StaffLink href={`/staff/supporters/${one.supporterId}`}>{name}</StaffLink>}
        </BandFact>
      </Band>
      <Grid>
        <Card span={4} title={copy.threadTitle} id="thread-title">
          <Thread one={one} name={name} />
          <ReplyBox one={one} reply={reply} />
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
