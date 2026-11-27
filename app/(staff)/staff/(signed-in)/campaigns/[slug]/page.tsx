import type { Metadata } from "next";
import { found } from "@/lib/found";
import { campaignVersions, getCampaignSummary } from "@/lib/mailings/campaigns.server";
import { listLetters } from "@/lib/letters/records.server";
import { unpublishedDraft } from "@/lib/mailings/campaign-letters.server";
import { discardCampaignLetter } from "../../../_components/mailings/actions";
import { listAsks } from "@/lib/asks/records.server";
import { answerLabels } from "@/lib/mailings/fields";
import { requireStaff } from "@/lib/accounts/auth.server";
import { lettersSearch, type LettersSearch } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import CampaignView from "../../../_components/mailings/CampaignView";
import Page from "../../../_components/ui/Page";

type Params = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Partial<Record<keyof LettersSearch, ParamValue>>>;
};

export async function generateMetadata({ params }: Pick<Params, "params">): Promise<Metadata> {
  await requireStaff("supporters");
  return { title: found(await getCampaignSummary((await params).slug)).title };
}

/**
 * A campaign: its counts, each version of its letter, with a way to edit it
 * for a campaign in the code, and its letters, searched and filtered.
 */
export default async function CampaignPage({ params, searchParams }: Params) {
  await requireStaff("supporters");
  const { slug } = await params;
  const campaign = found(await getCampaignSummary(slug));
  const { filter, ...search } = lettersSearch({ ...(await searchParams), campaign: slug });
  const [letters, { versions, changed }, asks, draft] = await Promise.all([
    listLetters(filter),
    campaignVersions(slug),
    listAsks(),
    unpublishedDraft(slug),
  ]);
  return (
    <Page kind="record" under="campaigns" here={campaign.title}>
      <CampaignView
        campaign={campaign}
        versions={versions}
        changed={changed}
        conditions={answerLabels(asks)}
        draft={draft}
        discard={discardCampaignLetter.bind(null, slug)}
        letters={letters}
        search={search}
      />
    </Page>
  );
}
