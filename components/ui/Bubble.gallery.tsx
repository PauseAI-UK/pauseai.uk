// Bubble in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Bubble, { BubbleBox } from "@/components/ui/Bubble";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";
import { bubbleTrigger } from "@/components/ui/bubble-trigger";

export const bubbleGallery: Example[] = [
  {
    name: "Bubble",
    file: "components/ui/Bubble.tsx",
    variants: [
      {
        label: "A button that opens a form or a few words, pointing to it",
        render: () => (
          <StaffPage as="div">
            <Bubble id="example-bubble" label="Edit">
              <p>A small form</p>
            </Bubble>
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "BubbleBox",
    file: "components/ui/Bubble.tsx",
    variants: [
      {
        label: "The bubble alone, for a button of its own look",
        render: () => (
          <StaffPage as="div">
            <button type="button" {...bubbleTrigger("example-bubble-box")}>
              ?
            </button>
            <BubbleBox id="example-bubble-box">
              <p>A few words</p>
            </BubbleBox>
          </StaffPage>
        ),
      },
    ],
  },
];
