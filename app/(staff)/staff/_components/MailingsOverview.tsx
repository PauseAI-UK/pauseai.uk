import StaffLink from "./ui/StaffLink";
import Tag from "@/components/ui/Tag";
import { Muted } from "@/components/ui/Text";
import { askHref } from "@/lib/asks";
import { staffCopy } from "@/lib/content/staff-interface";
import type { ReactNode } from "react";
import type { MailingGroup } from "@/lib/mailing-groups";
import { mailingWhen } from "@/lib/mailing-groups";
import type { MailingBase, MailingSummary } from "@/lib/server/mailings";
import { named } from "@/lib/email-parsing/addresses";
import { londonWhenShort, staffDate } from "@/lib/staff-time";
import { countsOpening, type Count } from "./ui/Counts";
import { NeedsAndFine } from "./CopyCounts";
import { stateCounts } from "./CopyStatus";
import Empty from "./ui/Empty";
import Grid, { spanClass } from "./ui/Grid";
import Progress from "./ui/Progress";
import styles from "./MailingsOverview.module.css";

const copy = staffCopy.mailingPages;

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
  /** How one stands at its row's right, in place of a mailing's state, bar or counts, given where its row leads. */
  standing?: (mailing: T, href: string) => ReactNode;
};

/** How a list of mailings to politicians looks. */
const MAILINGS_LOOK: OverviewLook<MailingSummary> = {
  base: "/staff/mailings",
  counts: mailingCounts,
  untitled: copy.untitled,
  none: staffCopy.mailings.none,
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
 * How it stands, at a row's right, only what matters there: a draft's
 * Draft and how many it's to; one scheduled the same; one sending, its
 * bar; one sent, what needs a look, the rest folded behind how many are
 * fine.
 */
function Standing<T extends MailingBase>({ mailing, href, look }: { mailing: T; href: string; look: OverviewLook<T> }) {
  if (look.standing) return look.standing(mailing, href);
  if (mailing.state === "draft" || mailing.state === "scheduled") {
    return (
      <span className={styles.state}>
        <Tag tone={mailing.state === "scheduled" ? "blue" : undefined}>{copy.states[mailing.state]}</Tag>
        {copy.toCount(mailing.to)}
      </span>
    );
  }
  if (mailing.state === "sending") {
    return (
      <span className={styles.sending}>
        <StaffLink href={href} className={styles.bar}>
          <Progress value={mailing.sent + mailing.failed} max={mailing.to} tone="blue" label={copy.sentLabel}>
            {copy.sendingBar(mailing.sent, mailing.to)}
          </Progress>
        </StaffLink>
      </span>
    );
  }
  return <NeedsAndFine counts={countsOpening(href, look.counts(mailing))} />;
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
  // Its name, as a mail app shows it, before its address; with no name of its own, the address alone.
  const from =
    look.from?.(mailing) ??
    (mailing.imported
      ? (mailing.sentFrom ??
        mailing.fromName ??
        (mailing.oldLetters ? staffCopy.mailings.notRecorded : staffCopy.mailings.imported))
      : named(mailing.fromName === mailing.sentFrom ? null : mailing.fromName, mailing.sentFrom));
  // Mostly the policy inbox, so also who wrote it, where the look has no From of its own.
  const by = !look.from && mailing.createdBy ? copy.by(mailing.createdBy) : null;
  return (
    <li className={styles.row} data-pulse={pulse || undefined}>
      <span className={styles.when}>
        <When mailing={mailing} year={year} />
      </span>
      <span className={styles.what}>
        <span className={styles.head}>
          {look.mark?.(mailing)}
          <StaffLink href={href} className={styles.title}>
            {mailing.title || look.untitled}
          </StaffLink>
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
              {staffCopy.asks.askTo[mailing.askKind!]}{" "}
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
