import { monthsAndYears } from "@/lib/dated-groups";
import type { MailingBase, MailingSummary } from "./records.server";
import { mailingsCopy } from "./copy";

/** A heading of the mailings page, and its mailings in order. */
export type MailingGroup<T extends MailingBase = MailingSummary> = { key: string; heading: string; mailings: T[] };

/** When a mailing went, for its group: its first letter sent, or else when it was due, or last changed. */
export function mailingWhen(mailing: MailingBase): Date {
  return mailing.sentAt ?? mailing.dueAt ?? mailing.updatedAt;
}

/** How long one done with stays under Just finished, from when it started sending, before it goes under its month. */
const JUST_FINISHED_MS = 24 * 60 * 60 * 1000;

/**
 * The groups of a list of mailings or of broadcasts, each in the order
 * given, and each left out with none in it: Scheduled; Sending; Drafts;
 * Just finished, those `done` (sent or stopped) that started sending in the
 * last day; then the rest of those done under their months and years
 * (monthsAndYears).
 */
export function mailingGroups<T extends MailingBase>(
  { scheduled, sending, drafts, done }: { scheduled: T[]; sending: T[]; drafts: T[]; done: T[] },
  now: Date,
): MailingGroup<T>[] {
  const words = mailingsCopy.mailingPages;
  const justFinished = done.filter((m) => m.sentAt && now.getTime() - m.sentAt.getTime() <= JUST_FINISHED_MS);
  const groups: MailingGroup<T>[] = [];
  const add = (key: string, heading: string, mailings: T[]) => {
    if (mailings.length > 0) groups.push({ key, heading, mailings });
  };
  add("scheduled", words.scheduled, scheduled);
  add("sending", words.sending, sending);
  add("drafts", words.drafts, drafts);
  add("just-finished", words.justFinished, justFinished);
  const older = done.filter((m) => !justFinished.includes(m));
  for (const { key, heading, items } of monthsAndYears(older, (mailing) => mailingWhen(mailing).toISOString(), now)) {
    groups.push({ key, heading, mailings: items });
  }
  return groups;
}
