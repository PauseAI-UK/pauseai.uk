import { SUPPORTERS_LIST } from "@/lib/staff-lists";
import type { Channel } from "@/lib/contact-permissions";
import { staffCopy } from "@/lib/content/staff-interface";
import { supportersSearch, type SupportersSearch } from "@/lib/staff-search";
import type { SavedFiltersState } from "@/lib/server/saved-filters";
import type { SupporterChoices, SupportersPage } from "@/lib/server/supporters";
import { filteredName, filterWords, SUPPORTER_FILTERS } from "@/lib/staff-list-filters";
import ChannelIcon from "./ChannelIcon";
import { supporterFiltersOf } from "./SupportersTable";
import FilterBar from "./ui/FilterBar";
import { savedFiltersProps, type SavedFilterActions } from "./ui/SavedFilters";

/** A channel's icon, over its topics in the Subscriptions filter. */
const channelIcon = (channel: Channel) => <ChannelIcon channel={channel} />;

/** The supporters list's search and filters that are on, in words, as their chips say them. */
export function supporterWords(
  search: SupportersSearch,
  choices: SupporterChoices,
  near?: SupportersPage["near"],
): string[] {
  return filterWords(
    SUPPORTER_FILTERS({ ...choices, near: search.near, found: near }),
    supporterFiltersOf(search),
    "q",
  );
}

/**
 * Search and filter the supporters list, with its `saved` filters. The
 * erased notice goes with any change. With `lockConsent`, while choosing who
 * a broadcast goes to, the Consent is its own, there but not to be changed.
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
    lockConsent && filter.name === "contact" ? { ...filter, locked: staffCopy.broadcastPages.consentLocked } : filter,
  );
  return (
    <FilterBar
      path={SUPPORTERS_LIST.path}
      values={{ ...search, erased: "" }}
      search={{ name: "q", label: staffCopy.supporters.filters.search }}
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
