// BroadcastFor in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { BroadcastContact, BroadcastWho } from "./BroadcastFor";
import { exampleBroadcastData, exampleSupporterChoices } from "./BroadcastWriter.examples";
import StaffPage from "../ui/StaffPage";
import { BroadcastForExample } from "./BroadcastFor.gallery.client";

export const broadcastForGallery: Example[] = [
  {
    name: "BroadcastFor",
    file: "app/(staff)/staff/_components/broadcasts/BroadcastFor.tsx",
    variants: [
      {
        label: "As it stands: here, sent",
        render: () => (
          <StaffPage as="div">
            <BroadcastForExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "BroadcastContact",
    file: "app/(staff)/staff/_components/broadcasts/BroadcastFor.tsx",
    variants: [
      {
        label: "What they all said yes to: by email, then by text",
        render: () => (
          <StaffPage as="div">
            <p>
              <BroadcastContact params={{ contact: "email:events:yes" }} />
            </p>
            <p>
              <BroadcastContact params={{ contact: "text:events:yes" }} />
            </p>
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "BroadcastWho",
    file: "app/(staff)/staff/_components/broadcasts/BroadcastFor.tsx",
    variants: [
      {
        label: "The filters but Consent, as pills",
        render: () => (
          <StaffPage as="div">
            <BroadcastWho params={exampleBroadcastData.filter.params} choices={exampleSupporterChoices} />
          </StaffPage>
        ),
      },
    ],
  },
];
