import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { found } from "@/lib/found";
import { errorSeen } from "@/lib/oversight/errors-seen.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { setErrorDoneNow } from "../../../_components/oversight/actions";
import ErrorSeenView from "../../../_components/oversight/ErrorSeenView";
import Page from "../../../_components/ui/Page";

export const metadata: Metadata = { title: staffCopy.errorsSeen.one.title };

/** One error: what it is, whether it's done, and its latest happening as it was thrown. */
export default async function ErrorSeenPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("admin");
  return (
    <Page kind="record" under="errors" here={staffCopy.errorsSeen.one.title}>
      <ErrorSeenView error={found(await errorSeen((await params).id))} setDone={setErrorDoneNow} />
    </Page>
  );
}
