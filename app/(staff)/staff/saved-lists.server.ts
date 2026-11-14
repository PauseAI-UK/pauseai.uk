import "server-only";
import type { ParamValue, Params } from "@/lib/list-params";
import { staffCopy } from "@/lib/content/staff-interface";
import type { SavedList } from "@/lib/saved-filters";
import { savedFiltersState, type SavedFiltersState } from "@/lib/server/saved-filters.server";
import { filteredTitle } from "@/lib/staff-list-filters";
import { changesSearch, eventsSearch, politiciansSearch, supportersSearch } from "@/lib/staff-search";
import { eventsCopy } from "@/lib/events/copy";
import { supportersCopy } from "./_components/supporters/copy";
import { politiciansCopy } from "./_components/politicians/copy";

// The lists with saved filters, as their pages open them. A page calls
// requireStaff() itself, first, as tests/checks/staff-auth.test.ts reads it
// there; then openSavedList() gives it the list's saved filters, with the
// one its URL loads, and what that finds, as the list's parser reads it, and
// its title, for generateMetadata, with what's on in the words the page gives.

/** Each list's parser, and its page's title. */
const LISTS = {
  politicians: { parse: politiciansSearch, title: politiciansCopy.politicians.title },
  supporters: { parse: supportersSearch, title: supportersCopy.supporters.title },
  events: { parse: eventsSearch, title: eventsCopy.events.title },
  "audit-log": { parse: changesSearch, title: staffCopy.changes.title },
} satisfies Record<SavedList, { parse: (params: Params) => unknown; title: string }>;

type Search<L extends SavedList> = ReturnType<(typeof LISTS)[L]["parse"]>;

/** A list with saved filters, opened: its saved filters, with the one loaded, and what it finds. */
export type OpenedList<L extends SavedList> = {
  saved: SavedFiltersState;
  search: Search<L>;
  /** Its page's title, with what `words` says is on, as its chips say it. */
  title(words: (search: Search<L>) => string[] | Promise<string[]>): Promise<string>;
};

/**
 * List `list` as its URL's `params` ask for it: the saved filter loaded, if
 * any, with what's left of it, and what the list's parser reads from that.
 */
export async function openSavedList<L extends SavedList>(
  list: L,
  params: Partial<Record<string, ParamValue>>,
): Promise<OpenedList<L>> {
  const saved = await savedFiltersState(list, params);
  const search = (LISTS[list].parse as (params: Params) => Search<L>)(saved.params);
  return { saved, search, title: async (words) => filteredTitle(LISTS[list].title, await words(search)) };
}
