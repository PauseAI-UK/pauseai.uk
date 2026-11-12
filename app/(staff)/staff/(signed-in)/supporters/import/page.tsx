import type { Metadata } from "next";
import { buttonClass } from "@/components/ui/Button";
import { staffCopy } from "@/lib/content/staff-interface";
import { now } from "@/lib/now";
import { signupEventChoices } from "@/lib/server/signup-uploads";
import { SIGNUP_UPLOADS_PATH } from "@/lib/signup-upload";
import { requireStaff } from "@/lib/server/staff-auth";
import SignupUploadForm from "../../../_components/SignupUploadForm";
import Page from "../../../_components/ui/Page";
import PageHead from "../../../_components/ui/PageHead";
import StaffLink from "../../../_components/ui/StaffLink";
import { importSignupUpload, previewSignupUpload } from "../../../signup-upload-actions";

const copy = staffCopy.signupUpload;

export const metadata: Metadata = { title: copy.title };

/** Uploading a CSV of paper sign-ups, with the way to the uploads so far. */
export default async function SignupUploadPage() {
  await requireStaff("supporters");
  const events = await signupEventChoices();
  return (
    <Page kind="form">
      <PageHead
        intro={copy.intro}
        action={
          <StaffLink className={buttonClass({ variant: "ghost", fit: true })} href={SIGNUP_UPLOADS_PATH}>
            {copy.uploads.see}
          </StaffLink>
        }
      >
        {copy.title}
      </PageHead>
      <SignupUploadForm
        events={events}
        today={now().toISOString().slice(0, 10)}
        actions={{ preview: previewSignupUpload, finish: importSignupUpload }}
      />
    </Page>
  );
}
