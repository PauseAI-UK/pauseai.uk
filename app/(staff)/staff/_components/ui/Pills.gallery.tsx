// Pills in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Pills from "./Pills";
import StaffPage from "./StaffPage";

export const pillsGallery: Example[] = [
  {
    name: "Pills",
    file: "app/(staff)/staff/_components/ui/Pills.tsx",
    variants: [
      {
        label:
          "Who a mailing is to: filters that find in the accent, one that leaves out dashed, a long one cut, to click to see whole",
        render: () => (
          <StaffPage as="div">
            <Pills
              label="Who"
              pills={[
                { words: "Event: March Against AI Extinction, 21 Nov 2026", not: false },
                { words: "Near: LS1 (10 miles)", not: false },
                { words: "Tag: not Volunteer", not: true },
              ]}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
