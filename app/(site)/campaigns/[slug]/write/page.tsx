import type { Metadata } from "next";
import { campaignPath } from "@/lib/content/campaigns";
import { copy } from "@/lib/content/email-your-mp";
import { found } from "@/lib/found";
import { publishedLetter } from "@/lib/mailings/campaign-letters.server";
import { madeCampaign } from "@/lib/mailings/made-campaigns.server";
import { pageMetadata } from "@/lib/metadata";
import LetterStep from "../../_components/LetterStep";
import LetterWrite from "../../_components/LetterWrite";

// Writing a campaign staff made's letter, after finding the MP, from the
// version they last published. Unlisted, and kept out of search.

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const campaign = found(await madeCampaign((await params).slug));
  return {
    ...pageMetadata({
      title: copy.write.title,
      description: copy.write.title,
      path: `${campaignPath(campaign)}/write`,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: Params) {
  const campaign = found(await madeCampaign((await params).slug));
  const letter = await publishedLetter(campaign.slug);
  return (
    <LetterStep title={copy.write.title}>
      <LetterWrite campaign={campaign} letter={letter} />
    </LetterStep>
  );
}
