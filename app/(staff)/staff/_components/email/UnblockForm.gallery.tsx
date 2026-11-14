// UnblockForm in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { UnblockBubbleExample, UnblockFormExample } from "./UnblockForm.gallery.client";

export const unblockFormGallery: Example[] = [
  {
    name: "UnblockForm",
    file: "app/(staff)/staff/_components/email/UnblockForm.tsx",
    variants: [
      {
        label: "For a bounce, and for a complaint, which can't be unblocked",
        render: () => (
          <StaffPage as="div">
            <UnblockFormExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "UnblockBubble",
    file: "app/(staff)/staff/_components/email/UnblockForm.tsx",
    variants: [
      {
        label: "In a list's row: a button that opens the bubble asking why; and a complaint, which can't be unblocked",
        render: () => (
          <StaffPage as="div">
            <UnblockBubbleExample />
          </StaffPage>
        ),
      },
    ],
  },
];
