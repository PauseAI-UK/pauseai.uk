import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { now } from "@/lib/now";
import { listSignupUploads, signupEventChoices } from "@/lib/server/signup-uploads";
import { requireStaff } from "@/lib/server/staff-auth";
import SignupUploadForm from "../../../_components/SignupUploadForm";
import { SignupUploadsTable } from "../../../_components/SignupUploadResult";
import PageIntro from "../../../_components/ui/PageIntro";

const copy = staffCopy.signupUpload;

export const metadata: Metadata = { title: copy.title };

/** Uploading a CSV of paper sign-ups, and the uploads so far. */
export default async function SignupUploadPage() {
  await requireStaff("supporters");
  const [events, uploads] = await Promise.all([signupEventChoices(), listSignupUploads()]);
  return (
    <>
      <h1>{copy.title}</h1>
      <PageIntro>{copy.intro}</PageIntro>
      <SignupUploadForm events={events} today={now().toISOString().slice(0, 10)} />
      <SignupUploadsTable uploads={uploads} />
    </>
  );
}
