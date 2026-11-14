// CampaignView in the component gallery (app/(tools)/gallery/), in the staff letters group
// (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import CampaignView from "./CampaignView";
import { exampleChanged, exampleCampaign, exampleCampaignNoAsk, exampleVersions } from "./CampaignPages.examples";
import { emptyLettersSearch, exampleLetter } from "../LettersTable.examples";
import StaffPage from "../ui/StaffPage";

export const campaignViewGallery: Example[] = [
  {
    name: "CampaignView",
    file: "app/(staff)/staff/_components/mailings/CampaignView.tsx",
    variants: [
      {
        label: "With an ask",
        render: () => (
          <StaffPage as="div">
            <CampaignView
              campaign={exampleCampaign}
              versions={exampleVersions}
              changed={exampleChanged}
              letters={{
                letters: [exampleLetter, { ...exampleLetter, id: 2, status: "sent", answer: "signed" }],
                total: 150,
                pages: 2,
                pageSize: 100,
              }}
              search={emptyLettersSearch}
            />
          </StaffPage>
        ),
      },
      {
        label: "With no ask",
        render: () => (
          <StaffPage as="div">
            <CampaignView
              campaign={exampleCampaignNoAsk}
              versions={[]}
              changed={exampleChanged}
              letters={{ letters: [], total: 0, pages: 1, pageSize: 100 }}
              search={emptyLettersSearch}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
