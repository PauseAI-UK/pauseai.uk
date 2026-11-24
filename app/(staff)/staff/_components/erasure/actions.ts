"use server";

// Erasing a supporter's Server Action. It's a public endpoint, so it calls
// requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/accounts/auth.server";
import { eraseSupporter } from "@/lib/erasure/erase.server";
import { refused, type FormResult } from "@/lib/form-result";
import { eraseFrom } from "@/lib/staff-forms";
import { erasedPath } from "@/lib/staff-search";

/**
 * Erases a supporter, from their page, then goes to the list, which says
 * so, and what couldn't be cleared afterwards, if anything. Refused without
 * the request's reference, or for a supporter someone else has erased since
 * the page loaded, which the page, refreshed, says over its not being there.
 */
export async function eraseSupporterNow(form: FormData): Promise<FormResult<"blank" | "gone">> {
  const { email } = await requireStaff("supporters");
  const parsed = eraseFrom(form);
  if (!parsed.ok) return parsed;
  const result = await eraseSupporter(parsed.id, parsed.reference, email);
  revalidatePath("/staff", "layout");
  if (!result) return refused("gone");
  redirect(erasedPath(result.notCleared));
}
