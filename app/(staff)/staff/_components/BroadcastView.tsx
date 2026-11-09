import type { ReactNode } from "react";
import Tag, { type TagTone } from "@/components/ui/Tag";
import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import type { WrittenBroadcast } from "@/lib/server/broadcast-drafts";
import type { BroadcastPageData, MessageRecipient, BroadcastSummary } from "@/lib/server/broadcast-pages";
import { filtersPath, pageParam } from "@/lib/staff-search";
import { londonClock, londonWhen, sendsAt, staffDate } from "@/lib/staff-time";
import {
  FIELD_WORDS,
  hasField,
  MEMBER_CONDITION,
  spacedNumber,
  textStopsAt,
  VOLUNTEER_CONDITION,
  type BroadcastChannel,
} from "@/lib/broadcasts";
import ChannelIcon from "./ChannelIcon";
import IconText from "./ui/IconText";
import MailEmail from "./MailEmail";
import MailingFiles from "./MailingFiles";
import { MailingLetter } from "./MailingLetter";
import { MailingStanding, MailingWhen } from "./MailingView";
import TextBubble from "./TextBubble";
import Band, { BandFact } from "./ui/Band";
import Counts, { countsFiltering, type Count } from "./ui/Counts";
import Grid, { Card } from "./ui/Grid";
import ListFrame, { type ListColumn } from "./ui/ListFrame";
import StaffLink from "./ui/StaffLink";
import view from "./MailingView.module.css";
import styles from "./Broadcasts.module.css";

const copy = staffCopy.broadcastPages;

type FormAction = (form: FormData) => void | Promise<void>;

/** A broadcast's channel, as an icon and its name. */
export function BroadcastChannelName({ channel }: { channel: BroadcastChannel }) {
  return (
    <span className={styles.channel}>
      <IconText icon={<ChannelIcon channel={channel === "email" ? "email" : "phone"} />}>
        {copy.channels[channel]}
      </IconText>
    </span>
  );
}

/**
 * How a broadcast went, in the order it happens: what arrived, what didn't,
 * what never went as it was stopped, then what was read, only for a text, as
 * an email's isn't reported.
 */
export function broadcastCounts(broadcast: BroadcastSummary): Count[] {
  return [
    { key: "delivered", n: broadcast.delivered, label: copy.counts.delivered },
    { key: "failed", n: broadcast.failed, label: copy.counts.failed, tone: "red" },
    { key: "stopped", n: broadcast.stopped, label: copy.counts.stopped },
    ...(broadcast.channel === "text" ? [{ key: "read", n: broadcast.read, label: copy.counts.read }] : []),
  ];
}

/** How a copy went, in words and its tone: skipped with why, or its status, or read. */
export function copyStatus(
  copyOf: Pick<MessageRecipient, "status" | "skipReason" | "read">,
  channel: BroadcastChannel,
): { words: string; tone?: TagTone } {
  const { skipReason, status, read } = copyOf;
  if (skipReason === "unsubscribed") return { words: copy.skipReasons.unsubscribed[channel], tone: "red" };
  if (skipReason) return { words: copy.skipReasons[skipReason as "blocked"], tone: "red" };
  if (read) return { words: copy.statuses.read, tone: "green" };
  return { words: copy.statuses[status], tone: status === "failed" ? "red" : undefined };
}

/** Whether a copy went, so has a page of its own. */
export function copyWent(copyOf: Pick<MessageRecipient, "status" | "skipReason">): boolean {
  return !copyOf.skipReason && !["scheduled", "cancelled"].includes(copyOf.status);
}

/** A recipient's columns: who, and where they are; then how it went, when, and the way to their copy's page. */
function recipientColumns(broadcast: BroadcastSummary): ListColumn<MessageRecipient>[] {
  return [
    {
      key: "who",
      label: copy.columns.who,
      cell: (r) => (
        <span className={styles.stack}>
          {r.supporterId ? (
            <StaffLink href={`/staff/supporters/${r.supporterId}`}>{r.name ?? staffCopy.supporters.noName}</StaffLink>
          ) : (
            copy.erased
          )}
          {r.place && <Muted>{r.place}</Muted>}
        </span>
      ),
    },
    {
      key: "status",
      label: copy.columns.status,
      short: true,
      cell: (r) => {
        const { words, tone } = copyStatus(r, broadcast.channel);
        return (
          <span className={styles.stack}>
            <Tag tone={tone}>{words}</Tag>
            {r.sentAt && <Muted>{staffDate(r.sentAt)}</Muted>}
            {copyWent(r) && (
              <StaffLink href={`/staff/broadcasts/${broadcast.id}/${r.copyId}`}>{copy.threadLink}</StaffLink>
            )}
          </span>
        );
      },
    },
  ];
}

/** The email as a mail app shows it, or the text as a bubble, with its fields as chips. */
function BroadcastWords({ written }: { written: WrittenBroadcast }) {
  if (written.channel === "text") {
    return (
      <Card span={3} look="aside" title={copy.textTitle} id="words-title">
        <TextBubble
          from={written.fromName!}
          words={{ content: written.body.content.filter((block) => block.type !== "onlyFor") }}
          time={londonClock(sendsAt(written.dueAt!))}
        />
      </Card>
    );
  }
  const conditions = {
    [hasField("mp")]: copy.conditions.mp.label,
    [VOLUNTEER_CONDITION]: copy.conditions.volunteer.label,
    [MEMBER_CONDITION]: copy.conditions.member.label,
  };
  return (
    <Card span={3} look="aside" title={copy.emailTitle} id="words-title">
      <MailEmail
        from={written.fromName ? `${written.fromName} <${written.sentFrom}>` : written.sentFrom}
        to={<Muted>{staffCopy.mailingPages.toEach}</Muted>}
        subject={written.subject}
      >
        <MailingLetter doc={written.body} fields={FIELD_WORDS} conditions={conditions} />
        {written.attachments.length > 0 && (
          <MailingFiles files={written.attachments} base={`/staff/broadcasts/${written.id}/files`} />
        )}
      </MailEmail>
    </Card>
  );
}

/**
 * A broadcast's page, once scheduled: a band of its title, who from, who it was
 * for, and when it went and who sent it, with its counts, each leading to
 * those recipients; where it stands, and while WhatsApp hasn't approved its
 * words, that; then the email or text beside its recipients.
 */
export default function BroadcastView({
  data,
  who,
  contact,
  stop,
  reschedule,
}: {
  data: Extract<BroadcastPageData, { kind: "written" }>;
  /** Who else it was for, as pills (BroadcastWho). */
  who: ReactNode;
  /** What they all said yes to (BroadcastContact). */
  contact: ReactNode;
  stop: FormAction;
  reschedule: FormAction;
}) {
  const { written, summary, tab } = data;
  const path = `/staff/broadcasts/${written.id}`;
  const scheduled = written.state === "scheduled";
  const counts = countsFiltering(path, broadcastCounts(summary), tab, staffCopy.mailingPages.showEveryone);
  return (
    <div className={view.page}>
      <Band
        title={written.title || copy.untitled}
        tag={
          written.state === "sending" ? undefined : (
            <Tag tone={scheduled ? "blue" : undefined}>{staffCopy.mailingPages.states[written.state]}</Tag>
          )
        }
        aside={!scheduled && <Counts counts={counts} />}
      >
        {/* The channel's icon is Said yes to's, beside it. */}
        <BandFact label={copy.facts.from} detail={`${written.fromName}, ${copy.byBackend[written.channel]}`}>
          {spacedNumber(written.sentFrom!)}
        </BandFact>
        <BandFact label={copy.facts.saidYes}>{contact}</BandFact>
        <BandFact label={staffCopy.mailingPages.to} detail={staffCopy.campaigns.supporters(summary.to)}>
          {who}
        </BandFact>
        <MailingWhen mailing={summary} written={written} />
      </Band>
      <MailingStanding
        mailing={summary}
        written={written}
        stop={stop}
        reschedule={reschedule}
        line={copy.scheduledLine(summary.to, written.channel, written.fromName || written.sentFrom!)}
        note={
          written.channel === "text" &&
          scheduled && <Muted>{copy.stopsOn(londonWhen(textStopsAt(written.dueAt!), "short"))}</Muted>
        }
      />
      <Grid>
        <BroadcastWords written={written} />
        <Card span={3} as="div">
          <div className={view.recipientsHead}>
            <h2>{tab === "all" ? copy.recipientsTitle : copy.tabs[tab]}</h2>
            {tab !== "all" && <StaffLink href={path}>{staffCopy.mailingPages.showEveryone}</StaffLink>}
          </div>
          {/* Sending finds who it goes to, so one scheduled lists who its filters find now. */}
          {scheduled && <Muted>{copy.recipientsNow}</Muted>}
          {
            <ListFrame
              count={copy.recipientsCount(data.recipientsTotal)}
              total={data.recipientsTotal}
              page={data.page}
              pages={data.pages}
              pageSize={data.pageSize}
              href={(n) => filtersPath(path, { tab: tab === "all" ? "" : tab, ...pageParam(n) })}
              columns={recipientColumns(summary)}
              rows={data.recipients}
              rowKey={(r) => r.copyId}
              empty={copy.noRecipients}
            />
          }
        </Card>
      </Grid>
    </div>
  );
}
