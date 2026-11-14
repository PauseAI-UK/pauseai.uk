import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { listSignupUploads } from "@/lib/server/signup-uploads";
import { requireStaff } from "@/lib/accounts/auth";
import Page from "../../../../_components/ui/Page";
import PageHead from "../../../../_components/ui/PageHead";
import { now } from "@/lib/now";
import { SignupUploadsList } from "../../../../_components/SignupUploadResult";

const copy = staffCopy.signupUpload;

export const metadata: Metadata = { title: copy.uploads.title };

/** The uploads so far, newest first, each leading to what it did. */
export default async function PreviousSignupUploadsPage() {
  await requireStaff("supporters");
  const uploads = await listSignupUploads();
  return (
    <Page kind="month-list" under="signupUpload" here={copy.uploads.title}>
      <PageHead>{copy.uploads.title}</PageHead>
      <SignupUploadsList uploads={uploads} now={now().toISOString()} />
    </Page>
  );
}
