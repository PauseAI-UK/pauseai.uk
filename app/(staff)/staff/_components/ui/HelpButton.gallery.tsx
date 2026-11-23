// HelpButton in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { BubbleBox } from "@/components/ui/Bubble";
import HelpButton from "./HelpButton";
import StaffPage from "./StaffPage";

export const helpButtonGallery: Example[] = [
  {
    name: "HelpButton",
    file: "app/(staff)/staff/_components/ui/HelpButton.tsx",
    variants: [
      {
        label: 'A "?" and an "i" beside words, each opening a bubble of a few words on them',
        render: () => (
          <StaffPage as="div">
            <p>
              Updates{" "}
              <HelpButton bubble="gallery-help-q" name="What Updates means">
                ?
              </HelpButton>
              {" · "}
              Open in Gmail{" "}
              <HelpButton bubble="gallery-help-i" name="About Open in Gmail">
                i
              </HelpButton>
            </p>
            <BubbleBox id="gallery-help-q">Everyone who wants to hear from PauseAI UK.</BubbleBox>
            <BubbleBox id="gallery-help-i">Which mailbox it opens.</BubbleBox>
          </StaffPage>
        ),
      },
    ],
  },
];
