"use server";

// Oversight's Server Actions: unblocking an address, and marking an error done. Each is a public endpoint, so each
// calls requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormResult } from "@/lib/form-result";
import { ownId, unblockFrom } from "@/lib/staff-forms";
import { unblock } from "@/lib/oversight/delivery-problems.server";
import { isPoliticianAddress } from "@/lib/email/email.server";
import { setErrorDone } from "@/lib/oversight/errors-seen.server";
import { ERRORS_LIST } from "@/lib/staff-lists";
import { canSeeSupporters, requireStaff } from "@/lib/accounts/auth.server";

/**
 * Unblocks an address, on either page of blocked addresses or a politician's.
 * Refused without the note of why. Any address but a politician's needs
 * `supporters`, as its page does, so one sent without it is thrown, as a
 * request made up. An address someone else unblocked meanwhile is as
 * unblocked as was asked, and the pages are shown as they are. If the
 * provider can't be reached, the address stays blocked and the error is
 * thrown on, for the staff member to see and the errors page to keep.
 */
export async function unblockAddress(form: FormData): Promise<FormResult<"blank">> {
  const staff = await requireStaff();
  const parsed = unblockFrom(form);
  if (!parsed.ok) return parsed;
  if (!canSeeSupporters(staff) && !(await isPoliticianAddress(parsed.address)))
    throw new Error("An address that isn't a politician's came to be unblocked by someone who can't see supporters");
  await unblock(parsed.address, staff.email, parsed.note);
  // The addresses page, the politicians list and their pages all show it.
  revalidatePath("/staff", "layout");
  return { ok: true };
}

/**
 * The button on an error's page: marks it done, as the admin, with `done`
 * "yes", and goes back to the list for the next; or to do again without,
 * staying on its page. Which error is the form's own, so thrown when it
 * isn't one.
 */
export async function setErrorDoneNow(form: FormData): Promise<FormResult<never>> {
  const { email } = await requireStaff("admin");
  const id = ownId(form);
  const done = form.get("done") === "yes";
  await setErrorDone(id, done ? email : null);
  // Its page, and both tabs of the list.
  revalidatePath(ERRORS_LIST.path, "layout");
  if (done) redirect(ERRORS_LIST.path);
  return { ok: true };
}
