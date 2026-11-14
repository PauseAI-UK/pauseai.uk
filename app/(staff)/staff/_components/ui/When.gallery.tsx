// When in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "./StaffPage";
import When from "./When";

const EXAMPLE_AT = new Date("2026-10-16T10:34:00Z");

export const whenGallery: Example[] = [
  {
    name: "When",
    file: "app/(staff)/staff/_components/ui/When.tsx",
    variants: [
      {
        label: "The day and the time, and the day alone, on one line in a box too narrow for them",
        render: () => (
          <StaffPage as="div">
            <div style={{ display: "grid", gap: "8px", width: "4rem" }}>
              <When at={EXAMPLE_AT} />
              <When at={EXAMPLE_AT} day />
            </div>
          </StaffPage>
        ),
      },
    ],
  },
];
