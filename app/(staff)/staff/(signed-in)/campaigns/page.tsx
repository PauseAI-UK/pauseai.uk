import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { now } from "@/lib/now";
import { listCampaignSummaries } from "@/lib/mailings/campaigns.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import CampaignsOverview from "../../_components/mailings/CampaignsOverview";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";
import { mailingsCopy } from "../../_components/mailings/copy";

export const metadata: Metadata = { title: mailingsCopy.campaigns.title };

/** Every campaign, each under the month of its most recent letter. New campaign makes one with no code. */
export default async function CampaignsPage() {
  await requireStaff("supporters");
  return (
    <Page kind="month-list">
      <PageHead
        intro={mailingsCopy.campaigns.intro}
        action={
          <ButtonLink variant="primary" fit href="/staff/campaigns/new">
            {mailingsCopy.campaigns.newCampaign}
          </ButtonLink>
        }
      >
        {mailingsCopy.campaigns.title}
      </PageHead>
      <CampaignsOverview campaigns={await listCampaignSummaries()} now={now().toISOString()} />
    </Page>
  );
}
