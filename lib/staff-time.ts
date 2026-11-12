import { now } from "./now";

/** The day something happened, for a heading over that day's runs: "3 Nov 2026", in UTC. */
export function staffDate(at: Date): string {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** When something happened, for the staff pages: the day as staffDate says it, and the time to the minute, in UTC. "16 Oct 2026, 10:34". */
export function staffTime(at: Date): string {
  return `${staffDate(at)}, ${staffClock(at)}`;
}

/** A date as staffDate or staffTime writes it, wherever it is in some words. */
const DATE_IN_WORDS = /\d{1,2} [A-Z][a-z]+ \d{4}(?:, \d{2}:\d{2})?/g;

/**
 * Words with each date in them held together, so a line that wraps never
 * breaks inside one: the date's spaces are no-break spaces. For a date in
 * a sentence in a table's cell; a date on its own there is a When
 * (ui/When.tsx).
 */
export function datesHeldTogether(words: string): string {
  return words.replace(DATE_IN_WORDS, (date) => date.replaceAll(" ", " "));
}

/** The time of day, to the minute, in UTC, for a row under a heading that gives the day. "10:34". */
export function staffClock(at: Date): string {
  return new Date(at).toISOString().slice(11, 16);
}

/** The day as a heading reads it: weekday, day and month, in UTC. "Friday 16 October". */
export function staffDay(at: Date): string {
  return new Date(at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/** The day, as yyyy-mm-dd, and the hour, in London, of a moment: what a mailing's When says. */
export function londonDayHour(at: Date): { day: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(at))
      .map((part) => [part.type, part.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** The moment that's `hour` o'clock on `day` (yyyy-mm-dd) in London. */
export function fromLondon(day: string, hour: number): Date {
  const guess = Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
  // London is never behind UTC: the guess, or an hour before it in summer time.
  const summer = londonDayHour(new Date(guess)).hour !== hour;
  return new Date(guess - (summer ? 3_600_000 : 0));
}

/**
 * When the hourly sending runs, in UTC: at this minute past each hour from
 * the first to the end of the day (netlify/functions/send-mailings, whose
 * test checks its schedule says the same).
 */
export const SENDING = { minute: 18, firstHour: 6 };

/** The moment a mailing due at `at`, a whole hour, goes: that hour's run of the sending, or overnight the day's first. */
export function sendsAt(at: Date): Date {
  const sends = new Date(at);
  sends.setUTCHours(Math.max(sends.getUTCHours(), SENDING.firstHour), SENDING.minute);
  return sends;
}

/** The time of day, in London, to the minute: "09:18". */
export function londonClock(at: Date): string {
  return new Date(at).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** When a mailing due at `at` goes, in London: "Thursday 30 October at 09:18", or `short`, "Thu 30 Oct at 09:18". */
export function londonWhen(at: Date, length: "long" | "short" = "long"): string {
  const sends = sendsAt(at);
  const day = sends.toLocaleDateString("en-GB", {
    weekday: length,
    day: "numeric",
    month: length,
    timeZone: "Europe/London",
  });
  return `${day} at ${londonClock(sends)}`;
}

/** The same, short, for a list's row: "Fri 30 Oct, 09:18". */
export function londonWhenShort(at: Date): string {
  const sends = sendsAt(at);
  const day = sends.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });
  return `${day}, ${londonClock(sends)}`;
}

/** The day something happens in London, for the staff pages: "27 Oct 2026". */
export function londonDate(at: Date): string {
  return new Date(at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

/** When something starts, in London, for an email: "Fri 30 Oct 2026, 19:00". */
export function londonStart(at: Date): string {
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Date(at).toLocaleDateString("en-GB", { ...options, timeZone: "Europe/London" });
  return `${part({ weekday: "short" })} ${part({ day: "numeric", month: "short", year: "numeric" })}, ${londonClock(at)}`;
}

/** How close to its hour's run of the sending is too close for a mailing to go on it. */
const TOO_SOON = 5 * 60_000;

/**
 * The first whole hour a mailing can be due at: one whose run of the sending
 * (sendsAt) is at least TOO_SOON away, so at 15:05 it's 15:00, which goes at
 * 15:18. London's hours start when UTC's do. By the site's clock
 * (lib/now.ts), so in a fixture build a page rendered ahead of time offers
 * the hours the browser does.
 */
export function earliestHour(): Date {
  const hour = 3_600_000;
  return new Date(Math.ceil((now().getTime() + TOO_SOON - SENDING.minute * 60_000) / hour) * hour);
}

/** `hour` on `day`, unless that's the first day a mailing can go and the hour is sooner than the first it can go at, when it's that. */
export function hourNotTooSoon(day: string, hour: number, earliest: { day: string; hour: number }): number {
  return day === earliest.day && hour < earliest.hour ? earliest.hour : hour;
}
