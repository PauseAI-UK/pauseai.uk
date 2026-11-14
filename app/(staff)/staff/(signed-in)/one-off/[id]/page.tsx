import type { Metadata } from "next";
import { found } from "@/lib/found";
import { getOneOffThread } from "@/lib/letters/one-off-emails.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { letterId } from "@/lib/staff-search";
import OneOffThreadView from "../../../_components/letters/OneOffThreadView";
import Page from "../../../_components/ui/Page";
import { lettersCopy } from "../../../_components/letters/copy";

type Params = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: lettersCopy.oneOff.title };

/** One thread with a politician: every message, oldest first. */
export default async function OneOffThreadPage({ params }: Params) {
  const { permissions } = await requireStaff();
  const thread = found(await getOneOffThread(found(letterId((await params).id)), permissions));
  return (
    <Page kind="item" under="emails" here={lettersCopy.oneOff.crumb}>
      <OneOffThreadView thread={thread} />
    </Page>
  );
}
