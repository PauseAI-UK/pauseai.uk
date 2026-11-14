// BroadcastConsent in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { BroadcastConsentExample } from "./BroadcastConsent.gallery.client";

export const broadcastConsentGallery: Example[] = [
  {
    name: "BroadcastConsent",
    file: "app/(staff)/staff/_components/broadcasts/BroadcastConsent.tsx",
    variants: [
      {
        label: "Said yes to: none chosen yet, then one with words of its own, so only by email",
        render: () => (
          <StaffPage as="div">
            <BroadcastConsentExample />
          </StaffPage>
        ),
      },
    ],
  },
];
