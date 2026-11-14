"use server";

// The politician pages' Server Actions: their answers to asks, their
// markers, their details and their addresses. Each is a public endpoint, so
// each calls requireStaff() before anything else
// (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/accounts/auth";
import { now } from "@/lib/now";
import { type AddResult, addPoliticianAddress, removePoliticianAddress } from "@/lib/politicians/aliases";
import { editPoliticianDetails, type EditResult, isMark, setMark } from "@/lib/politicians/edits";
import { setStatus } from "@/lib/politicians/records";
import { idFrom, statusFrom } from "@/lib/staff-forms";

/** The form on a politician's page: sets their answer to an ask, dated today, or clears it, with its note of how we know. */
export async function setAskStatus(form: FormData): Promise<void> {
  const { email } = await requireStaff();
  const parsed = statusFrom(form);
  if (!parsed) return;
  const today = now().toISOString().slice(0, 10);
  await setStatus(
    parsed.politicianId,
    parsed.ask,
    { status: parsed.status, date: parsed.status ? today : null, note: parsed.note },
    email,
  );
  revalidatePath("/staff/politicians");
  revalidatePath(`/staff/politicians/${parsed.politicianId}`);
  // A mailing's counts, and its letters' pages, where the answer can be set too.
  revalidatePath("/staff/mailings", "layout");
}

/** A marker's button in a politician's band: turns it on or off. */
export async function setMarkNow(form: FormData): Promise<void> {
  const { email } = await requireStaff();
  const id = idFrom(form, "politicianId");
  const mark = String(form.get("mark") ?? "");
  if (!id || !isMark(mark)) return;
  await setMark(id, mark, form.get("on") === "true", email);
  revalidatePath(`/staff/politicians/${id}`);
  revalidatePath("/staff/politicians");
}

/** The form of a politician's details: saves what staff changed, saying whether it did, or why not. */
export async function editPoliticianNow(form: FormData): Promise<EditResult | undefined> {
  const { email } = await requireStaff();
  const id = idFrom(form, "politicianId");
  if (!id) return undefined;
  const given = form.get("email");
  const result = await editPoliticianDetails(
    id,
    {
      salutation: String(form.get("salutation") ?? ""),
      ...(given === null ? {} : { email: String(given) }),
    },
    email,
  );
  if (result.saved) revalidatePath("/staff", "layout");
  return result;
}

/**
 * The form in a politician's aliases: adds an address to theirs, as the
 * staff member, keeping the mail with it the mailboxes hold. Says what
 * happened, for the form to show.
 */
export async function addAliasNow(form: FormData): Promise<AddResult | undefined> {
  const { email } = await requireStaff();
  const politicianId = idFrom(form, "politicianId");
  if (!politicianId) return undefined;
  const result = await addPoliticianAddress(politicianId, String(form.get("address") ?? ""), email);
  // Their page, and any thread's, which can now show them.
  if (result.added) revalidatePath("/staff", "layout");
  return result;
}

/** The button by an address staff added to a politician's: removes it. */
export async function removeAliasNow(form: FormData): Promise<void> {
  const { email } = await requireStaff();
  const politicianId = idFrom(form, "politicianId");
  if (politicianId && (await removePoliticianAddress(politicianId, String(form.get("address") ?? ""), email)))
    revalidatePath("/staff", "layout");
}
