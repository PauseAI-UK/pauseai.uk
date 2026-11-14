"use server";

// The Server Actions of saved filters. Each is a public endpoint, so each
// calls requireStaff() before anything else (tests/checks/staff-auth.test.ts),
// for the permission of the list its form says it's for; and a filter is only
// ever found through that list.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SAVED, savedParams, urlParams, type SavedList } from "@/lib/saved-filters";
import { createSavedFilter, deleteSavedFilter, renameSavedFilter, updateSavedFilter } from "@/lib/server/saved-filters";
import { requireStaff } from "@/lib/accounts/auth";
import { idFrom, savedFilterNeeds, savedListFrom, savedNameFrom } from "@/lib/staff-forms";
import { staffBack } from "@/lib/staff-search";
import { filtersPath } from "@/lib/list-params";

/** The list page the form came from, or the list's own page if it's another. */
function backTo(form: FormData, list: SavedList): string {
  const path = SAVED[list].path;
  const back = staffBack(form.get("back") as string | null, path);
  return back === path || back.startsWith(`${path}?`) ? back : path;
}

/** The list's page with its filters loaded from the form's page, as saved filter `id`, from their first page. */
function loaded(form: FormData, list: SavedList, id: number): string {
  const params = urlParams(backTo(form, list));
  return filtersPath(SAVED[list].path, { ...params, page: "", saved: String(id) });
}

/** Saves what the form's page has on as a new filter, with the name it gives, and loads it. */
export async function saveFilter(form: FormData): Promise<void> {
  const { email } = await requireStaff(savedFilterNeeds(form));
  const list = savedListFrom(form);
  const name = savedNameFrom(form);
  if (!list || !name) return;
  const id = await createSavedFilter(list, name, savedParams(list, urlParams(backTo(form, list))), email);
  revalidatePath(SAVED[list].path);
  redirect(loaded(form, list, id));
}

/** Gives a saved filter, for everyone, what the form's page has on, and stays loaded on it. */
export async function updateFilter(form: FormData): Promise<void> {
  const { email } = await requireStaff(savedFilterNeeds(form));
  const list = savedListFrom(form);
  const id = idFrom(form);
  if (!list || !id) return;
  const params = savedParams(list, urlParams(backTo(form, list)));
  if (!(await updateSavedFilter(list, id, params, email))) return;
  revalidatePath(SAVED[list].path);
  redirect(loaded(form, list, id));
}

/** Gives a saved filter the name the form gives it, staying on the page. */
export async function renameFilter(form: FormData): Promise<void> {
  const { email } = await requireStaff(savedFilterNeeds(form));
  const list = savedListFrom(form);
  const id = idFrom(form);
  const name = savedNameFrom(form);
  if (!list || !id || !name) return;
  await renameSavedFilter(list, id, name, email);
  revalidatePath(SAVED[list].path);
}

/** Deletes a saved filter for everyone, and goes back to the page, with any filter it had loaded still there. */
export async function deleteFilter(form: FormData): Promise<void> {
  const { email } = await requireStaff(savedFilterNeeds(form));
  const list = savedListFrom(form);
  const id = idFrom(form);
  if (!list || !id) return;
  await deleteSavedFilter(list, id, email);
  revalidatePath(SAVED[list].path);
  redirect(backTo(form, list));
}
