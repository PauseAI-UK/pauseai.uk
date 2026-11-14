import type { Metadata } from "next";
import { now } from "@/lib/now";
import { listCampaignSummaries } from "@/lib/mailings/campaigns.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import CampaignsOverview from "../../_components/mailings/CampaignsOverview";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";
import { mailingsCopy } from "../../_components/mailings/copy";

export const metadata: Metadata = { title: mailingsCopy.campaigns.title };

/** Every campaign, each under the month of its most recent letter. */
export default async function CampaignsPage() {
  await requireStaff("supporters");
  return (
    <Page kind="month-list">
      <PageHead intro={mailingsCopy.campaigns.intro}>{mailingsCopy.campaigns.title}</PageHead>
      <CampaignsOverview campaigns={await listCampaignSummaries()} now={now().toISOString()} />
    </Page>
  );
}
