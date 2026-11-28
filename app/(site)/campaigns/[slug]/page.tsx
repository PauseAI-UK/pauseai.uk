import type { Metadata } from "next";
import { campaignPath } from "@/lib/content/campaigns";
import { copy } from "@/lib/content/email-your-mp";
import { found } from "@/lib/found";
import { madeCampaign } from "@/lib/mailings/made-campaigns.server";
import { pageMetadata } from "@/lib/metadata";
import { config } from "@/lib/server/config.server";
import CampaignHero from "../_components/CampaignHero";
import EmailYourMpSection from "../_components/EmailYourMpSection";

// A campaign staff made (lib/mailings/made-campaigns.server.ts): its title
// over the form, with no words of its own. The code's campaigns have pages
// of their own beside this one, which win over it. Not in the site's
// navigation, and no other campaign's page moves anyone on to it.

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const campaign = found(await madeCampaign((await params).slug));
  return pageMetadata({ title: campaign.title, description: copy.pageDescription, path: campaignPath(campaign) });
}

export default async function Page({ params }: Params) {
  const campaign = found(await madeCampaign((await params).slug));
  return (
    <main>
      <CampaignHero title={campaign.title} campaignSlug={campaign.slug} />
      <EmailYourMpSection
        campaign={campaign}
        // Outside production, letters only go to the test MPs, so say how to find them.
        showTestMps={!config.production}
      />
    </main>
  );
}
