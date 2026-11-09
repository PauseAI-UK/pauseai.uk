import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { savedFiltersState } from "@/lib/server/saved-filters";
import { requireStaff } from "@/lib/server/staff-auth";
import { newTo } from "@/lib/server/staff-nav-seen";
import { listSupporters, supporterChoices } from "@/lib/server/supporters";
import { supportersSearch, type SupportersSearch } from "@/lib/staff-search";
import { deleteFilter, renameFilter, saveFilter, updateFilter } from "../../saved-filter-actions";
import ErasedNotice from "../../_components/ErasedNotice";
import SupporterFilters, { supporterWords } from "../../_components/SupporterFilters";
import SupportersTable from "../../_components/SupportersTable";
import { filteredTitle } from "../../_components/ui/FilterBar";
import PageTitle from "../../_components/ui/PageTitle";
import ImportSignupsButton from "../../_components/ImportSignupsButton";

type Props = { searchParams: Promise<Partial<SupportersSearch>> };

/** The list's title, with its filters: the Near filter as typed, not looked up. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  await requireStaff("supporters");
  const search = supportersSearch((await savedFiltersState("supporters", await searchParams)).params);
  return { title: filteredTitle(staffCopy.supporters.title, supporterWords(search, await supporterChoices())) };
}

/** Everyone we know of, filtered, newest activity first, with a button to import paper sign-ups, tagged new for a few days. */
export default async function SupportersPage({ searchParams }: Props) {
  const { email } = await requireStaff("supporters");
  const saved = await savedFiltersState("supporters", await searchParams);
  const { filter, ...search } = supportersSearch(saved.params);
  const [page, choices, importIsNew] = await Promise.all([
    listSupporters(filter),
    supporterChoices(),
    newTo(email, "signupImport"),
  ]);
  return (
    <>
      <PageTitle action={<ImportSignupsButton isNew={importIsNew} />}>{staffCopy.supporters.title}</PageTitle>
      <ErasedNotice erased={search.erased} why={search.why} />
      <SupporterFilters
        search={search}
        choices={choices}
        near={page.near}
        saved={{
          state: saved,
          actions: { save: saveFilter, update: updateFilter, rename: renameFilter, remove: deleteFilter },
        }}
      />
      <SupportersTable page={page} search={search} />
    </>
  );
}
