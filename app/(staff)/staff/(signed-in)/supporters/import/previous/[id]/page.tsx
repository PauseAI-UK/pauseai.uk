import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { found } from "@/lib/found";
import { getSignupUpload } from "@/lib/server/signup-uploads";
import { SIGNUP_UPLOADS_PATH } from "@/lib/signup-upload";
import { requireStaff } from "@/lib/server/staff-auth";
import { supporterId } from "@/lib/staff-search";
import SignupUploadResult, { SignupUploadHead } from "../../../../../_components/SignupUploadResult";
import Page from "../../../../../_components/ui/Page";

const copy = staffCopy.signupUpload.result;

type Params = { params: Promise<{ id: string }> };

async function theUpload({ params }: Params) {
  return found(await getSignupUpload(found(supporterId((await params).id))));
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  await requireStaff("supporters");
  return { title: copy.title((await theUpload(props)).filename) };
}

/** What one upload did. */
export default async function SignupUploadResultPage(props: Params) {
  await requireStaff("supporters");
  const upload = await theUpload(props);
  return (
    <Page
      kind="item"
      under="signupUpload"
      via={[{ href: SIGNUP_UPLOADS_PATH, label: staffCopy.signupUpload.uploads.title }]}
      here={upload.filename}
    >
      <SignupUploadHead upload={upload} />
      <SignupUploadResult upload={upload} />
    </Page>
  );
}
