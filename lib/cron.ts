// When a cron runs next, for the schedules Netlify's scheduled functions
// use (netlify/functions/<job>/): five fields, minute, hour, day of the
// month, month and day of the week, in UTC. A field is *, a number, a range
// (2-59), any of those stepped (*/5, 2-59/5), or a list of them
// (3,18,33,48).

const MINUTE = 60_000;

/** The fields' bounds, in order. */
const FIELDS = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
] as const;

/** The values a field allows, between `low` and `high`. */
function allowed(field: string, low: number, high: number): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [range, step = "1"] = part.split("/");
    const [from, to] = range === "*" ? [low, high] : range.split("-").map(Number);
    // A number stepped runs to the end: 5/15 is 5, 20, 35, 50.
    const end = to ?? (part.includes("/") ? high : from);
    for (let value = from; value <= end; value += Number(step)) values.add(value);
  }
  return values;
}

/**
 * The first minute after `after` that `cron` runs at. Throws for a cron
 * that isn't five fields, or doesn't run within a year.
 */
export function nextCronRun(cron: string, after: Date): Date {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== FIELDS.length) throw new Error(`Not a cron: ${cron}`);
  const [minutes, hours, days, months, weekdays] = fields.map((field, i) => allowed(field, FIELDS[i][0], FIELDS[i][1]));
  let at = Math.floor(after.getTime() / MINUTE) * MINUTE + MINUTE;
  for (const end = at + 366 * 24 * 60 * MINUTE; at < end; at += MINUTE) {
    const t = new Date(at);
    if (
      minutes.has(t.getUTCMinutes()) &&
      hours.has(t.getUTCHours()) &&
      days.has(t.getUTCDate()) &&
      months.has(t.getUTCMonth() + 1) &&
      weekdays.has(t.getUTCDay())
    ) {
      return t;
    }
  }
  throw new Error(`Never runs: ${cron}`);
}
