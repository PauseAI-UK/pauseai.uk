// CommunityLinkForm in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { CommunityLinkFormExample } from "./WaitingRoom.gallery.client";

export const communityLinkFormGallery: Example[] = [
  {
    name: "CommunityLinkForm",
    file: "app/(staff)/staff/_components/broadcasts/CommunityLinkForm.tsx",
    variants: [
      {
        label: "The form for a new community link, as its bubble holds it",
        render: () => (
          <StaffPage as="div">
            <CommunityLinkFormExample />
          </StaffPage>
        ),
      },
    ],
  },
];
