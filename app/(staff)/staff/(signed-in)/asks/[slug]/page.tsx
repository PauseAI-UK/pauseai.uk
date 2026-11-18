import type { Metadata } from "next";
import { found } from "@/lib/found";
import { askPageData, askTitle } from "@/lib/asks/records.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import AskView from "../../../_components/asks/AskView";
import Page from "../../../_components/ui/Page";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireStaff();
  return { title: found(await askTitle((await params).slug)) };
}

/** An ask: what they were asked, how we asked, and their answers. */
export default async function AskPage({ params }: Params) {
  await requireStaff();
  const ask = found(await askPageData((await params).slug));
  return (
    <Page kind="record" under="asks" here={ask.title}>
      <AskView ask={ask} />
    </Page>
  );
}
