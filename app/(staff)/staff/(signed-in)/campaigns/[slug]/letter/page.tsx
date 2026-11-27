import type { Metadata } from "next";
import { requireStaff } from "@/lib/accounts/auth.server";
import { campaignBySlug } from "@/lib/email-your-mp";
import { campaignWriterData, openDraft } from "@/lib/mailings/campaign-letters.server";
import { found } from "@/lib/found";
import { getCampaignSummary } from "@/lib/mailings/campaigns.server";
import { mailingsCopy } from "@/lib/mailings/copy";
import {
  discardCampaignLetter,
  publishCampaignLetter,
  saveCampaignLetter,
} from "../../../../_components/mailings/actions";
import CampaignLetterWriter from "../../../../_components/mailings/CampaignLetterWriter";
import Page from "../../../../_components/ui/Page";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireStaff("supporters");
  return { title: found(await getCampaignSummary((await params).slug)).title };
}

/**
 * Writing a campaign's letter: its draft, opened as a copy of the latest
 * version if there's none, for a campaign in the code, whose page and the
 * rest are there.
 */
export default async function CampaignLetterPage({ params }: Params) {
  const { email } = await requireStaff("supporters");
  const { slug } = await params;
  found(campaignBySlug(slug));
  const campaign = found(await getCampaignSummary(slug));
  const [draft, data] = await Promise.all([
    openDraft(slug, email, mailingsCopy.mailingPages.greeting),
    campaignWriterData(),
  ]);
  return (
    <Page kind="record" under="campaigns" here={campaign.title}>
      <CampaignLetterWriter
        title={campaign.title}
        draft={draft}
        mps={data.mps}
        asks={data.asks}
        conditions={data.conditions}
        actions={{
          save: saveCampaignLetter,
          publish: publishCampaignLetter.bind(null, slug),
          discard: discardCampaignLetter.bind(null, slug),
        }}
      />
    </Page>
  );
}
