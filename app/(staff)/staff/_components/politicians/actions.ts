"use server";

// The politician pages' Server Actions: their answers to asks, their
// markers, their details and their addresses. Each is a public endpoint, so
// each calls requireStaff() before anything else
// (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/accounts/auth.server";
import { refused, type FormResult } from "@/lib/form-result";
import { now } from "@/lib/now";
import { type AddRefusal, addPoliticianAddress, removePoliticianAddress } from "@/lib/politicians/aliases.server";
import { editPoliticianDetails, type EditRefusal, isMark, setMark } from "@/lib/politicians/edits.server";
import { setStatus } from "@/lib/politicians/records.server";
import { ownId, ownText, statusFrom } from "@/lib/staff-forms";
import { londonDayTime } from "@/lib/staff-time";

/**
 * The form on a politician's page: sets their answer to an ask, dated today
 * in London, or clears it, with its note of how we know, which must say
 * something.
 */
export async function setAskStatus(form: FormData): Promise<FormResult<"blank">> {
  const { email } = await requireStaff();
  const parsed = statusFrom(form);
  if (!parsed.ok) return parsed;
  const today = londonDayTime(now()).day;
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
  return { ok: true };
}

/** A marker's button in a politician's band: turns it on or off, as its form says. */
export async function setMarkNow(form: FormData): Promise<FormResult<never>> {
  const { email } = await requireStaff();
  const id = ownId(form, "politicianId");
  const mark = ownText(form, "mark");
  const on = ownText(form, "on");
  if (!isMark(mark) || (on !== "true" && on !== "false"))
    throw new Error("A marker's form came without its marker, or which way to turn it");
  await setMark(id, mark, on === "true", email);
  revalidatePath(`/staff/politicians/${id}`);
  revalidatePath("/staff/politicians");
  return { ok: true };
}

/**
 * The form of a politician's details: saves what staff changed, or says why
 * not. One no longer there to edit is "gone", and the staff pages catch up.
 */
export async function editPoliticianNow(form: FormData): Promise<FormResult<EditRefusal>> {
  const { email } = await requireStaff();
  const id = ownId(form, "politicianId");
  const given = form.get("email");
  const result = await editPoliticianDetails(
    id,
    {
      salutation: String(form.get("salutation") ?? ""),
      note: String(form.get("note") ?? ""),
      ...(given === null ? {} : { email: String(given) }),
    },
    email,
  );
  if (result.saved || result.why === "gone") revalidatePath("/staff", "layout");
  return result.saved ? { ok: true } : refused(result.why);
}

/**
 * The form in a politician's aliases: adds an address to theirs, as the
 * staff member, keeping the mail with it the mailboxes hold, or says why
 * not. A politician no longer there is "gone", and the staff pages catch up.
 */
export async function addAliasNow(form: FormData): Promise<FormResult<AddRefusal>> {
  const { email } = await requireStaff();
  const politicianId = ownId(form, "politicianId");
  const result = await addPoliticianAddress(
    politicianId,
    String(form.get("address") ?? ""),
    email,
    String(form.get("note") ?? ""),
  );
  // Their page, and any thread's, which can now show them.
  if (result.added || result.why === "gone") revalidatePath("/staff", "layout");
  return result.added ? { ok: true } : refused(result.why);
}

/** The button by an address staff added to a politician's: removes it. One gone already is as removed as was asked. */
export async function removeAliasNow(form: FormData): Promise<FormResult<never>> {
  const { email } = await requireStaff();
  const politicianId = ownId(form, "politicianId");
  if (await removePoliticianAddress(politicianId, ownText(form, "address"), email)) revalidatePath("/staff", "layout");
  return { ok: true };
}
