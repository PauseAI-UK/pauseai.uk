import type { Metadata } from "next";
import { campaignPath } from "@/lib/content/campaigns";
import { copy } from "@/lib/content/email-your-mp";
import { found } from "@/lib/found";
import { madeCampaign } from "@/lib/mailings/made-campaigns.server";
import { pageMetadata } from "@/lib/metadata";
import { getEvents } from "@/lib/server/outside-services/luma-calendar.server";
import LetterSent from "../../_components/LetterSent";
import LetterStep from "../../_components/LetterStep";
import NearbyEvents from "../../_components/NearbyEvents";

// After the letter of a campaign staff made is sent, with events near the sender. Unlisted, and kept out of search.

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const campaign = found(await madeCampaign((await params).slug));
  return {
    ...pageMetadata({ title: copy.sent.title, description: copy.sent.title, path: `${campaignPath(campaign)}/sent` }),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: Params) {
  const campaign = found(await madeCampaign((await params).slug));
  const events = await getEvents();
  return (
    <LetterStep title={copy.sent.title} after={<NearbyEvents campaignSlug={campaign.slug} events={events} />}>
      <LetterSent campaign={campaign} />
    </LetterStep>
  );
}
