import type { ReactNode } from "react";
import Tag from "@/components/ui/Tag";
import { Muted } from "@/components/ui/Text";
import type { WrittenBroadcast } from "@/lib/broadcasts/drafts.server";
import type { BroadcastPageData, BroadcastSummary, MessageRecipient } from "@/lib/broadcasts/pages.server";
import { filtersPath, pageParam } from "@/lib/list-params";
import { londonWhenShort, sendsAt, staffClock, staffDate, staffTime } from "@/lib/staff-time";
import { FIELD_WORDS, type BroadcastChannel, type SendingPause } from "@/lib/broadcasts/broadcasts";
import { TEMPLATE_FOOTER } from "@/lib/broadcasts/whatsapp-template";
import Strip from "../ui/Strip";
import { phoneWords } from "@/lib/phone";
import ChannelIcon from "@/components/ui/ChannelIcon";
import IconText from "../ui/IconText";
import MailEmail from "../mailings/MailEmail";
import MailingFiles from "../mailings/MailingFiles";
import { MailingLetter } from "../mailings/MailingLetter";
import { ResumeBroadcast } from "../mailings/MailingButtons";
import { fromDetail, MailingStanding, MailingWhen } from "../mailings/MailingView";
import TextBubble from "./TextBubble";
import Band, { BandFact } from "../ui/Band";
import { countsFiltering, type Count } from "../ui/Counts";
import { CountGroups } from "../mailings/CopyCounts";
import { CopyStatus, stateCounts, wentAndGone } from "../letters/CopyStatus";
import Grid, { Card } from "../ui/Grid";
import ListFrame, { type ListColumn } from "../ui/ListFrame";
import StaffLink from "../ui/StaffLink";
import view from "../mailings/MailingView.module.css";
import styles from "./Broadcasts.module.css";
import { supportersCopy } from "../supporters/copy";
import { mailingsCopy } from "../mailings/copy";
import { lettersCopy } from "../letters/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

const copy = broadcastsCopy.broadcastPages;

type FormAction = (form: FormData) => void | Promise<void>;

/**
 * A broadcast's channel as an icon before its title (IconText), for a list
 * where emails and texts must tell apart at a glance. Named, as the list's
 * line under the title may not say it.
 */
export function BroadcastChannelMark({ channel }: { channel: BroadcastChannel }) {
  return <ChannelIcon channel={channel} label={copy.channels[channel]} size={18} />;
}

/**
 * How its copies stand, a count for each state (COPY_STATES), in the order
 * it happens: what went and arrived, what was read and replied to, what's
 * to check, who opted out because of it; then what's still to go; then what
 * didn't go, the expected first. Each is the colour of its recipients'
 * tags. Only texts are said to be read, so an email's read is none, and a
 * count of none isn't shown.
 */
export function broadcastCounts(broadcast: BroadcastSummary): Count[] {
  return stateCounts(broadcast.states, [
    "sent",
    "delivered",
    "read",
    "replied",
    "look",
    "opted-out",
    // Those still to go: waiting their turn, then delayed.
    "to-go",
    "held",
    // Those that didn't go: not sent, as expected, first; then what went wrong.
    "not-sent",
    "error",
    "unreached",
  ]);
}

/**
 * A pause in a few words, for the list of broadcasts and over a
 * broadcast's bar: the word for it, and what it waits for or till when, as
 * the sending's next run after then, in London, with the day for one days off.
 */
export function pauseInBrief(pause: SendingPause): { word: string; till: string } {
  const words = copy.paused;
  switch (pause.kind) {
    case "waiting":
      return { word: words.word, till: words.forCiviCrm };
    case "resting":
      return { word: words.word, till: words.till(staffClock(sendsAt(pause.until))) };
    case "held":
      return { word: words.word, till: words.till(londonWhenShort(pause.until)) };
    case "limit":
      return { word: words.word, till: words.tillTomorrow };
    case "delayed":
      return { word: words.word, till: words.forDelayed };
  }
}

/** A pause in full, as its strip says it on a broadcast's page: till when as the sending's next run after then, as pauseInBrief says it. */
function pauseInFull(pause: SendingPause): string {
  switch (pause.kind) {
    case "waiting":
      return copy.waiting(pause.reason, staffDate(pause.endsAt), pause.said);
    case "resting":
      return copy.resting(staffTime(sendsAt(pause.until)));
    case "held":
      // When, as each held recipient's row under it says its own.
      return copy.heldLeft(pause.held, staffTime(sendsAt(pause.until)), staffDate(pause.stopsAt));
    case "limit":
      return pause.channel === "text" ? copy.moreTomorrowText : copy.moreTomorrow;
    case "delayed":
      return copy.delayedLeft(pause.delayed, staffDate(pause.stopsAt));
  }
}

/**
 * Why nothing of a broadcast is going out for now (`pause`), in full, each
 * the same amber strip with a clock: it waits for CiviCRM, why and when
 * that stops; it rests after its sends failed, till when; all it has left
 * are texts WhatsApp held, the next tried when; or what sends it sends more
 * tomorrow; or, all sent, some emails are delayed. Or, in red, that it stopped by itself, and why, with `resume`,
 * the button that sets it going again. Nothing otherwise.
 */
export function BroadcastWaiting({
  written,
  pause,
  resume,
}: {
  written: WrittenBroadcast;
  pause: SendingPause | null;
  resume?: ReactNode;
}) {
  if (written.gaveUp) {
    const stopped = {
      limit: copy.gaveUpLimit,
      template: copy.gaveUpTemplate,
      late: copy.gaveUpLate,
      failing: copy.gaveUpFailing,
    }[written.waitReason as string];
    return (
      <Strip tone="red" action={resume}>
        {stopped ?? copy.gaveUp}
      </Strip>
    );
  }
  return pause ? (
    <Strip tone="amber" waiting>
      {pauseInFull(pause)}
    </Strip>
  ) : null;
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
            <StaffLink href={`/staff/supporters/${r.supporterId}`}>
              {r.name ?? supportersCopy.supporters.noName}
            </StaffLink>
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
        return (
          <span className={styles.stack}>
            <CopyStatus copyOf={r} />
            {r.sentAt && <Muted>{staffDate(r.sentAt)}</Muted>}
            {r.heldTill && <Muted>{copy.heldTill(staffTime(sendsAt(r.heldTill)))}</Muted>}
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
function BroadcastWords({ written, parts }: { written: WrittenBroadcast; parts: Record<string, string> }) {
  if (written.channel === "text") {
    return (
      <Card span={3} look="aside" title={copy.textTitle} id="words-title">
        <TextBubble
          words={{ content: written.body.content.filter((block) => block.type !== "onlyFor") }}
          footer={written.template?.footer ?? TEMPLATE_FOOTER}
          time={staffClock(sendsAt(written.dueAt!))}
        />
      </Card>
    );
  }
  return (
    <Card span={3} look="aside" title={copy.emailTitle} id="words-title">
      <MailEmail
        from={written.fromName ? `${written.fromName} <${written.sentFrom}>` : written.sentFrom}
        to={<Muted>{mailingsCopy.mailingPages.toEach}</Muted>}
        subject={written.subject}
      >
        <MailingLetter doc={written.body} fields={FIELD_WORDS} conditions={parts} />
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
  resume,
}: {
  data: Extract<BroadcastPageData, { kind: "written" }>;
  /** Who else it was for, as pills, or everyone who said yes (BroadcastWho). */
  who: ReactNode;
  /** What they all said yes to (BroadcastContact), under who. */
  contact: ReactNode;
  stop: FormAction;
  reschedule: FormAction;
  /** Sets one going again that stopped as it hadn't all gone in time. */
  resume: FormAction;
}) {
  const { summary, tab } = data;
  // All sent but for delayed emails, it's shown as sending, waiting on them (withPause), with nothing to stop.
  const delayed = summary.pause?.kind === "delayed";
  const written = delayed ? { ...data.written, state: "sending" as const } : data.written;
  const path = `/staff/broadcasts/${written.id}`;
  const scheduled = written.state === "scheduled";
  const groups = wentAndGone(
    countsFiltering(path, broadcastCounts(summary), tab, mailingsCopy.mailingPages.showEveryone),
  );
  return (
    <div className={view.page}>
      <Band
        title={
          // The icon's a picture alone: the facts say the channel in words, in what they said yes to and what sends it.
          <IconText tall icon={<ChannelIcon channel={written.channel} size="1em" />}>
            {written.title || copy.untitled}
          </IconText>
        }
        tag={
          written.state === "sending" ? undefined : (
            <Tag tone={scheduled ? "blue" : undefined}>{mailingsCopy.mailingPages.states[written.state]}</Tag>
          )
        }
        aside={!scheduled && <CountGroups groups={groups} />}
      >
        {/* What sends it is said under who it's from, so it takes no fact of its own. */}
        <BandFact
          label={copy.facts.from}
          detail={fromDetail(
            written.fromName,
            written.channel === "text"
              ? mailingsCopy.mailingPages.sendFacts.whatsApp
              : mailingsCopy.mailingPages.sendBy.names[written.sendBy],
          )}
        >
          {written.channel === "text" ? phoneWords(written.sentFrom!) : written.sentFrom}
        </BandFact>
        <BandFact label={copy.facts.to(summary.to)} detail={contact} tall>
          {who}
        </BandFact>
        <MailingWhen mailing={summary} written={written} />
      </Band>
      <MailingStanding
        mailing={summary}
        written={written}
        stop={stop}
        stoppable={!delayed}
        reschedule={reschedule}
        line={copy.scheduledLine(summary.to, written.channel, written.fromName || written.sentFrom!)}
        due={summary.pause ? copy.waitingDue : undefined}
        paused={summary.pause ? copy.paused.bar(summary.sent + summary.failed, summary.to) : undefined}
      />
      <BroadcastWaiting
        written={written}
        pause={summary.pause}
        resume={<ResumeBroadcast id={written.id} action={resume} />}
      />
      <Grid>
        <BroadcastWords written={written} parts={data.parts} />
        <Card span={3} as="div">
          <div className={view.recipientsHead}>
            <h2>{tab === "all" ? copy.recipientsTitle : lettersCopy.copyStates.tabs[tab]}</h2>
            {tab !== "all" && <StaffLink href={path}>{mailingsCopy.mailingPages.showEveryone}</StaffLink>}
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
