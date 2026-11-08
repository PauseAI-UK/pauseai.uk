import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { listSignupUploads } from "@/lib/server/signup-uploads";
import { requireStaff } from "@/lib/server/staff-auth";
import Breadcrumb from "../../../../_components/Breadcrumb";
import { now } from "@/lib/now";
import { SignupUploadsList } from "../../../../_components/SignupUploadResult";

const copy = staffCopy.signupUpload;

export const metadata: Metadata = { title: copy.uploads.title };

/** The uploads so far, newest first, each leading to what it did. */
export default async function PreviousSignupUploadsPage() {
  await requireStaff("supporters");
  const uploads = await listSignupUploads();
  return (
    <>
      <Breadcrumb href="/staff/supporters/upload">{copy.title}</Breadcrumb>
      <h1>{copy.uploads.title}</h1>
      <SignupUploadsList uploads={uploads} now={now().toISOString()} />
    </>
  );
}
