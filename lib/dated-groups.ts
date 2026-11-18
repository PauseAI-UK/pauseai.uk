import { londonDayTime } from "./staff-time";

/** A heading of a list, and its items in order. */
export type DatedGroup<T> = { key: string; heading: string; items: T[] };

/** The month, "yyyy-mm", eleven months before `month`'s. */
function elevenBefore(month: string): string {
  const months = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 - 11;
  return `${Math.floor(months / 12)}-${String((months % 12) + 1).padStart(2, "0")}`;
}

/**
 * Things that happened, newest first, under their month for the twelve
 * months to `now`'s, and under their year before that, by `when`, an ISO
 * string: a time, or a day alone. A month or year with none has no heading.
 * Days are London's, as staffDate reads them. Those with no time, an empty
 * string, go last under an empty heading.
 */
export function monthsAndYears<T>(items: readonly T[], when: (item: T) => string, now: Date): DatedGroup<T>[] {
  const months = elevenBefore(londonDayTime(now).day.slice(0, 7));
  const groups: DatedGroup<T>[] = [];
  for (const item of [...items].sort((a, b) => when(b).localeCompare(when(a)))) {
    // A day alone is midnight in UTC, which is the same day in London.
    const at = when(item);
    const month = at && londonDayTime(new Date(at)).day.slice(0, 7);
    const byMonth = month >= months;
    const key = byMonth ? month : month.slice(0, 4);
    const heading = byMonth
      ? new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
      : key;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, heading, items: [item] });
  }
  return groups;
}
