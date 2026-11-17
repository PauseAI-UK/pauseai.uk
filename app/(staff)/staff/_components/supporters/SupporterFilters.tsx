import { SUPPORTERS_LIST } from "@/lib/staff-lists";
import { supportersSearch, type SupportersSearch } from "@/lib/staff-search";
import type { Params } from "@/lib/list-params";
import { consentLeftOut, type Way } from "@/lib/supporters/contact-permissions";
import type { SavedFiltersState } from "@/lib/server/saved-filters.server";
import type { SupporterChoices, SupportersPage } from "@/lib/supporters/records.server";
import { filteredName, filterPills, SUPPORTER_FILTERS, type FilterPill } from "@/lib/staff-list-filters";
import ChannelIcon from "@/components/ui/ChannelIcon";
import { supporterFiltersOf } from "./SupportersTable";
import FilterBar from "../ui/FilterBar";
import { savedFiltersProps, type SavedFilterActions } from "../ui/SavedFilters";
import { supportersCopy } from "./copy";

/** A channel's icon, over its topics in the Subscriptions filter. */
const channelIcon = (way: Way) => <ChannelIcon channel={way} />;

/**
 * The supporters list's filters on but the consents it finds, as pills: who a
 * broadcast is to, of those who said yes, the consents it leaves out too.
 */
export function othersThanConsent(params: Params, choices: SupporterChoices): FilterPill[] {
  return supporterPills(supportersSearch({ ...params, contact: consentLeftOut(params.contact) }), choices);
}

/** The supporters list's search and filters that are on, as their chips say them, and whether each leaves out. */
function supporterPills(
  search: SupportersSearch,
  choices: SupporterChoices,
  near?: SupportersPage["near"],
): FilterPill[] {
  return filterPills(
    SUPPORTER_FILTERS({ ...choices, near: search.near, found: near }),
    supporterFiltersOf(search),
    "q",
  );
}

/** The supporters list's search and filters that are on, in words, as their chips say them. */
export function supporterWords(
  search: SupportersSearch,
  choices: SupporterChoices,
  near?: SupportersPage["near"],
): string[] {
  return supporterPills(search, choices, near).map((pill) => pill.words);
}

/**
 * Search and filter the supporters list, with its `saved` filters. The
 * erased notice goes with any change. With `lockConsent`, while choosing who
 * a broadcast goes to, the consents it finds are the broadcast's, there but
 * not to be changed; those it leaves out can be.
 */
export default function SupporterFilters({
  search,
  choices,
  near,
  saved,
  lockConsent = false,
}: {
  search: SupportersSearch;
  choices: SupporterChoices;
  near?: SupportersPage["near"];
  saved?: { state: SavedFiltersState; actions: SavedFilterActions };
  lockConsent?: boolean;
}) {
  const filters = SUPPORTER_FILTERS({ ...choices, near: search.near, found: near, channelIcon }).map((filter) =>
    lockConsent && filter.name === "contact" ? { ...filter, locked: supportersCopy.consentLocked } : filter,
  );
  return (
    <FilterBar
      path={SUPPORTERS_LIST.path}
      values={{ ...search, erased: "" }}
      search={{ name: "q", label: supportersCopy.supporters.filters.search }}
      filters={filters}
      saved={
        saved &&
        savedFiltersProps({
          ...saved,
          list: "supporters",
          values: { ...search, erased: "" },
          path: SUPPORTERS_LIST.path,
          name: filteredName(supporterWords(search, choices, near)),
          summary: (params) => supporterWords(supportersSearch(params), choices),
        })
      }
    />
  );
}
