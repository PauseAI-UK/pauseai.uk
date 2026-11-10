import { EVENTS_LIST } from "@/lib/staff-lists";
import { staffCopy } from "@/lib/content/staff-interface";
import { filteredName, filterWords, EVENT_FILTERS, type EventChoices } from "@/lib/staff-list-filters";
import { EVENT_GROUPINGS } from "@/lib/staff-events-list";
import type { SavedFiltersState } from "@/lib/server/saved-filters";
import { eventsSearch, type EventsSearch } from "@/lib/staff-search";
import { among } from "@/lib/list-params";
import { EventGroups, eventFiltersOf } from "./EventsTable";
import FilterBar from "./ui/FilterBar";
import { savedFiltersProps, type SavedFilterActions } from "./ui/SavedFilters";

/**
 * What the events list shows, in words: the Past tab and the grouping, if
 * they're on, then its search and filters, as their chips say them. The
 * page's title and a saved filter's name and summary all say it so.
 */
export function eventWords(search: EventsSearch, choices: EventChoices): string[] {
  const copy = staffCopy.events;
  const past = search.when === "past" ? [copy.tabs.past] : [];
  const [group] = among([search.group], EVENT_GROUPINGS);
  return [
    ...past,
    ...(group ? [copy.group[group]] : []),
    ...filterWords(EVENT_FILTERS(choices), eventFiltersOf(search), "q"),
  ];
}

/** Search and filter the events list, keeping its tab and grouping, with its `saved` filters and its Group by chip. */
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
          name: filteredName(eventWords(search, choices)),
          summary: (params) => eventWords(eventsSearch(params), choices),
        })
      }
      view={<EventGroups search={search} />}
    />
  );
}
