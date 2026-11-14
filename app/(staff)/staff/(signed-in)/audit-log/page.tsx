import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { changeChoices, recentChanges } from "@/lib/server/audit";
import { canSeeSupporters, requireStaff } from "@/lib/server/staff-auth";
import type { ChangesSearch } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import { deleteFilter, renameFilter, saveFilter, updateFilter } from "../../saved-filter-actions";
import ChangesFilters, { changeWords } from "../../_components/ChangesFilters";
import ChangesTable from "../../_components/ChangesTable";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";
import { openSavedList } from "../../saved-lists";

type Props = { searchParams: Promise<Partial<Record<keyof ChangesSearch, ParamValue>>> };

/** The log's title, with its filters. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  await requireStaff("admin");
  return { title: await (await openSavedList("audit-log", await searchParams)).title(changeWords) };
}

/** The log, filtered. Whichever filter is on, entries about supporters show only to those who may see them. */
export default async function ChangesPage({ searchParams }: Props) {
  const supporters = canSeeSupporters(await requireStaff("admin"));
  const {
    saved,
    search: { filter, ...search },
  } = await openSavedList("audit-log", await searchParams);
  const [log, choices] = await Promise.all([recentChanges(supporters, filter), changeChoices(supporters)]);
  return (
    <Page kind="list">
      <PageHead intro={staffCopy.changes.intro}>{staffCopy.changes.title}</PageHead>
      <ChangesFilters
        search={search}
        choices={choices}
        saved={saved}
        actions={{ save: saveFilter, update: updateFilter, rename: renameFilter, remove: deleteFilter }}
      />
      <ChangesTable log={log} search={search} page={filter.page!} supporters={supporters} />
    </Page>
  );
}
