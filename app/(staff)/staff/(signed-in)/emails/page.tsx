import type { Metadata } from "next";
import { emailPeople, listAllLetters } from "@/lib/letters/all-letters.server";
import { oneOffInbox } from "@/lib/letters/one-off-emails.server";
import { canSeeSupporters, requireStaff } from "@/lib/accounts/auth.server";
import { allLettersSearch, type AllLettersSearch } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import AllLetters from "../../_components/letters/AllLetters";
import Page from "../../_components/ui/Page";
import { lettersCopy } from "../../_components/letters/copy";

export const metadata: Metadata = { title: lettersCopy.allLetters.title };

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
