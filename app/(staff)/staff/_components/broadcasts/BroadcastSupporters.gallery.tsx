// BroadcastSupporters in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { BroadcastSupportersExample, ChoosingBroadcastFrameExample } from "./BroadcastSupporters.gallery.client";

export const broadcastSupportersGallery: Example[] = [
  {
    name: "BroadcastSupporters",
    file: "app/(staff)/staff/_components/broadcasts/BroadcastSupporters.tsx",
    variants: [
      {
        label: "With a Consent filter answered yes; without one there's none",
        render: () => (
          <StaffPage as="div">
            <BroadcastSupportersExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "ChoosingBroadcastFrame",
    file: "app/(staff)/staff/_components/broadcasts/BroadcastSupporters.tsx",
    variants: [
      {
        label: "Change who: the dark strip at the top, and the bar at the foot",
        render: () => (
          <StaffPage as="div">
            <ChoosingBroadcastFrameExample />
          </StaffPage>
        ),
      },
    ],
  },
];
