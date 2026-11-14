// CampaignLetter in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import CampaignLetter from "./CampaignLetter";
import { exampleChanged, exampleVersions } from "./CampaignPages.examples";
import StaffPage from "../ui/StaffPage";

export const campaignLetterGallery: Example[] = [
  {
    name: "CampaignLetter",
    file: "app/(staff)/staff/_components/mailings/CampaignLetter.tsx",
    variants: [
      {
        label: "Several versions, and how much people changed them",
        render: () => (
          <StaffPage as="div">
            <CampaignLetter changedHref="#changed" versions={exampleVersions} changed={exampleChanged} />
          </StaffPage>
        ),
      },
      {
        label: "One version, nothing changed",
        render: () => (
          <StaffPage as="div">
            <CampaignLetter changedHref="#changed" versions={exampleVersions.slice(0, 1)} changed={0} />
          </StaffPage>
        ),
      },
      {
        label: "No text",
        render: () => (
          <StaffPage as="div">
            <CampaignLetter changedHref="#changed" versions={[]} changed={0} />
          </StaffPage>
        ),
      },
    ],
  },
];
