// TextButtons in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { TextButtonsExample } from "./TextButtons.gallery.client";

const four = ["I'm coming", "Can't make it", "Maybe", "Tell me more"].map((text) => ({ text }));

export const textButtonsGallery: Example[] = [
  {
    name: "TextButtons",
    file: "app/(staff)/staff/_components/broadcasts/TextButtons.tsx",
    variants: [
      {
        label: "None yet: add one",
        render: () => (
          <StaffPage as="div">
            <TextButtonsExample initial={[]} />
          </StaffPage>
        ),
      },
      {
        label: "Four, and what a computer does with that many",
        render: () => (
          <StaffPage as="div">
            <TextButtonsExample initial={four} />
          </StaffPage>
        ),
      },
      {
        label: "A reply button and a link button, and what a computer does with both",
        render: () => (
          <StaffPage as="div">
            <TextButtonsExample initial={[four[0], { text: "Details", url: "https://pauseai.uk/march" }]} />
          </StaffPage>
        ),
      },
      {
        label: "A chosen template's, fixed",
        render: () => (
          <StaffPage as="div">
            <TextButtonsExample initial={four.slice(0, 2)} fixed />
          </StaffPage>
        ),
      },
    ],
  },
];
