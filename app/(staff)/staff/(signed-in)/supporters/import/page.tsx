import type { Metadata } from "next";
import { buttonClass } from "@/components/ui/Button";
import { now } from "@/lib/now";
import { signupEventChoices } from "@/lib/supporters/signup-uploads.server";
import { SIGNUP_UPLOADS_PATH } from "@/lib/supporters/signup-csv";
import { requireStaff } from "@/lib/accounts/auth.server";
import SignupUploadForm from "../../../_components/supporters/SignupUploadForm";
import Page from "../../../_components/ui/Page";
import PageHead from "../../../_components/ui/PageHead";
import StaffLink from "../../../_components/ui/StaffLink";
import { importSignupUpload, previewSignupUpload } from "../../../_components/supporters/actions";
import { supportersCopy } from "../../../_components/supporters/copy";

const copy = supportersCopy.signupUpload;

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
