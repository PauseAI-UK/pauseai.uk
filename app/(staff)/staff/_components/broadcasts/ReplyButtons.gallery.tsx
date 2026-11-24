// ReplyButtons in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { ReplyButtonsExample } from "./ReplyButtons.gallery.client";

const four = ["I'm coming", "Can't make it", "Maybe", "Tell me more"].map((text) => ({ text }));

export const replyButtonsGallery: Example[] = [
  {
    name: "ReplyButtons",
    file: "app/(staff)/staff/_components/broadcasts/ReplyButtons.tsx",
    variants: [
      {
        label: "None yet: add one",
        render: () => (
          <StaffPage as="div">
            <ReplyButtonsExample initial={[]} />
          </StaffPage>
        ),
      },
      {
        label: "Four, and what a computer does with that many",
        render: () => (
          <StaffPage as="div">
            <ReplyButtonsExample initial={four} />
          </StaffPage>
        ),
      },
      {
        label: "A chosen template's, fixed",
        render: () => (
          <StaffPage as="div">
            <ReplyButtonsExample initial={four.slice(0, 2)} fixed />
          </StaffPage>
        ),
      },
    ],
  },
];
