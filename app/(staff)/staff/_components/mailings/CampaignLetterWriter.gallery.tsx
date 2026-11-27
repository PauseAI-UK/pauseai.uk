// CampaignLetterWriter in the component gallery (app/(tools)/gallery/), in the staff mailings and
// events group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { CampaignLetterWriterExample } from "./CampaignLetterWriter.gallery.client";

export const campaignLetterWriterGallery: Example[] = [
  {
    name: "CampaignLetterWriter",
    file: "app/(staff)/staff/_components/mailings/CampaignLetterWriter.tsx",
    variants: [
      {
        label: "The bill's draft letter, with its part for MPs who signed ControlAI's letter",
        render: () => (
          <StaffPage as="div">
            <CampaignLetterWriterExample />
          </StaffPage>
        ),
      },
    ],
  },
];
