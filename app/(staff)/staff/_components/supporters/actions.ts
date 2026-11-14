"use server";

// The supporter pages' Server Actions: recording an opt-out, and uploading
// sign-ups. Each is a public endpoint, so each calls requireStaff() before
// anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/accounts/auth.server";
import { idFrom } from "@/lib/staff-forms";
import { offCalendarAfter } from "@/lib/supporters/email-settings.server";
import { chosen, optOutChoices } from "@/lib/supporters/opt-out-choices";
import { recordStaffOptOut } from "@/lib/supporters/opt-outs.server";
import { getSupporter } from "@/lib/supporters/records.server";
import type { SignupUploadInput } from "@/lib/supporters/signup-csv";
import { finishSignupUpload, planSignupUpload } from "@/lib/supporters/signup-uploads.server";

/**
 * The form in a supporter's consents: records that they opted out of what
 * staff chose, at one of their addresses or numbers, with how they said so;
 * events by email, or every bulk email, takes them off our Luma calendar too.
 * Says whether it was new; false for a choice not theirs, or no how.
 */
export async function recordOptOutNow(form: FormData): Promise<boolean> {
  const { email } = await requireStaff("supporters");
  const id = idFrom(form, "supporterId");
  const how = String(form.get("how") ?? "").trim();
  const supporter = id ? await getSupporter(id) : undefined;
  const choice = supporter && chosen(form.get("choice"), optOutChoices(supporter.permissions));
  if (!choice || !how) return false;
  const recorded = await recordStaffOptOut(choice, email, { how });
  if (recorded) await offCalendarAfter([{ ...choice, source: "staff" }]);
  revalidatePath(`/staff/supporters/${id}`);
  return recorded;
}

/** What a file would do, for the preview. */
export async function previewSignupUpload(input: SignupUploadInput) {
  await requireStaff("supporters");
  return planSignupUpload(input);
}

/** Imports a file, if it would still do what `signature`'s preview showed. */
export async function importSignupUpload(input: SignupUploadInput, signature: string) {
  const { email } = await requireStaff("supporters");
  const finished = await finishSignupUpload(input, signature, email);
  revalidatePath("/staff/supporters");
  return finished;
}
