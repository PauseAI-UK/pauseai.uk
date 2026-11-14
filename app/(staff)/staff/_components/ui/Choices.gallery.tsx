// Choices in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Choices from "./Choices";
import StaffPage from "./StaffPage";

const EXAMPLE_NATIONS = [
  {
    name: "nation",
    label: "Nation",
    repeat: true,
    options: [
      { value: "england", label: "England" },
      { value: "scotland", label: "Scotland" },
      { value: "wales", label: "Wales" },
      { value: "ireland", label: "Northern Ireland" },
    ],
  },
];

export const choicesGallery: Example[] = [
  {
    name: "Choices",
    file: "app/(staff)/staff/_components/ui/Choices.tsx",
    variants: [
      {
        label: "A filter's choices, one chosen",
        render: () => (
          <StaffPage as="div">
            <Choices options={EXAMPLE_NATIONS[0].options} current={["wales"]} href={() => "#"} />
          </StaffPage>
        ),
      },
    ],
  },
];
