import { EVENTS_LIST } from "@/lib/staff-lists";
import { staffCopy } from "@/lib/content/staff-interface";
import { filteredName, filterWords, EVENT_FILTERS, type EventChoices } from "@/lib/staff-list-filters";
import { EVENT_GROUPINGS } from "@/lib/staff-events-list";
import type { SavedFiltersState } from "@/lib/server/saved-filters";
import { eventsSearch, type EventsSearch } from "@/lib/staff-search";
import { among, type Params } from "@/lib/list-params";
import { eventFiltersOf } from "./EventsTable";
import FilterBar from "./ui/FilterBar";
import { savedFiltersProps, type SavedFilterActions } from "./ui/SavedFilters";

/** The events list's search and filters that are on, in words, as their chips say them. */
export function eventWords(search: EventsSearch, choices: EventChoices): string[] {
  return filterWords(EVENT_FILTERS(choices), eventFiltersOf(search), "q");
}

/** The events list's Past tab and its grouping, if they're on, in words. */
function shownWords(search: EventsSearch): string[] {
  const copy = staffCopy.events;
  const past = search.when === "past" ? [copy.tabs.past] : [];
  const [group] = among([search.group], EVENT_GROUPINGS);
  return [...past, ...(group ? [copy.group[group]] : [])];
}

/** A saved filter of the events list, in words: the Past tab and the grouping, if they're on, and its search and filters. */
function savedEventWords(params: Params, choices: EventChoices): string[] {
  const search = eventsSearch(params);
  return [...shownWords(search), ...eventWords(search, choices)];
}

/** Search and filter the events list, keeping its tab and grouping, with its `saved` filters. */
export default function EventFilters({
  search,
  choices,
  saved,
}: {
  search: EventsSearch;
  choices: EventChoices;
  saved?: { state: SavedFiltersState; actions: SavedFilterActions };
}) {
  return (
    <FilterBar
      path={EVENTS_LIST.path}
      values={eventFiltersOf(search)}
      search={{ name: "q", label: staffCopy.events.filters.search }}
      filters={EVENT_FILTERS(choices)}
      keep={["when", "group"]}
      saved={
        saved &&
        savedFiltersProps({
          ...saved,
          list: "events",
          values: eventFiltersOf(search),
          path: EVENTS_LIST.path,
          name: filteredName(staffCopy.events.title, [...shownWords(search), ...eventWords(search, choices)]),
          summary: (params) => savedEventWords(params, choices),
        })
      }
    />
  );
}
