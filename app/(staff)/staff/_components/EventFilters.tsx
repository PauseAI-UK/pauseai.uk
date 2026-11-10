import { EVENTS_LIST } from "@/lib/staff-lists";
import { staffCopy } from "@/lib/content/staff-interface";
import { filteredName, filterWords, EVENT_FILTERS, type EventChoices } from "@/lib/staff-list-filters";
import type { SavedFiltersState } from "@/lib/server/saved-filters";
import { eventsSearch, type EventsSearch } from "@/lib/staff-search";
import { firstOf, type Params } from "@/lib/list-params";
import { eventFiltersOf } from "./EventsTable";
import FilterBar from "./ui/FilterBar";
import { savedFiltersProps, type SavedFilterActions } from "./ui/SavedFilters";

/** The events list's search and filters that are on, in words, as their chips say them. */
export function eventWords(search: EventsSearch, choices: EventChoices): string[] {
  return filterWords(EVENT_FILTERS(choices), eventFiltersOf(search), "q");
}

/** A saved filter of the events list, in words: the Past tab, if it's on, and its search and filters. */
function savedEventWords(params: Params, choices: EventChoices): string[] {
  const past = firstOf(params.when) === "past" ? [staffCopy.events.tabs.past] : [];
  return [...past, ...eventWords(eventsSearch(params), choices)];
}

/** Search and filter the events list, keeping its tab, with its `saved` filters. */
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
      keep={["when"]}
      saved={
        saved &&
        savedFiltersProps({
          ...saved,
          list: "events",
          values: eventFiltersOf(search),
          path: EVENTS_LIST.path,
          name: filteredName(staffCopy.events.title, eventWords(search, choices)),
          summary: (params) => savedEventWords(params, choices),
        })
      }
    />
  );
}
