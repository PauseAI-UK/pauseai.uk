// NewCampaignWriter in the component gallery (app/(tools)/gallery/), in the staff mailings and
// events group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { NewCampaignWriterExample } from "./NewCampaignWriter.gallery.client";

export const newCampaignWriterGallery: Example[] = [
  {
    name: "NewCampaignWriter",
    file: "app/(staff)/staff/_components/mailings/NewCampaignWriter.tsx",
    variants: [
      {
        label: "A new campaign, its letter started on a greeting",
        render: () => (
          <StaffPage as="div">
            <NewCampaignWriterExample />
          </StaffPage>
        ),
      },
    ],
  },
];
