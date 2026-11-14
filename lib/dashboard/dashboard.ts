import type { DashboardWindow } from "@/lib/time-windows";
import type { ImportJob, PoliticianImportJob } from "@/lib/import-runs";
import type { Permission } from "@/lib/accounts/permissions";
import type { SupporterSource } from "@/lib/supporters/supporters";

// The staff home's dashboard: what needs a person, and what happened in
// the window against the window before. Each group of tiles loads its own
// numbers, as does what needs a person (lib/dashboard/*.server.ts); the
// page puts them together, and StaffDashboard shows them.

/** How many windows a sparkline or a chart of bars shows, the current one last. */
export const SERIES_POINTS = 8;

/** The tiles, in three groups, in the sidebar's order and under its names. */
export const DASHBOARD_SECTIONS = {
  supporters: ["supportersAdded", "unsubscribes"],
  politicians: ["lettersSent", "lettersReplied", "politiciansAgreed"],
  events: ["eventRegistrations", "eventsHeld"],
} as const;
export type DashboardSection = keyof typeof DASHBOARD_SECTIONS;
export type DashboardMetric = (typeof DASHBOARD_SECTIONS)[DashboardSection][number];
/** The metrics of one group of tiles. */
export type SectionMetric<S extends DashboardSection> = (typeof DASHBOARD_SECTIONS)[S][number];

/** The metrics shown with a bar by campaign under the number. */
export const BY_CAMPAIGN = ["lettersSent", "politiciansAgreed"] as const satisfies readonly DashboardMetric[];
export type CampaignMetric = (typeof BY_CAMPAIGN)[number];

/** The metrics shown with a sparkline: counts that move and mean something. */
export const WITH_SERIES = ["eventRegistrations"] as const satisfies readonly DashboardMetric[];
export type SeriesMetric = (typeof WITH_SERIES)[number];

/** One metric: how many in the window, and how many in the window before it. */
export type Count = { current: number; previous: number };

/** One point of a sparkline: the count in a window starting at `from`. */
export type SeriesPoint = { from: Date; count: number };

/** One bar of new supporters: those first seen in a window starting at `from`, each under their earliest source. */
export type SourcePoint = SeriesPoint & { sources: Partial<Record<SupporterSource, number>> };

/**
 * Where each tile leads: the page that lists exactly what it counts in the
 * window (`days`), and the permissions it takes to see it there; without them
 * the tile is no link. The politicians agreed tile's page depends on who agreed
 * (agreedHref). `worse` marks a number that's bad when it rises, so its change
 * is coloured the other way round.
 */
export const METRIC_LINKS: Record<
  DashboardMetric,
  { href: (days: DashboardWindow) => string; permissions: readonly Permission[]; worse?: true }
> = {
  lettersSent: { href: (days) => `/staff/emails?type=campaign&sent=${days}`, permissions: ["supporters"] },
  lettersReplied: {
    href: (days) => `/staff/emails?type=campaign&type=mailing&replied=${days}`,
    permissions: ["supporters"],
  },
  politiciansAgreed: { href: (days) => `/staff/politicians?agreed=${days}&status=any&sort=asks`, permissions: [] },
  eventRegistrations: { href: (days) => `/staff/supporters?registered=${days}`, permissions: ["supporters"] },
  eventsHeld: { href: (days) => `/staff/events?when=past&held=${days}`, permissions: [] },
  supportersAdded: {
    href: (days) => `/staff/supporters?first=${days}&sort=first&dir=desc`,
    permissions: ["supporters"],
  },
  unsubscribes: { href: (days) => `/staff/supporters?unsubscribed=${days}`, permissions: ["supporters"], worse: true },
};

/** Something waiting for a person, with where its button goes. */
export type DashboardAction =
  | { kind: "held-import"; job: PoliticianImportJob; at: Date; added: number; left: number; changed: number }
  | { kind: "blocked-mp"; politicianId: number; name: string; isTest: boolean; at: Date }
  | { kind: "failed-import"; job: ImportJob; at: Date; error: string }
  | { kind: "letters-inbox"; inbox: string; count: number; at: Date }
  /** Replies to broadcasts waiting for staff, and the broadcast with the oldest, where to start. */
  | { kind: "broadcast-replies"; count: number; broadcastId: number };

export type Dashboard = {
  /** The window's length in days. */
  days: DashboardWindow;
  /** When the dashboard was drawn. */
  asOf: Date;
  /** The start of the window. */
  since: Date;
  counts: Record<DashboardMetric, Count>;
  /** The window's count by campaign slug, for the tiles with a bar. */
  byCampaign: Record<CampaignMetric, Record<string, number>>;
  /** The politician who agreed in the window, when only one did, for any number of asks. */
  agreedMp: number | null;
  /** SERIES_POINTS windows of `days`, oldest first, the current one last, for the tiles with a sparkline. */
  series: Record<SeriesMetric, SeriesPoint[]>;
  /** SERIES_POINTS windows of `days`, oldest first, the current one last, of new supporters by their earliest source. */
  supportersBySource: SourcePoint[];
  actions: DashboardAction[];
};

/** Where the politicians agreed tile leads: the page of the one politician who agreed in the window, or the list of those who did. */
export function agreedHref({ agreedMp, days }: Pick<Dashboard, "agreedMp" | "days">): string {
  return agreedMp !== null ? `/staff/politicians/${agreedMp}` : METRIC_LINKS.politiciansAgreed.href(days);
}

export function isCampaignMetric(metric: DashboardMetric): metric is CampaignMetric {
  return (BY_CAMPAIGN as readonly DashboardMetric[]).includes(metric);
}

export function isSeriesMetric(metric: DashboardMetric): metric is SeriesMetric {
  return (WITH_SERIES as readonly DashboardMetric[]).includes(metric);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** What the tiles count over: the window's length, its end (now) and start, and the start of the window before. */
export type Span = { days: DashboardWindow; until: Date; since: Date; before: Date };

/** The window of `days` ending `at`, and the one before it. */
export function spanOf(days: DashboardWindow, at: Date): Span {
  return {
    days,
    until: at,
    since: new Date(at.getTime() - days * DAY_MS),
    before: new Date(at.getTime() - 2 * days * DAY_MS),
  };
}

/** The supporters' tiles' numbers (lib/dashboard/supporters.server.ts). */
export type SupportersTiles = Pick<Dashboard, "supportersBySource"> & {
  counts: Record<SectionMetric<"supporters">, Count>;
};
/** The politicians' tiles' numbers (lib/dashboard/politicians.server.ts). */
export type PoliticiansTiles = Pick<Dashboard, "byCampaign" | "agreedMp"> & {
  counts: Record<SectionMetric<"politicians">, Count>;
};
/** The events' tiles' numbers (lib/dashboard/events.server.ts). */
export type EventsTiles = Pick<Dashboard, "series"> & { counts: Record<SectionMetric<"events">, Count> };

/** The dashboard over `span`, from each group of tiles' numbers and what needs a person. */
export function dashboardOf(
  span: Span,
  {
    supporters,
    politicians,
    events,
  }: { supporters: SupportersTiles; politicians: PoliticiansTiles; events: EventsTiles },
  actions: DashboardAction[],
): Dashboard {
  return {
    days: span.days,
    asOf: span.until,
    since: span.since,
    counts: { ...supporters.counts, ...politicians.counts, ...events.counts },
    byCampaign: politicians.byCampaign,
    agreedMp: politicians.agreedMp,
    series: events.series,
    supportersBySource: supporters.supportersBySource,
    actions,
  };
}
