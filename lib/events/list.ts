// The staff events list's tabs, filters and sorts, applied to our events
// as lib/events/staff-events.server.ts lists them. There are few enough events
// to filter and sort them all here, rather than in SQL.
import { BIG_EVENTS_TAG, ONLINE_TAG } from "./tags";
import type { SearchedEvent, StaffEvent } from "./staff-events.server";
import { windowStart } from "@/lib/staff-dashboard";
import type { SortColumns, SortSpec } from "@/lib/staff-sort";
import { londonDayTime } from "@/lib/staff-time";
import { eventsCopy } from "./copy";

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

export const EVENTS_PAGE_SIZE = 100;

/** How the list can show what it finds in lists, rather than a table: by owner and by tag. */
export const EVENT_GROUPINGS = ["owner", "tag"] as const;
export type EventGrouping = (typeof EVENT_GROUPINGS)[number];

/** One of those lists: its heading, and its events, soonest first. */
export type EventList = { title: string; events: StaffEvent[] };

/** How many of a list's events show, the rest folded. */
export const EVENT_LIST_SHOWS = 5;

/** The Owner filter's choice for events with no owner. */
export const NO_OWNER = "none";
/** The Place filter's choice for events online, which have no city. */
export const ONLINE = "online";

/** The filters of the events list that repeat, which can leave out as well as find. */
type NegatableEventFilter = "owner" | "tag" | "place";

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

/**
 * One page of the events a filter finds, how many it finds in all, and how
 * many pages they fill; and when a search finds none, how many it would
 * among those taken off Luma, which the list leaves out by default.
 */
export type EventsFound = { events: StaffEvent[]; total: number; pages: number; removed: number };

/** An event's values for each filter that repeats: its owner, its tags, and where it is. */
function valuesFor(event: StaffEvent): Record<NegatableEventFilter, string[]> {
  return {
    owner: [event.owner ?? NO_OWNER],
    tag: event.tags,
    place: [event.city ?? ONLINE],
  };
}

/** Whether an event passes a filter's repeating parts: has any of each one's values, and none of what's left out. */
function passes(event: StaffEvent, filter: EventFilter): boolean {
  const values = valuesFor(event);
  return (Object.keys(values) as NegatableEventFilter[]).every((name) => {
    const any = filter[name];
    const none = filter.not?.[name];
    return (
      (!any || any.some((value) => values[name].includes(value))) &&
      !none?.some((value) => values[name].includes(value))
    );
  });
}

/** English order, as the database's `COLLATE english` sorts: accented letters among the plain ones. */
const ENGLISH = new Intl.Collator("en-GB");

/** What an event sorts by, for a column: when, its name, where, how many are going, its owner, or its doc, none first. */
function sortValue(event: StaffEvent, key: EventSort): string | number {
  if (key === "going") return event.going;
  if (key === "name") return event.name.toLowerCase();
  if (key === "place") return (event.city ?? "").toLowerCase();
  if (key === "owner") return event.owner ?? "";
  if (key === "doc") return event.doc ?? "";
  return event.startAt.getTime();
}

/** Whether a search finds an event: in its name, its hosts' names or emails, or its owner's email. */
function searchFinds(event: SearchedEvent, search: string): boolean {
  return [event.name, ...event.hosts.map((host) => host.name), ...event.hostEmails, event.owner ?? ""].some((text) =>
    text.toLowerCase().includes(search),
  );
}

/**
 * Whether an event starting at `startAt` is still to come at `now`: it is
 * until the end of its day in London, so one on today stays on the Future tab,
 * however late it began, and moves to Past at midnight.
 */
export function stillToCome(startAt: Date, now: Date): boolean {
  return londonDayTime(startAt).day >= londonDayTime(now).day;
}

/** Whether an event needs an owner at `now`: it's still to come, and on Luma. */
export function ownerNeeded(event: Pick<StaffEvent, "startAt" | "removed">, now: Date): boolean {
  return stillToCome(event.startAt, now) && !event.removed;
}

/**
 * The events `filter` finds of `events`, its tab's, to come or past at
 * `now`, sorted, one page of them, or all of them for lists by a grouping;
 * any tie, by when it starts, in the tab's own direction, then by ID.
 */
export function findEvents<E extends SearchedEvent>(
  events: readonly E[],
  filter: EventFilter,
  now: Date,
): Omit<EventsFound, "events"> & { events: E[] } {
  const search = filter.search?.toLowerCase();
  const heldSince = filter.heldDays && windowStart(filter.heldDays);
  const matching = (removed: boolean) =>
    events.filter(
      (event) =>
        // How many were held, as the dashboard's tile counts them, includes those that began earlier today.
        (stillToCome(event.startAt, now) === (filter.tab === "future") || (filter.tab === "past" && heldSince)) &&
        (!heldSince || (event.startAt >= heldSince && event.startAt <= now)) &&
        (!search || searchFinds(event, search)) &&
        event.removed === removed &&
        passes(event, filter),
    );
  const found = matching(filter.removed);
  // Both sides are of one column, so of one type.
  const order = (a: string | number, b: string | number, dir: string) =>
    (typeof a === "number" ? a - (b as number) : ENGLISH.compare(a, b as string)) * (dir === "asc" ? 1 : -1);
  const startDir = EVENT_SORTS[filter.tab].start;
  found.sort(
    (a, b) =>
      order(sortValue(a, filter.sort.key), sortValue(b, filter.sort.key), filter.sort.dir) ||
      order(a.startAt.getTime(), b.startAt.getTime(), startDir) ||
      order(a.id, b.id, "asc"),
  );
  const pages = filter.group ? 1 : Math.max(1, Math.ceil(found.length / EVENTS_PAGE_SIZE));
  return {
    events: filter.group ? found : found.slice((filter.page - 1) * EVENTS_PAGE_SIZE, filter.page * EVENTS_PAGE_SIZE),
    total: found.length,
    pages,
    removed: search && found.length === 0 && !filter.removed ? matching(true).length : 0,
  };
}

/** `events` in a list for each of `titlesOf` it, in order, the lists as `rank` puts them, alphabetically within a rank. */
function listsOf(
  events: readonly StaffEvent[],
  titlesOf: (event: StaffEvent) => string[],
  rank: (title: string) => number,
): EventList[] {
  const lists = new Map<string, StaffEvent[]>();
  for (const event of events) {
    for (const title of titlesOf(event)) lists.set(title, [...(lists.get(title) ?? []), event]);
  }
  return [...lists]
    .map(([title, listed]) => ({ title, events: listed }))
    .sort((a, b) => rank(a.title) - rank(b.title) || a.title.localeCompare(b.title));
}

/** `events` in a list for each owner, by their address, those with none first. */
export function eventsByOwner(events: readonly StaffEvent[]): EventList[] {
  const none = eventsCopy.events.noOwner;
  return listsOf(
    events,
    (event) => [event.owner ?? none],
    (title) => (title === none ? 0 : 1),
  );
}

/**
 * `events` in a list for each of their Luma tags, so one with two is in both:
 * the places, then Big events, Online and those with no tag. One with no tags
 * goes under Online if it has no city.
 */
export function eventsByTag(events: readonly StaffEvent[]): EventList[] {
  const last = [BIG_EVENTS_TAG, ONLINE_TAG, eventsCopy.events.lists.noTag];
  return listsOf(
    events,
    (event) => (event.tags.length ? event.tags : [event.city ? eventsCopy.events.lists.noTag : ONLINE_TAG]),
    (title) => last.indexOf(title),
  );
}

/**
 * `lists` split into two columns, in order down the first then the second,
 * where each is about half the height with every list closed: a list's lines
 * as far as it folds, and two for its heading and its fold. The split doesn't
 * change as lists open, so opening one moves only what's under it.
 */
export function eventListColumns(lists: readonly EventList[]): [EventList[], EventList[]] {
  const height = (list: EventList) => Math.min(list.events.length, EVENT_LIST_SHOWS) + 2;
  const half = lists.reduce((sum, list) => sum + height(list), 0) / 2;
  let filled = 0;
  let split = 0;
  // Each goes in the first column unless that takes it further past half than it now falls short.
  while (split < lists.length && filled + height(lists[split]) - half <= half - filled) {
    filled += height(lists[split]);
    split++;
  }
  return [lists.slice(0, split), lists.slice(split)];
}
