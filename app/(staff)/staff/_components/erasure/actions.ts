"use server";

// Erasing a supporter's Server Action. It's a public endpoint, so it calls
// requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/accounts/auth.server";
import { eraseSupporter } from "@/lib/erasure/erase.server";
import { eraseFrom } from "@/lib/staff-forms";
import { erasedPath } from "@/lib/staff-search";

/**
 * Erases a supporter, from their page, then goes to the list, which says
 * so, and what couldn't be cleared afterwards, if anything. A supporter
 * that's already gone is nothing to do.
 */
export async function eraseSupporterNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("supporters");
  const parsed = eraseFrom(form);
  if (!parsed) return;
  const result = await eraseSupporter(parsed.id, parsed.reference, email);
  if (!result) return;
  revalidatePath("/staff", "layout");
  redirect(erasedPath(result.notCleared));
}
