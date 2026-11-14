// CampaignsOverview in the component gallery (app/(tools)/gallery/), in the staff letters group
// (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import CampaignsOverview, { CampaignAsk } from "./CampaignsOverview";
import { exampleCampaign, exampleCampaignEmpty, exampleCampaignNoAsk } from "./CampaignPages.examples";
import StaffPage from "../ui/StaffPage";

export const campaignsOverviewGallery: Example[] = [
  {
    name: "CampaignsOverview",
    file: "app/(staff)/staff/_components/mailings/CampaignsOverview.tsx",
    variants: [
      {
        label: "Campaigns under the months of their last letters, with and without an ask",
        render: () => (
          <StaffPage as="div">
            <CampaignsOverview
              campaigns={[exampleCampaign, exampleCampaignNoAsk, exampleCampaignEmpty]}
              now="2026-11-05T09:00:00Z"
            />
          </StaffPage>
        ),
      },
      {
        label: "With none",
        render: () => (
          <StaffPage as="div">
            <CampaignsOverview campaigns={[]} now="2026-11-05T09:00:00Z" />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "CampaignAsk",
    file: "app/(staff)/staff/_components/mailings/CampaignsOverview.tsx",
    variants: [
      {
        label: "With an ask, and with none",
        render: () => (
          <StaffPage as="div">
            <p>
              <CampaignAsk campaign={exampleCampaign} />
            </p>
            <p>
              <CampaignAsk campaign={exampleCampaignNoAsk} />
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
