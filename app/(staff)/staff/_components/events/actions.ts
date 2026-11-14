"use server";

// The events page's Server Actions. Each is a public endpoint, so each calls
// requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/accounts/auth";
import { type EventSaved, setEventDoc, setEventOwner } from "@/lib/events/staff-events";
import { eventFrom } from "@/lib/staff-forms";

/**
 * An event's edit form on the events page: makes the staff member chosen
 * its owner, which emails them and the owner before, and sets or clears its
 * Google Doc. Any staff member can. Returns whom it emailed, and the new
 * owner, for the page to say so.
 */
export async function saveEventNow(form: FormData): Promise<EventSaved> {
  const { email } = await requireStaff();
  const parsed = eventFrom(form);
  if (!parsed) return { emailed: [], owner: null };
  const emailed = parsed.owner ? await setEventOwner(parsed.eventId, parsed.owner, email) : undefined;
  const doc = await setEventDoc(parsed.eventId, parsed.doc, email);
  if (emailed || doc) revalidatePath("/staff/events");
  return { emailed: emailed ?? [], owner: parsed.owner };
}
