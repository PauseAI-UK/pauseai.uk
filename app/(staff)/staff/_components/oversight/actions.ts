"use server";

// Oversight's Server Actions: unblocking an address, and marking an error done. Each is a public endpoint, so each
// calls requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { idFrom, unblockFrom } from "@/lib/staff-forms";
import { unblock } from "@/lib/oversight/delivery-problems.server";
import { isPoliticianAddress } from "@/lib/email/email.server";
import { setErrorDone } from "@/lib/oversight/errors-seen.server";
import { ERRORS_LIST } from "@/lib/staff-lists";
import { canSeeSupporters, requireStaff } from "@/lib/accounts/auth.server";

/**
 * Unblocks an address, on either page of blocked addresses or a politician's.
 * Any address but a politician's needs `supporters`, as its page does. If
 * the provider can't be reached, it's logged and the address stays blocked.
 */
export async function unblockAddress(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const parsed = unblockFrom(form);
  if (!parsed) return;
  if (!canSeeSupporters(staff) && !(await isPoliticianAddress(parsed.address))) return;
  try {
    await unblock(parsed.address, staff.email, parsed.note);
  } catch (error) {
    console.error(error);
  }
  // The addresses page, the politicians list and their pages all show it.
  revalidatePath("/staff", "layout");
}

/**
 * The button on an error's page: marks it done, as the admin, with `done`
 * "yes", and goes back to the list for the next; or to do again without,
 * staying on its page.
 */
export async function setErrorDoneNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("admin");
  const id = idFrom(form);
  if (!id) return;
  const done = form.get("done") === "yes";
  await setErrorDone(id, done ? email : null);
  // Its page, and both tabs of the list.
  revalidatePath(ERRORS_LIST.path, "layout");
  if (done) redirect(ERRORS_LIST.path);
}
