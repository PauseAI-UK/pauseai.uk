import StaffLink from "../ui/StaffLink";
import { Muted } from "@/components/ui/Text";
import { askHref } from "@/lib/asks/asks";
import type { ReactNode } from "react";
import type { MailingGroup } from "@/lib/mailings/groups";
import { mailingWhen } from "@/lib/mailings/groups";
import type { MailingBase, MailingSummary } from "@/lib/mailings/records.server";
import { named } from "@/lib/email-parsing/addresses";
import { londonWhenShort, staffDate } from "@/lib/staff-time";
import { countsOpening, type Count } from "../ui/Counts";
import { NeedsAndFine } from "./CopyCounts";
import { stateCounts } from "./CopyStatus";
import Empty from "../ui/Empty";
import IconText from "../ui/IconText";
import Grid, { spanClass } from "../ui/Grid";
import Progress from "../ui/Progress";
import styles from "./MailingsOverview.module.css";
import { asksCopy } from "@/lib/asks/copy";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.mailingPages;

/**
 * How a mailing's letters stand, a count for each state (LETTER_STATES), in
 * the order it happens: what went, what came back, and what was marked as
 * spam; then what didn't go, the expected first. The same in the list and on
 * its page; a count of none isn't shown.
 */
export function mailingCounts(mailing: MailingSummary): Count[] {
  return stateCounts(mailing.states, ["sent", "replied", "answered", "spam", "not-sent", "error", "unreached"]);
}

/**
 * How a list's rows differ for what it lists: where a row leads, how one
 * sent went, what comes before who it's from, who it's from when not as an
 * email's sender is, and what one scheduled says.
 */
export type OverviewLook<T extends MailingBase> = {
  base: string;
  counts: (mailing: T) => Count[];
  untitled: string;
  none: string;
  /** A picture before the title: a broadcast's channel, telling emails and texts apart at a glance. */
  mark?: (mailing: T) => ReactNode;
  lead?: (mailing: T) => ReactNode;
  from?: (mailing: T) => string | undefined;
  /** Where one stands, as a sentence after a dot in its colour, where it has more to say than a mailing does. */
  sentence?: (mailing: T) => Sentence | undefined;
};

/** Where one stands in a list, as a sentence after a dot in its colour: red for something wrong, blue for going out, grey for normal. */
export type Sentence = { tone: "red" | "blue" | "grey"; text: string };

/** Where a mailing or a broadcast stands: a draft, scheduled, sending, stopped and how far it got, or sent, and to how many. */
function mailingSentence(mailing: MailingBase): Sentence {
  const words = copy.standing;
  if (mailing.state === "draft") return { tone: "grey", text: words.draft(mailing.to) };
  if (mailing.state === "scheduled") return { tone: "blue", text: words.scheduled(mailing.to) };
  if (mailing.state === "sending") return { tone: "blue", text: copy.sendingBar(mailing.sent, mailing.to) };
  if (mailing.state === "cancelled") return { tone: "grey", text: words.stopped(mailing.sent, mailing.to) };
  return { tone: "grey", text: words.sent(mailing.to) };
}

/** How a list of mailings to politicians looks. */
const MAILINGS_LOOK: OverviewLook<MailingSummary> = {
  base: "/staff/mailings",
  counts: mailingCounts,
  untitled: copy.untitled,
  none: mailingsCopy.mailings.none,
};

/**
 * When, at a row's left: when a draft was last saved; when one scheduled
 * goes, or one sending started, in blue, as it's going out; the day one
 * went, with its year when that's not `year`.
 */
function When({ mailing, year }: { mailing: MailingBase; year: string }) {
  if (mailing.state === "draft") return <Muted>{copy.savedAt(staffDate(mailing.updatedAt))}</Muted>;
  if (mailing.state === "scheduled" || mailing.state === "sending") {
    return <strong className={styles.due}>{londonWhenShort(mailing.dueAt!)}</strong>;
  }
  const day = staffDate(mailingWhen(mailing));
  return <>{day.endsWith(year) ? day.slice(0, -5) : day}</>;
}

/**
 * How it stands, at a row's right: its sentence after its dot; while
 * sending, the sentence over the bar of how far it's got, no dot, as the bar
 * says it, the bar leading to it; and once any went, what needs a look, the
 * rest folded behind how many are fine.
 */
function Standing<T extends MailingBase>({ mailing, href, look }: { mailing: T; href: string; look: OverviewLook<T> }) {
  const { tone, text } = look.sentence?.(mailing) ?? mailingSentence(mailing);
  return (
    <span className={styles.stands}>
      {mailing.state === "sending" ? (
        <StaffLink href={href} className={styles.bar}>
          <Progress value={mailing.sent + mailing.failed} max={mailing.to} tone="blue" label={copy.sentLabel}>
            <span className={styles.sentence}>{text}</span>
          </Progress>
        </StaffLink>
      ) : (
        <span className={styles.sentence}>
          <i className={styles.dot} data-tone={tone} aria-hidden="true" />
          {text}
        </span>
      )}
      {mailing.state !== "draft" && mailing.state !== "scheduled" && (
        <NeedsAndFine counts={countsOpening(href, look.counts(mailing))} />
      )}
    </span>
  );
}

/**
 * One mailing, a row: when; its title, leading to it, over who it's from,
 * name and address, the staff member who wrote it, and its ask; how it stands.
 */
function Row<T extends MailingBase>({
  mailing,
  year,
  look,
  pulse,
}: {
  mailing: T;
  year: string;
  look: OverviewLook<T>;
  pulse: boolean;
}) {
  const href = `${look.base}/${mailing.id}`;
  const title = (
    <StaffLink href={href} className={styles.title}>
      {mailing.title || look.untitled}
    </StaffLink>
  );
  // Its name, as a mail app shows it, before its address; with no name of its own, the address alone.
  const from =
    look.from?.(mailing) ??
    (mailing.imported
      ? (mailing.sentFrom ??
        mailing.fromName ??
        (mailing.oldLetters ? mailingsCopy.mailings.notRecorded : mailingsCopy.mailings.imported))
      : named(mailing.fromName === mailing.sentFrom ? null : mailing.fromName, mailing.sentFrom));
  // Mostly the policy inbox, so also who wrote it, where the look has no From of its own.
  const by = !look.from && mailing.createdBy ? copy.by(mailing.createdBy) : null;
  return (
    <li className={styles.row} data-pulse={pulse || undefined}>
      <span className={styles.when}>
        <When mailing={mailing} year={year} />
      </span>
      <span className={styles.what}>
        {/* A list with a mark has it before each title, as an icon is before words (IconText). */}
        <span className={styles.head}>
          {look.mark ? <IconText icon={look.mark(mailing)}>{title}</IconText> : title}
        </span>
        <Muted>
          {look.lead?.(mailing)}
          {look.lead && from ? " · " : ""}
          {from}
          {by && (
            <>
              {from ? " · " : ""}
              {by}
            </>
          )}
          {mailing.ask && (
            <>
              {from || by ? " · " : ""}
              {asksCopy.asks.askTo[mailing.askKind!]}{" "}
              <StaffLink href={askHref(mailing.ask)}>{mailing.askTitle}</StaffLink>
            </>
          )}
        </Muted>
      </span>
      <span className={styles.standing}>
        <Standing mailing={mailing} href={href} look={look} />
      </span>
    </li>
  );
}

/**
 * The list of mailings, in its groups (mailingGroups): what's coming up,
 * then the months and years of those sent, each mailing a row that shows
 * only what matters at its stage. Nothing on it changes a mailing: that's
 * done on the mailing's own page, on purpose. It's as wide as the grid,
 * not the window.
 */
export default function MailingsOverview<T extends MailingBase = MailingSummary>({
  groups,
  now,
  look = MAILINGS_LOOK as unknown as OverviewLook<T>,
  pulse,
}: {
  groups: MailingGroup<T>[];
  now: string;
  look?: OverviewLook<T>;
  /** The one to draw the eye to, just changed on its own page. */
  pulse?: number;
}) {
  if (groups.length === 0) return <Empty>{look.none}</Empty>;
  const year = now.slice(0, 4);
  // On the grid, all of its row, so the page is no wider than the grid's six columns.
  return (
    <Grid>
      <div className={spanClass(6)}>
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`mailings-${group.key}`} className={styles.group}>
            <h2 id={`mailings-${group.key}`}>{group.heading}</h2>
            <ul className={styles.rows}>
              {group.mailings.map((mailing) => (
                <Row key={mailing.id} mailing={mailing} year={year} look={look} pulse={mailing.id === pulse} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Grid>
  );
}
