import { monthsAndYears } from "@/lib/dated-groups";
import type { MailingBase, MailingSummary } from "./records.server";
import { mailingsCopy } from "./copy";

/** A heading of the mailings page, and its mailings in order. */
export type MailingGroup<T extends MailingBase = MailingSummary> = { key: string; heading: string; mailings: T[] };

/** When a mailing went, for its group: its first letter sent, or else when it was due, or last changed. */
export function mailingWhen(mailing: MailingBase): Date {
  return mailing.sentAt ?? mailing.dueAt ?? mailing.updatedAt;
}

/**
 * The mailings page's groups: Coming up, of those sending, then those
 * scheduled, soonest first, then the drafts, newest edited first; then
 * Recent, in the order given, where a list has one; then the rest under
 * their months and years (monthsAndYears). A list with Recent (broadcasts:
 * broadcastsPage) has each apart instead, in the order given: Scheduled;
 * Sending; Drafts; then Recent, headed Just finished.
 */
export function mailingGroups<T extends MailingBase>(
  {
    drafts,
    comingUp,
    sending = [],
    recent,
    sent,
  }: { drafts: T[]; comingUp: T[]; sending?: T[]; recent?: T[]; sent: T[] },
  now: Date,
): MailingGroup<T>[] {
  const coming = [...comingUp.filter((m) => m.state === "sending"), ...comingUp.filter((m) => m.state !== "sending")];
  const words = mailingsCopy.mailingPages;
  const groups: MailingGroup<T>[] = [];
  const add = (key: string, heading: string, mailings: T[]) => {
    if (mailings.length > 0) groups.push({ key, heading, mailings });
  };
  if (recent) {
    add("coming", words.scheduled, coming);
    add("sending", words.sending, sending);
    add("drafts", words.drafts, drafts);
    add("recent", words.recent, recent);
  } else {
    add("coming", words.comingUp, [...coming, ...drafts]);
  }
  for (const { key, heading, items } of monthsAndYears(sent, (mailing) => mailingWhen(mailing).toISOString(), now)) {
    groups.push({ key, heading, mailings: items });
  }
  return groups;
}
