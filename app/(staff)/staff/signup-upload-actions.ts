"use server";

// The Server Actions of uploading sign-ups. Each is a public endpoint, so each
// calls requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import type { SignupUploadInput } from "@/lib/signup-upload";
import { finishSignupUpload, planSignupUpload } from "@/lib/server/signup-uploads";
import { requireStaff } from "@/lib/server/staff-auth";

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
