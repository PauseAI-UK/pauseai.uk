import "server-only";
import { query } from "@/lib/server/db.server";
import type { SupporterSource } from "@/lib/supporters/supporters";
import { SERIES_POINTS, type SectionMetric, type SourcePoint, type Span, type SupportersTiles } from "./dashboard";
import { seriesWindows, windowCounts, type MetricSource } from "./counts.server";

// The supporters' tiles: new supporters, by their earliest source, and opt-outs.

const SOURCES: Record<SectionMetric<"supporters">, MetricSource> = {
  supportersAdded: { from: "supporters WHERE true", at: "first_seen_at" },
  // A stop of any consent, by a supporter's address or number: only one that's still a supporter's, as an opt-out
  // outlives its contact, so that they're never contacted.
  unsubscribes: {
    from: `(SELECT i.supporter_id, u.at FROM contact_unsubscribes u
            JOIN supporter_identity i ON u.way = 'email' AND i.email = u.address
          UNION SELECT c.supporter_id, u.at FROM contact_unsubscribes u
            JOIN supporter_contact c ON u.way <> 'email' AND phone_number(c.phone) = u.address) u WHERE true`,
    at: "u.at",
    count: "DISTINCT u.supporter_id",
  },
};

/** SERIES_POINTS windows ending now, oldest first: the supporters first seen in each, once each, under their earliest source. */
async function supportersBySource(span: Span): Promise<SourcePoint[]> {
  const { start, windowMs } = seriesWindows(span);
  const rows = await query<{ bucket: number; source: SupporterSource; count: number }>(
    `SELECT floor(extract(epoch FROM ($2::timestamptz - s.first_seen_at)) / $3)::int AS bucket, first.source,
            count(*)::int AS count
     FROM supporters s
     CROSS JOIN LATERAL (SELECT i.source FROM supporter_identity i WHERE i.supporter_id = s.id
                         ORDER BY i.seen_at, i.source LIMIT 1) first
     WHERE s.first_seen_at >= $1 AND s.first_seen_at <= $2 GROUP BY bucket, first.source`,
    [start, span.until, span.days * 24 * 60 * 60],
  );
  return Array.from({ length: SERIES_POINTS }, (_, i) => {
    const bucket = SERIES_POINTS - 1 - i;
    const those = rows.filter((row) => row.bucket === bucket);
    return {
      from: new Date(span.until.getTime() - (bucket + 1) * windowMs),
      count: those.reduce((sum, row) => sum + row.count, 0),
      sources: Object.fromEntries(those.map((row) => [row.source, row.count])),
    };
  });
}

/** The supporters' tiles over `span`. */
export async function supportersTiles(span: Span): Promise<SupportersTiles> {
  const [counts, bySource] = await Promise.all([windowCounts(SOURCES, span), supportersBySource(span)]);
  return { counts, supportersBySource: bySource };
}
