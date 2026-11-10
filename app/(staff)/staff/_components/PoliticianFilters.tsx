import { POLITICIANS_LIST } from "@/lib/staff-lists";
import { staffCopy } from "@/lib/content/staff-interface";
import type { Ask } from "@/lib/server/asks";
import { filteredName, filterWords, POLITICIAN_FILTERS } from "@/lib/staff-list-filters";
import type { PoliticiansSearch } from "@/lib/staff-search";
import { firstOf, type Params } from "@/lib/list-params";
import type { SavedFiltersState } from "@/lib/server/saved-filters";
import FilterBar from "./ui/FilterBar";
import { savedFiltersProps, type SavedFilterActions } from "./ui/SavedFilters";

const copy = staffCopy.politicians;

/** The list's house, search and filters that are on in `values`, its URL's parameters, in words. */
function wordsOf(values: Params, parties: string[], asks: Ask[]): string[] {
  return [
    staffCopy.houses[firstOf(values.house) as keyof typeof staffCopy.houses] ?? "",
    ...filterWords(POLITICIAN_FILTERS({ ask: firstOf(values.ask), parties, asks }), values, "q"),
  ];
}

/** The politicians list's house, search and filters that are on, in words, as its tabs and chips say them. */
export function politicianWords(search: PoliticiansSearch, parties: string[], asks: Ask[]): string[] {
  return wordsOf(search, parties, asks);
}

/**
 * Search and filter the politicians list: the search, then its filters. The
 * house is the tabs over the list, which Clear filters keeps. `hidden` on a
 * view the filters don't choose, such as the tab of those ticked. `saved` is
 * its saved filters, each said in the same words.
 */
export default function PoliticianFilters({
  search,
  parties,
  asks,
  hidden = false,
  saved,
}: {
  search: PoliticiansSearch;
  parties: string[];
  asks: Ask[];
  hidden?: boolean;
  saved?: { state: SavedFiltersState; actions: SavedFilterActions };
}) {
  if (hidden) return null;
  return (
    <FilterBar
      path={POLITICIANS_LIST.path}
      values={search}
      search={{ name: "q", label: copy.search }}
      filters={POLITICIAN_FILTERS({ ask: search.ask, parties, asks })}
      keep={["house"]}
      saved={
        saved &&
        savedFiltersProps({
          ...saved,
          list: "politicians",
          values: search,
          path: POLITICIANS_LIST.path,
          name: filteredName(politicianWords(search, parties, asks)),
          summary: (params) => wordsOf(params, parties, asks),
        })
      }
    />
  );
}
