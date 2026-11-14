import "server-only";
import type { EventsTiles, SectionMetric, Span } from "./dashboard";
import { series, windowCounts, type MetricSource } from "./counts.server";

// The events' tiles: the people registered for an event, with a sparkline, and the events held.

const SOURCES: Record<SectionMetric<"events">, MetricSource> = {
  eventRegistrations: {
    from: `luma_guests g JOIN supporter_links k ON k.luma_user_id = g.user_id
      WHERE g.approval_status = 'approved' AND g.removed_at IS NULL`,
    at: "g.registered_at",
    count: "DISTINCT k.supporter_id",
  },
  eventsHeld: { from: "luma_events WHERE access = 'manage' AND removed_at IS NULL", at: "start_at" },
};

/** The events' tiles over `span`. */
export async function eventsTiles(span: Span): Promise<EventsTiles> {
  const [counts, registrations] = await Promise.all([
    windowCounts(SOURCES, span),
    series(SOURCES.eventRegistrations, span),
  ]);
  return { counts, series: { eventRegistrations: registrations } };
}
