import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { found } from "@/lib/found";
import { recentLetters } from "@/lib/server/letters";
import { requireStaff } from "@/lib/server/staff-auth";
import { getSupporter } from "@/lib/server/supporters";
import { supporterId } from "@/lib/staff-search";
import { supporterTitle } from "@/lib/supporters";
import LettersTable from "../../../../_components/LettersTable";
import Page from "../../../../_components/ui/Page";
import PageHead from "../../../../_components/ui/PageHead";

type Params = { params: Promise<{ id: string }> };

/** The supporter with the ID in the URL, or a 404. */
async function supporterOf(params: Params["params"]) {
  return found(await getSupporter(found(supporterId((await params).id))));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireStaff("supporters");
  return { title: staffCopy.letters.fromTitle(supporterTitle((await supporterOf(params)).summary)) };
}

/** One supporter's letters, from their page, which is the way back. */
export default async function SupporterLettersPage({ params }: Params) {
  await requireStaff("supporters");
  const { summary } = await supporterOf(params);
  const name = supporterTitle(summary);
  const letters = await recentLetters({ supporterId: summary.id });
  return (
    <Page
      kind="list"
      under="supporters"
      via={[{ href: `/staff/supporters/${summary.id}`, label: name }]}
      here={staffCopy.letters.title}
    >
      <PageHead>{staffCopy.letters.fromTitle(name)}</PageHead>
      <LettersTable letters={letters} />
    </Page>
  );
}
