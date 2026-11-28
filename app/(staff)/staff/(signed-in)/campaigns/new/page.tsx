import type { Metadata } from "next";
import { requireStaff } from "@/lib/accounts/auth.server";
import { campaignWriterData, firstLetter } from "@/lib/mailings/campaign-letters.server";
import { mailingsCopy } from "@/lib/mailings/copy";
import { newCampaign } from "../../../_components/mailings/actions";
import NewCampaignWriter from "../../../_components/mailings/NewCampaignWriter";
import Page from "../../../_components/ui/Page";
import { mailingsCopy as staffMailingsCopy } from "../../../_components/mailings/copy";

const copy = staffMailingsCopy.newCampaign;

export const metadata: Metadata = { title: copy.pageTitle };

/** New campaign: its title, ask and letter, kept only once it's made. */
export default async function NewCampaignPage() {
  await requireStaff("supporters");
  const data = await campaignWriterData();
  return (
    <Page kind="form" under="campaigns" here={copy.pageTitle}>
      <NewCampaignWriter
        start={firstLetter(mailingsCopy.mailingPages.greeting)}
        mps={data.mps}
        asks={data.asks}
        conditions={data.conditions}
        create={newCampaign}
      />
    </Page>
  );
}
