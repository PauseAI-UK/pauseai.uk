import type { Metadata } from "next";
import { listSignupUploads } from "@/lib/supporters/signup-uploads";
import { requireStaff } from "@/lib/accounts/auth";
import Page from "../../../../_components/ui/Page";
import PageHead from "../../../../_components/ui/PageHead";
import { now } from "@/lib/now";
import { SignupUploadsList } from "../../../../_components/supporters/SignupUploadResult";
import { supportersCopy } from "../../../../_components/supporters/copy";

const copy = supportersCopy.signupUpload;

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
