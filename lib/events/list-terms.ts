// The staff events list's terms: its tabs, sorts and groupings, its filters'
// special values, and the filter its URL says. The staff lists' shared
// machinery (lib/staff-search.ts, the saved filters) reads these for every
// list, so they're apart from what applies them (./list.ts), which only the
// events page runs.
import type { SortColumns, SortSpec } from "@/lib/staff-sort";

/** The list's tabs: events still to come, and those past. */
export const EVENT_TABS = ["future", "past"] as const;
export type EventTab = (typeof EVENT_TABS)[number];

/**
 * Each tab's sortable columns, each with the direction a first click
 * gives: by default, those to come soonest first, those past latest first.
 */
export const EVENT_SORTS: Record<EventTab, SortColumns<EventSort>> = {
  future: { start: "asc", name: "asc", place: "asc", going: "desc", owner: "asc", doc: "asc" },
  past: { start: "desc", name: "asc", place: "asc", going: "desc", owner: "asc", doc: "asc" },
};
export type EventSort = "start" | "name" | "place" | "going" | "owner" | "doc";

/** How the list can show what it finds in lists, rather than a table: by owner and by tag. */
export const EVENT_GROUPINGS = ["owner", "tag"] as const;
export type EventGrouping = (typeof EVENT_GROUPINGS)[number];

/** The Owner filter's choice for events with no owner. */
export const NO_OWNER = "none";
/** The Place filter's choice for events online, which have no city. */
export const ONLINE = "online";

/** The filters of the events list that repeat, which can leave out as well as find. */
export type NegatableEventFilter = "owner" | "tag" | "place";

/** Which events the list shows. A filter that repeats finds those with any of its values. */
export type EventFilter = {
  tab: EventTab;
  /** Over the event's name, its hosts' names and emails, and its owner's email. */
  search?: string;
  /** Staff emails, or NO_OWNER. */
  owner?: string[];
  /** Luma tags. */
  tag?: string[];
  /** Cities, or ONLINE. */
  place?: string[];
  /** Only those taken off Luma, or, by default, only those still on it. */
  removed: boolean;
  /** Only those that started in the last so many days. */
  heldDays?: number;
  /** Those with none of these, each a filter above that repeats. */
  not?: Pick<EventFilter, NegatableEventFilter>;
  /** In lists by this, all of them, not a page; or, by default, a table. */
  group?: EventGrouping;
  sort: SortSpec<EventSort>;
  page: number;
};
