// TextButtons in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { TextButtonsExample } from "./TextButtons.gallery.client";

const three = ["I'm coming", "Can't make it", "Maybe"].map((text) => ({ text }));

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
        label: "Three replies, as many as a text has",
        render: () => (
          <StaffPage as="div">
            <TextButtonsExample initial={three} />
          </StaffPage>
        ),
      },
      {
        label: "Two link buttons, as many as a text has",
        render: () => (
          <StaffPage as="div">
            <TextButtonsExample
              initial={[
                { text: "Details", url: "https://pauseai.uk/march" },
                { text: "Sign up", url: "https://luma.com/pauseai" },
              ]}
            />
          </StaffPage>
        ),
      },
      {
        label: "A chosen template's, fixed",
        render: () => (
          <StaffPage as="div">
            <TextButtonsExample initial={three.slice(0, 2)} fixed />
          </StaffPage>
        ),
      },
    ],
  },
];
