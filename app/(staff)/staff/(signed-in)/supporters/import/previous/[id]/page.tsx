import type { Metadata } from "next";
import { found } from "@/lib/found";
import { getSignupUpload } from "@/lib/supporters/signup-uploads.server";
import { SIGNUP_UPLOADS_PATH } from "@/lib/supporters/signup-csv";
import { requireStaff } from "@/lib/accounts/auth.server";
import { supporterId } from "@/lib/staff-search";
import SignupUploadResult, { SignupUploadHead } from "../../../../../_components/supporters/SignupUploadResult";
import Page from "../../../../../_components/ui/Page";
import { supportersCopy } from "../../../../../_components/supporters/copy";

const copy = supportersCopy.signupUpload.result;

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
      via={[{ href: SIGNUP_UPLOADS_PATH, label: supportersCopy.signupUpload.uploads.title }]}
      here={upload.filename}
    >
      <SignupUploadHead upload={upload} />
      <SignupUploadResult upload={upload} />
    </Page>
  );
}
