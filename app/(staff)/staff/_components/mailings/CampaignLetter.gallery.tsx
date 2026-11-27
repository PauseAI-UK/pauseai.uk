// CampaignLetter in the component gallery (app/(tools)/gallery/), in the staff letters group
// (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import CampaignLetter from "./CampaignLetter";
import { exampleConditions, exampleVersions } from "./CampaignPages.examples";
import StaffPage from "../ui/StaffPage";

export const campaignLetterGallery: Example[] = [
  {
    name: "CampaignLetter",
    file: "app/(staff)/staff/_components/mailings/CampaignLetter.tsx",
    variants: [
      {
        label: "Several versions, the latest shown",
        render: () => (
          <StaffPage as="div">
            <CampaignLetter versions={exampleVersions} conditions={exampleConditions} />
          </StaffPage>
        ),
      },
      {
        label: "A version with a part only for some MPs",
        render: () => (
          <StaffPage as="div">
            <CampaignLetter versions={exampleVersions.slice(1, 2)} conditions={exampleConditions} />
          </StaffPage>
        ),
      },
      {
        label: "Letters from before staff could edit the letter",
        render: () => (
          <StaffPage as="div">
            <CampaignLetter versions={exampleVersions.slice(2)} />
          </StaffPage>
        ),
      },
      {
        label: "One version",
        render: () => (
          <StaffPage as="div">
            <CampaignLetter versions={exampleVersions.slice(0, 1)} />
          </StaffPage>
        ),
      },
      {
        label: "No text",
        render: () => (
          <StaffPage as="div">
            <CampaignLetter versions={[]} />
          </StaffPage>
        ),
      },
    ],
  },
];
