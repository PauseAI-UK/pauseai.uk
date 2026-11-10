import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { withChoosing } from "@/lib/server/broadcast-pages";
import { requireStaff } from "@/lib/server/staff-auth";
import { listSupporters, supporterChoices } from "@/lib/server/supporters";
import { supportersSearch, type SupportersSearch } from "@/lib/staff-search";
import { deleteFilter, renameFilter, saveFilter, updateFilter } from "../../saved-filter-actions";
import ErasedNotice from "../../_components/ErasedNotice";
import { ChoosingBroadcastFrame, BroadcastSupporters } from "../../_components/BroadcastSupporters";
import SupporterFilters, { supporterWords } from "../../_components/SupporterFilters";
import SupportersTable from "../../_components/SupportersTable";
import { keepFilterForBroadcast, newBroadcast } from "../../broadcast-actions";
import { openSavedList } from "../../saved-lists";

type Props = { searchParams: Promise<Partial<SupportersSearch>> };

/** The list's title, with its filters: the Near filter as typed, not looked up. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  await requireStaff("supporters");
  const list = await openSavedList("supporters", await searchParams);
  return { title: await list.title(async (search) => supporterWords(search, await supporterChoices())) };
}

/**
 * Everyone we know of, filtered, newest activity first; while it's choosing
 * who a draft broadcast goes to, the way back to it, and the draft's Consent,
 * which a saved filter loaded keeps and the list can't change.
 */
export default async function SupportersPage({ searchParams }: Props) {
  await requireStaff("supporters");
  const asked = await searchParams;
  const { saved } = await openSavedList("supporters", asked);
  const { choosing, params } = await withChoosing(saved.params, asked.broadcast);
  const { filter, ...search } = supportersSearch(params);
  const [page, choices] = await Promise.all([listSupporters(filter), supporterChoices()]);
  return (
    <ChoosingBroadcastFrame choosing={choosing} search={search} total={page.total} keep={keepFilterForBroadcast}>
      <h1>{staffCopy.supporters.title}</h1>
      <ErasedNotice erased={search.erased} why={search.why} />
      <SupporterFilters
        search={search}
        choices={choices}
        near={page.near}
        lockConsent={Boolean(choosing)}
        saved={{
          state: saved,
          actions: { save: saveFilter, update: updateFilter, rename: renameFilter, remove: deleteFilter },
        }}
      />
      <SupportersTable
        page={page}
        search={search}
        actions={<BroadcastSupporters search={search} total={page.total} action={newBroadcast} choosing={choosing} />}
      />
    </ChoosingBroadcastFrame>
  );
}
