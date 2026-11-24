"use server";

// The events page's Server Actions. Each is a public endpoint, so each calls
// requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/accounts/auth.server";
import { type EventSaved, setEventDoc, setEventOwner } from "@/lib/events/staff-events.server";
import type { FormResult } from "@/lib/form-result";
import { eventFrom } from "@/lib/staff-forms";

/**
 * An event's edit form on the events page: makes the staff member chosen
 * its owner, which emails them and the owner before, and sets or clears its
 * Google Doc. Any staff member can. Answers whom it emailed, and the new
 * owner, for the page to say so. Never refused: the form sends only what it
 * can take (eventFrom), and saving what's already so is done.
 */
export async function saveEventNow(form: FormData): Promise<FormResult<never, EventSaved>> {
  const { email } = await requireStaff();
  const parsed = eventFrom(form);
  const emailed = parsed.owner ? await setEventOwner(parsed.eventId, parsed.owner, email) : undefined;
  const doc = await setEventDoc(parsed.eventId, parsed.doc, email);
  if (emailed || doc) revalidatePath("/staff/events");
  return { ok: true, emailed: emailed ?? [], owner: parsed.owner };
}
