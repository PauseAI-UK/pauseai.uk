import { AUDIT_LOG_LIST } from "@/lib/staff-lists";
import type { SavedFiltersState } from "@/lib/server/saved-filters.server";
import { filteredName, filterWords, CHANGE_FILTERS, type ChangeChoices } from "@/lib/staff-list-filters";
import { changesSearch, type ChangesSearch } from "@/lib/staff-search";
import { type Params } from "@/lib/list-params";
import { changeFiltersOf } from "./ChangesTable";
import FilterBar from "../ui/FilterBar";
import { savedFiltersProps, type SavedFilterActions } from "../ui/SavedFilters";
import { oversightCopy } from "@/lib/oversight/copy";

const copy = oversightCopy.changes;
const PATH = AUDIT_LOG_LIST.path;

/** The log's search and filters that are on, in words, as their chips say them; who and what say themselves, so need no choices. */
export function changeWords(search: ChangesSearch): string[] {
  return filterWords(CHANGE_FILTERS({ actors: [], actions: [] }), changeFiltersOf(search), "q");
}

/** Search and filter the audit log, with its `saved` filters, if they may see them, and what those can do. */
export default function ChangesFilters({
  search,
  choices,
  saved,
  actions,
}: {
  search: ChangesSearch;
  choices: ChangeChoices;
  saved?: SavedFiltersState;
  actions: SavedFilterActions;
}) {
  const values = changeFiltersOf(search);
  return (
    <FilterBar
      path={PATH}
      values={values}
      search={{ name: "q", label: copy.search }}
      filters={CHANGE_FILTERS(choices)}
      saved={
        saved &&
        savedFiltersProps({
          state: saved,
          actions,
          list: "audit-log",
          values,
          path: PATH,
          name: filteredName(changeWords(search)),
          summary: (params: Params) => changeWords(changesSearch(params)),
        })
      }
    />
  );
}
