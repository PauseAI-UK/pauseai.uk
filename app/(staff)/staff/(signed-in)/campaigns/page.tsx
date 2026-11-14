import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { now } from "@/lib/now";
import { listCampaignSummaries } from "@/lib/server/campaigns";
import { requireStaff } from "@/lib/accounts/auth";
import CampaignsOverview from "../../_components/CampaignsOverview";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";

export const metadata: Metadata = { title: staffCopy.campaigns.title };

/** Every campaign, each under the month of its most recent letter. */
export default async function CampaignsPage() {
  await requireStaff("supporters");
  return (
    <Page kind="month-list">
      <PageHead intro={staffCopy.campaigns.intro}>{staffCopy.campaigns.title}</PageHead>
      <CampaignsOverview campaigns={await listCampaignSummaries()} now={now().toISOString()} />
    </Page>
  );
}
