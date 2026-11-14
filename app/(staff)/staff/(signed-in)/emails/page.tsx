import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { emailPeople, listAllLetters } from "@/lib/server/all-letters";
import { oneOffInbox } from "@/lib/server/one-off-emails";
import { canSeeSupporters, requireStaff } from "@/lib/accounts/auth";
import { allLettersSearch, type AllLettersSearch } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import AllLetters from "../../_components/AllLetters";
import Page from "../../_components/ui/Page";

export const metadata: Metadata = { title: staffCopy.allLetters.title };

/** Every email with a politician, a row for each letter and one-off thread, newest first; what staff without `supporters` may see. */
export default async function AllEmailsPage({
  searchParams,
}: {
  searchParams: Promise<Partial<Record<keyof AllLettersSearch, ParamValue>>>;
}) {
  const supporters = canSeeSupporters(await requireStaff());
  const { filter, ...search } = allLettersSearch(await searchParams);
  const [found, people] = await Promise.all([listAllLetters(filter, supporters), emailPeople(supporters)]);
  return (
    <Page kind="list">
      <AllLetters found={found} people={people} search={search} supporters={supporters} inbox={oneOffInbox()} />
    </Page>
  );
}
