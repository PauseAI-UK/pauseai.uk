/** The hour and minute of a moment in a time zone, on a 24-hour clock. */
function clockIn(iso: string, timeZone: string): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", minute: "numeric", hourCycle: "h23" })
    .formatToParts(new Date(iso))
    .reduce<Record<string, number>>((all, part) => ({ ...all, [part.type]: Number(part.value) }), {});
  return { hours: parts.hour, minutes: parts.minute };
}

/** "9" or "9.30", on a 12-hour clock, without am or pm. */
function clock({ hours, minutes }: { hours: number; minutes: number }): string {
  const hour = hours % 12 || 12;
  return minutes ? `${hour}.${String(minutes).padStart(2, "0")}` : String(hour);
}

const suffix = ({ hours }: { hours: number }) => (hours < 12 ? "am" : "pm");

/**
 * From when to when, as people say it in London: "6–9pm", "9.30am–1.30pm",
 * with am or pm once when both ends share it.
 */
export function timeRange(startAt: string, endAt: string, timeZone = "Europe/London"): string {
  const start = clockIn(startAt, timeZone);
  const end = clockIn(endAt, timeZone);
  const first = suffix(start) === suffix(end) ? clock(start) : `${clock(start)}${suffix(start)}`;
  return `${first}–${clock(end)}${suffix(end)}`;
}
