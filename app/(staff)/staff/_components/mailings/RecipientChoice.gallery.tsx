// useRecipientChoice in the component gallery (app/(tools)/gallery/), in the staff mailings and
// events group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { RecipientChoiceExample } from "./RecipientChoice.gallery.client";

export const recipientChoiceGallery: Example[] = [
  {
    name: "useRecipientChoice",
    file: "app/(staff)/staff/_components/mailings/RecipientChoice.tsx",
    variants: [
      {
        label: "A part's button, then the choice of MP",
        render: () => (
          <StaffPage as="div">
            <RecipientChoiceExample />
          </StaffPage>
        ),
      },
    ],
  },
];
