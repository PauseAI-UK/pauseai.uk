import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { requireStaff } from "@/lib/server/staff-auth";
import Breadcrumb from "../../../../_components/Breadcrumb";
import SignupUploadPreview from "../../../../_components/SignupUploadPreview";
import { importSignupUpload, previewSignupUpload } from "../../../../signup-upload-actions";

const copy = staffCopy.signupUpload.preview;

export const metadata: Metadata = { title: copy.title };

/** What a file will do, before it does it. The file is in the browser tab, so the page holds nothing of it. */
export default async function SignupUploadPreviewPage() {
  await requireStaff("supporters");
  return (
    <>
      <Breadcrumb href="/staff/supporters/upload">{copy.back}</Breadcrumb>
      <h1>{copy.title}</h1>
      <SignupUploadPreview preview={previewSignupUpload} finish={importSignupUpload} />
    </>
  );
}
