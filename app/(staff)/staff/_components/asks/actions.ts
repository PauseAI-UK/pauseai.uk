"use server";

// The asks pages' Server Actions: an ask's form, saving it or deleting it.
// Each is a public endpoint, so each calls requireStaff() before anything
// else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/accounts/auth.server";
import { addAsk, deleteAsk, editAsk } from "@/lib/asks/records.server";
import { askFrom } from "@/lib/staff-forms";
import { staffBack } from "@/lib/staff-search";

/**
 * Where an ask's form goes after a save: `back`, or the asks page; or the
 * form again, saying why not; or, the ask deleted meanwhile, the asks page
 * saying so, as its form is gone too.
 */
function afterAsk(slug: string, back: string, result: { saved: boolean; reason?: string }, saved: string): never {
  revalidatePath("/staff/asks");
  if (result.reason === "gone") redirect("/staff/asks?notice=gone");
  const form = slug ? `/staff/asks/${slug}/edit` : "/staff/asks/new";
  const [path, query = ""] = (result.saved ? back : form).split("?");
  const params = new URLSearchParams(query);
  params.set("notice", result.saved ? saved : result.reason!);
  if (!result.saved) params.set("back", back);
  redirect(`${path}?${params}`);
}

/** An ask's form: adds the ask, or with its slug, saves it; then goes back to where it was opened from. */
export async function saveAskNow(form: FormData): Promise<void> {
  const { email } = await requireStaff();
  const slug = String(form.get("slug") ?? "");
  const back = staffBack(String(form.get("back") ?? ""), "/staff/asks");
  const parsed = askFrom(form);
  if (!parsed) afterAsk(slug, back, { saved: false, reason: "invalid" }, "");
  afterAsk(
    slug,
    back,
    slug ? await editAsk(slug, parsed, email) : await addAsk(parsed, email),
    slug ? "saved" : "added",
  );
}

/** An ask's Delete: deletes it, while nothing refers to it, then goes to the asks page. */
export async function deleteAskNow(form: FormData): Promise<void> {
  const { email } = await requireStaff();
  const slug = String(form.get("slug") ?? "");
  afterAsk(slug, "/staff/asks", await deleteAsk(slug, email), "deleted");
}
