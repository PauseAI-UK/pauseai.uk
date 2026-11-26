import type { ReactNode } from "react";
import Tag from "@/components/ui/Tag";
import { Muted } from "@/components/ui/Text";
import type { WrittenBroadcast } from "@/lib/broadcasts/drafts.server";
import type { LinkCard } from "@/lib/broadcasts/link-card";
import type { BroadcastPageData, BroadcastSummary, MessageRecipient } from "@/lib/broadcasts/pages.server";
import { filtersPath, pageParam, type Params } from "@/lib/list-params";
import { londonWhen, londonWhenShort, sendsAt, staffClock, staffDate, staffTime } from "@/lib/staff-time";
import { now } from "@/lib/now";
import type { FormResult } from "@/lib/form-result";
import { staffMemberText } from "@/lib/staff-member";
import {
  FIELD_WORDS,
  RECIPIENT_SORTS,
  type BroadcastChannel,
  type RecipientSort,
  type SendingPause,
  sendingStopsAt,
} from "@/lib/broadcasts/broadcasts";
import Bubble from "@/components/ui/Bubble";
import { buttonClass } from "@/components/ui/Button";
import { ChangeTimesForm } from "./BroadcastTimes";
import { sortHref, type SortSpec } from "@/lib/staff-sort";
import Strip from "../ui/Strip";
import { phoneWords } from "@/lib/phone";
import ChannelIcon from "@/components/ui/ChannelIcon";
import IconText from "../ui/IconText";
import MailEmail from "../mailings/MailEmail";
import MailingFiles from "../mailings/MailingFiles";
import { MailingLetter } from "../mailings/MailingLetter";
import { CopyMailing, ResumeBroadcast } from "../mailings/MailingButtons";
import { fromDetail, MailingStanding, MailingWhen } from "../mailings/MailingView";
import WrittenText from "./WrittenText";
import Band, { BandFact } from "../ui/Band";
import { countsFiltering, type Count } from "../ui/Counts";
import { CountGroups } from "../mailings/CopyCounts";
import { CopyStatus, stateCounts, wentAndGone } from "../letters/CopyStatus";
import Grid, { Card } from "../ui/Grid";
import ListFrame, { type ListColumn } from "../ui/ListFrame";
import SortHeading from "../ui/SortHeading";
import StaffLink from "../ui/StaffLink";
import view from "../mailings/MailingView.module.css";
import styles from "./Broadcasts.module.css";
import { supportersCopy } from "../supporters/copy";
import { mailingsCopy } from "../mailings/copy";
import { lettersCopy } from "../letters/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

const copy = broadcastsCopy.broadcastPages;

/** A broadcast's Server Action that a form sends, refused for a broadcast that's gone or has moved on. */
export type BroadcastAction = (form: FormData) => Promise<FormResult<"gone">>;

/** Change the times', refused for times that have passed too. */
export type RetimeAction = (form: FormData) => Promise<FormResult<"gone" | "too-soon">>;

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
      // One waiting for WhatsApp's approval has its own strip (BroadcastWaiting).
      return copy.waiting(pause.reason === "pull" ? "pull" : "civicrm", staffDate(pause.endsAt), pause.said);
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
 * the button that sets it going again. A text scheduled while WhatsApp hasn't approved its template says so in
 * blue, with a clock, before its time or after, and who sent it when. Nothing otherwise.
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
  // The variant WhatsApp is reviewing, either of its template's.
  const template = [written.variant, written.textVersion?.variant].find((one) => one?.status === "pending");
  if (written.state === "scheduled" && template) {
    return (
      <Strip tone="blue" waiting>
        {copy.approvalStrip(
          staffMemberText(template.createdBy!),
          staffTime(template.requestedAt),
          new Date(written.dueAt!) <= now(),
        )}
      </Strip>
    );
  }
  if (written.gaveUp) {
    const stopped = {
      limit: copy.gaveUpLimit,
      template: copy.gaveUpTemplate,
      late: copy.gaveUpLate,
      approval: copy.gaveUpApproval,
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

/**
 * A recipient's columns: who, and where they are; how it went, and the way
 * to their copy's page; then when it last changed, which a phone shows
 * under how it went, in place of the column. With `sorting`, the
 * list's URL and its sort, who and when are headings that sort by them
 * (RECIPIENT_SORTS), keeping the tab.
 */
function recipientColumns(
  broadcast: BroadcastSummary,
  sorting?: { path: string; tab: string; current: SortSpec<RecipientSort> },
): ListColumn<MessageRecipient>[] {
  const sorts = (key: RecipientSort, label: string) =>
    sorting && {
      heading: (
        <SortHeading
          key={key}
          sortKey={key}
          current={sorting.current}
          href={sortHref(sorting.path, { tab: sorting.tab }, RECIPIENT_SORTS, sorting.current, key)}
        >
          {label}
        </SortHeading>
      ),
    };
  return [
    {
      key: "who",
      label: copy.columns.who,
      ...sorts("who", copy.columns.who),
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
            {/* On a phone, which has no room for the last column (Broadcasts.module.css). */}
            {r.changedAt && (
              <span className={styles.changedUnder}>
                <Muted>{staffTime(r.changedAt)}</Muted>
              </span>
            )}
            {r.heldTill && <Muted>{copy.heldTill(staffTime(sendsAt(r.heldTill)))}</Muted>}
            {copyWent(r) && (
              <StaffLink href={`/staff/broadcasts/${broadcast.id}/${r.copyId}`}>{copy.threadLink}</StaffLink>
            )}
          </span>
        );
      },
    },
    {
      key: "changed",
      label: copy.columns.changed,
      short: true,
      ...sorts("changed", copy.columns.changed),
      cell: (r) => r.changedAt && staffTime(r.changedAt),
    },
  ];
}

/** The email as a mail app shows it, or the text as a bubble, with its fields as chips. */
function BroadcastWords({
  written,
  parts,
  realMaps,
  cards,
}: {
  written: WrittenBroadcast;
  parts: Record<string, string>;
  realMaps: boolean;
  /** A text's link cards, by the address each is for. */
  cards: Record<string, LinkCard | null>;
}) {
  if (written.channel === "text") {
    return (
      <Card span={3} look="aside" title={copy.textTitle} id="words-title">
        <WrittenText
          written={written}
          labels={parts}
          time={staffClock(sendsAt(written.dueAt!))}
          realMaps={realMaps}
          cards={cards}
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
  copyIt,
}: {
  data: Extract<BroadcastPageData, { kind: "written" }>;
  /** Who else it was for, as pills, or everyone who said yes (BroadcastWho). */
  who: ReactNode;
  /** What they all said yes to (BroadcastContact), under who. */
  contact: ReactNode;
  stop: BroadcastAction;
  reschedule: RetimeAction;
  /** Sets one going again that stopped as it hadn't all gone in time. */
  resume: BroadcastAction;
  /** Copy broadcast, at its top right. */
  copyIt?: BroadcastAction;
}) {
  const { summary, tab } = data;
  // All sent but for delayed emails, it's shown as sending, waiting on them (withPause), with Give up to stop
  // waiting, as Postmark's tries can't be stopped.
  const delayed = summary.pause?.kind === "delayed";
  const written = delayed ? { ...data.written, state: "sending" as const } : data.written;
  const path = `/staff/broadcasts/${written.id}`;
  const scheduled = written.state === "scheduled";
  // What the recipients' links keep of the URL: the tab, and the sort where it isn't the list's own.
  const shown = tab === "all" ? "" : tab;
  const own = data.sort.key === "who" && data.sort.dir === RECIPIENT_SORTS.who;
  const sorted: Params = own ? {} : { sort: data.sort.key, dir: data.sort.dir };
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
        corner={
          copyIt && (
            <CopyMailing
              id={written.id}
              label={copy.copyBroadcast}
              action={copyIt}
              says={copy.refusals.copy}
              atTop={["gone"]}
            />
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
        {/* While it's still trying: scheduled, sending, or all sent but for emails still delayed. */}
        {(scheduled || written.state === "sending") && (
          <BandFact label={copy.keepsTryingUntil}>
            {/* As the fact before it says its time: as the sending's run once scheduled, as it is once sending. */}
            {(scheduled ? (at: Date) => londonWhen(at, "short") : staffTime)(
              sendingStopsAt({ dueAt: written.dueAt!, finishMinutes: written.finishMinutes }),
            )}
          </BandFact>
        )}
      </Band>
      <MailingStanding
        mailing={summary}
        written={written}
        stop={{ action: stop, says: copy.refusals.stop, atTop: ["gone"] }}
        stopLabel={delayed ? copy.giveUp : undefined}
        changeTimes={
          // Not for one all sent, whose delayed emails' time has passed for staff to change.
          !delayed && (
            <Bubble id="change-times" trigger={buttonClass({ variant: "ghost", fit: true })} label={copy.changeTimes}>
              <ChangeTimesForm
                id={written.id}
                dueAt={written.dueAt!}
                finishMinutes={written.finishMinutes}
                scheduled={scheduled}
                action={reschedule}
              />
            </Bubble>
          )
        }
        line={copy.scheduledLine(summary.to, written.channel, written.fromName || written.sentFrom!)}
        // Past its time, what it waits for, in place of how long till it goes.
        due={
          summary.pause?.kind === "waiting" && summary.pause.reason === "approval"
            ? copy.standing.waiting
            : summary.pause
              ? copy.waitingDue
              : undefined
        }
        paused={summary.pause ? copy.paused.bar(summary.sent + summary.failed, summary.to) : undefined}
      />
      <BroadcastWaiting
        written={written}
        pause={summary.pause}
        resume={<ResumeBroadcast id={written.id} action={resume} says={copy.refusals.resume} atTop={["gone"]} />}
      />
      <Grid>
        <BroadcastWords written={written} parts={data.parts} realMaps={data.realMaps} cards={data.cards} />
        <Card span={3} as="div">
          <div className={view.recipientsHead}>
            <h2>{tab === "all" ? copy.recipientsTitle : lettersCopy.copyStates.tabs[tab]}</h2>
            {tab !== "all" && <StaffLink href={path}>{mailingsCopy.mailingPages.showEveryone}</StaffLink>}
          </div>
          {/* Sending finds who it goes to, so one scheduled lists who its filters find now. */}
          {scheduled && <Muted>{copy.recipientsNow}</Muted>}
          <div className={styles.recipients}>
            <ListFrame
              count={copy.recipientsCount(data.recipientsTotal)}
              total={data.recipientsTotal}
              page={data.page}
              pages={data.pages}
              pageSize={data.pageSize}
              href={(n) => filtersPath(path, { tab: shown, ...sorted, ...pageParam(n) })}
              // One scheduled has no copies yet, so nothing to sort by but who.
              columns={recipientColumns(summary, scheduled ? undefined : { path, tab: shown, current: data.sort })}
              rows={data.recipients}
              rowKey={(r) => r.copyId}
              empty={copy.noRecipients}
            />
          </div>
        </Card>
      </Grid>
    </div>
  );
}
