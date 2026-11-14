import "server-only";
import { query } from "@/lib/server/db.server";
import { SERIES_POINTS, type Count, type SeriesPoint, type Span } from "./dashboard";

// How the dashboard's tiles count: each metric's rows, counted in the window
// and the window before it, and in windows of the same length for a
// sparkline. Each group of tiles says its own metrics' rows.

/**
 * A metric's rows: a table with a condition, the column that dates them,
 * and what's counted in each window, one row each unless it says. Each
 * counts what its tile's list shows (METRIC_LINKS), a person or a
 * politician once.
 */
export type MetricSource = { from: string; at: string; count?: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** What a metric counts, as SQL. */
export const counted = ({ count }: MetricSource) => `count(${count ?? "*"})::int`;

/** Each metric's count in the window and in the window before it, in one query. */
export async function windowCounts<M extends string>(
  sources: Record<M, MetricSource>,
  { since, before, until }: Span,
): Promise<Record<M, Count>> {
  // $1 is the window's start, $2 the window before's, $3 now; the window runs up to now, and includes it.
  const columns = Object.entries<MetricSource>(sources)
    .map(
      ([metric, source]) =>
        `(SELECT ${counted(source)} FROM ${source.from} AND ${source.at} >= $1 AND ${source.at} <= $3) AS "${metric}_current",
       (SELECT ${counted(source)} FROM ${source.from} AND ${source.at} >= $2 AND ${source.at} < $1) AS "${metric}_previous"`,
    )
    .join(",\n");
  const [row] = await query<Record<string, number>>(`SELECT ${columns}`, [since, before, until]);
  return Object.fromEntries(
    Object.keys(sources).map((metric) => [
      metric,
      { current: row[`${metric}_current`], previous: row[`${metric}_previous`] },
    ]),
  ) as Record<M, Count>;
}

/** SERIES_POINTS windows of `days` ending `until`, oldest first: how many of `source` fell in each. */
export async function series(
  source: MetricSource,
  { until, days }: Pick<Span, "until" | "days">,
): Promise<SeriesPoint[]> {
  const { from, at } = source;
  const { start, windowMs } = seriesWindows({ until, days });
  // Bucket 0 is the current window, counting back.
  const rows = await query<{ bucket: number; count: number }>(
    `SELECT floor(extract(epoch FROM ($2::timestamptz - ${at})) / $3)::int AS bucket, ${counted(source)} AS count
     FROM ${from} AND ${at} >= $1 AND ${at} <= $2 GROUP BY bucket`,
    [start, until, days * 24 * 60 * 60],
  );
  const counts = new Map(rows.map((row) => [row.bucket, row.count]));
  return Array.from({ length: SERIES_POINTS }, (_, i) => {
    const bucket = SERIES_POINTS - 1 - i;
    return { from: new Date(until.getTime() - (bucket + 1) * windowMs), count: counts.get(bucket) ?? 0 };
  });
}

/** The start of each of SERIES_POINTS windows of `days` ending `until`, oldest first, and how long each is. */
export function seriesWindows({ until, days }: Pick<Span, "until" | "days">): { start: Date; windowMs: number } {
  const windowMs = days * DAY_MS;
  return { start: new Date(until.getTime() - SERIES_POINTS * windowMs), windowMs };
}
