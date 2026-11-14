// CampaignName in the component gallery (app/(tools)/gallery/), in the staff interface: letters (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import CampaignName from "./CampaignName";
import StaffPage from "./ui/StaffPage";
import { campaigns } from "@/lib/content/email-your-mp";

const [pm] = campaigns;

export const campaignNameGallery: Example[] = [
  {
    name: "CampaignName",
    file: "app/(staff)/staff/_components/CampaignName.tsx",
    variants: [
      {
        label: "Leading to its page, by its name or its slug; and plain, for staff who can't open it",
        render: () => (
          <StaffPage as="div">
            <p>
              <CampaignName slug={pm.slug} /> · <CampaignName slug="old-campaign" /> ·{" "}
              <CampaignName slug={pm.slug} linked={false} />
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
