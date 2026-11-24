"use server";

// The supporter pages' Server Actions: recording an opt-out, and uploading
// sign-ups. Each is a public endpoint, so each calls requireStaff() before
// anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/accounts/auth.server";
import { refused, type FormResult, type Refused } from "@/lib/form-result";
import { ownId, ownText } from "@/lib/staff-forms";
import { offCalendarAfter } from "@/lib/supporters/email-settings.server";
import { chosen, optOutChoices } from "@/lib/supporters/opt-out-choices";
import { recordStaffOptOut } from "@/lib/supporters/opt-outs.server";
import { getSupporter } from "@/lib/supporters/records.server";
import type { SignupPlan, SignupUploadInput } from "@/lib/supporters/signup-csv";
import {
  finishSignupUpload,
  planSignupUpload,
  type SignupUploadDone,
  type SignupUploadRefused,
} from "@/lib/supporters/signup-uploads.server";

/**
 * The form in a supporter's consents: records that they opted out of what
 * staff chose, at one of their addresses or numbers, with how they said so,
 * which is typed, and refused when it's blank; events by email, or every
 * bulk email, takes them off our Luma calendar too. A supporter no longer
 * there is "gone". Done, it says whether they were opted out `already`: of
 * a choice recorded since the page loaded, which is theirs to choose no
 * longer, as much as one the record finds there.
 */
export async function recordOptOutNow(form: FormData): Promise<FormResult<"blank" | "gone", { already: boolean }>> {
  const { email } = await requireStaff("supporters");
  const id = ownId(form, "supporterId");
  const sent = ownText(form, "choice");
  const how = String(form.get("how") ?? "").trim();
  if (!how) return refused("blank");
  const supporter = await getSupporter(id);
  const choice = supporter && chosen(sent, optOutChoices(supporter.permissions, supporter.summary.lumaContact));
  const recorded = choice ? await recordStaffOptOut(choice, email, { how }) : false;
  if (choice && recorded) await offCalendarAfter([{ ...choice, source: "staff" }]);
  // Their page catches up: with the opt-out, or with whatever made the choice, or them, go.
  revalidatePath(`/staff/supporters/${id}`);
  return supporter ? { ok: true, already: !recorded } : refused("gone");
}

/**
 * Why an upload was refused: what its form chose doesn't fit it, or can't
 * be used any more. A file that can't be read is thrown, as the form reads
 * it before sending it, and sends none it can't.
 */
function badChoice(refusal: SignupUploadRefused): Refused<"bad-choice"> {
  if (refusal.reason !== "bad-choice") throw new Error("A sign-up upload came with a file its form can't read");
  return refused("bad-choice");
}

/** What a file would do, for the preview. */
export async function previewSignupUpload(
  input: SignupUploadInput,
): Promise<FormResult<"bad-choice", { plan: SignupPlan }>> {
  await requireStaff("supporters");
  const plan = await planSignupUpload(input);
  return "ok" in plan ? badChoice(plan) : { ok: true, plan };
}

/** Imports a file, if it would still do what `signature`'s preview showed; if not, answers what it would do now. */
export async function importSignupUpload(
  input: SignupUploadInput,
  signature: string,
): Promise<FormResult<"bad-choice", SignupUploadDone>> {
  const { email } = await requireStaff("supporters");
  const finished = await finishSignupUpload(input, signature, email);
  revalidatePath("/staff/supporters");
  return "ok" in finished ? badChoice(finished) : { ok: true, ...finished };
}
