import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { found } from "@/lib/found";
import { getSignupUpload } from "@/lib/server/signup-uploads";
import { requireStaff } from "@/lib/server/staff-auth";
import { supporterId } from "@/lib/staff-search";
import Breadcrumb from "../../../../_components/Breadcrumb";
import SignupUploadResult from "../../../../_components/SignupUploadResult";

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
    <>
      <Breadcrumb href="/staff/supporters/upload">{copy.back}</Breadcrumb>
      <h1>{copy.title(upload.filename)}</h1>
      <SignupUploadResult upload={upload} />
    </>
  );
}
