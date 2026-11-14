import type { Metadata } from "next";
import { found } from "@/lib/found";
import { requireStaff } from "@/lib/accounts/auth.server";
import { getSupporter } from "@/lib/supporters/records.server";
import { supporterId } from "@/lib/staff-search";
import { supporterTitle } from "@/lib/supporters/supporters";
import { eraseSupporterNow } from "../../../../_components/erasure/actions";
import EraseForm from "../../../../_components/erasure/EraseForm";
import Page from "../../../../_components/ui/Page";
import { erasureCopy } from "@/lib/erasure/copy";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireStaff("supporters");
  const supporter = found(await getSupporter(found(supporterId((await params).id))));
  return { title: `${erasureCopy.erase.title}: ${supporterTitle(supporter.summary)}` };
}

/** Erasing one supporter: a page of its own, so it's never done by accident. */
export default async function EraseSupporterPage({ params }: Params) {
  await requireStaff("supporters");
  const supporter = found(await getSupporter(found(supporterId((await params).id))));
  return (
    <Page
      kind="form"
      under="supporters"
      via={[{ href: `/staff/supporters/${supporter.summary.id}`, label: supporterTitle(supporter.summary) }]}
      here={erasureCopy.erase.crumb}
    >
      <EraseForm supporter={supporter.summary} action={eraseSupporterNow} />
    </Page>
  );
}
