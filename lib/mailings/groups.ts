import { monthsAndYears } from "@/lib/dated-groups";
import type { MailingBase, MailingSummary } from "./records";
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
 * the rest under their months and years (monthsAndYears).
 */
export function mailingGroups<T extends MailingBase>(
  { drafts, comingUp, sent }: { drafts: T[]; comingUp: T[]; sent: T[] },
  now: Date,
): MailingGroup<T>[] {
  const coming = [...comingUp.filter((m) => m.state === "sending"), ...comingUp.filter((m) => m.state !== "sending")];
  const groups: MailingGroup<T>[] = [];
  if (coming.length + drafts.length > 0) {
    groups.push({ key: "coming", heading: mailingsCopy.mailingPages.comingUp, mailings: [...coming, ...drafts] });
  }
  for (const { key, heading, items } of monthsAndYears(sent, (mailing) => mailingWhen(mailing).toISOString(), now)) {
    groups.push({ key, heading, mailings: items });
  }
  return groups;
}
