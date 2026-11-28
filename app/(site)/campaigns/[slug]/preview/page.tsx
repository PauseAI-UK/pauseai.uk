import type { Metadata } from "next";
import { campaignPath } from "@/lib/content/campaigns";
import { copy } from "@/lib/content/email-your-mp";
import { found } from "@/lib/found";
import { madeCampaign } from "@/lib/mailings/made-campaigns.server";
import { pageMetadata } from "@/lib/metadata";
import { config } from "@/lib/server/config.server";
import LetterPreview from "../../_components/LetterPreview";
import LetterStep from "../../_components/LetterStep";

// The letter from the form of a campaign staff made, before it's sent. Unlisted, and kept out of search.

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const campaign = found(await madeCampaign((await params).slug));
  return {
    ...pageMetadata({
      title: copy.preview.title,
      description: copy.preview.title,
      path: `${campaignPath(campaign)}/preview`,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: Params) {
  const campaign = found(await madeCampaign((await params).slug));
  return (
    <LetterStep title={copy.preview.title}>
      <LetterPreview campaign={campaign} turnstileSiteKey={config.turnstileSiteKey} />
    </LetterStep>
  );
}
