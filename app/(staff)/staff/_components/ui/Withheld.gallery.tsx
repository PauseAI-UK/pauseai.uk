// Withheld in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "./StaffPage";
import Withheld from "./Withheld";

export const withheldGallery: Example[] = [
  {
    name: "Withheld",
    file: "app/(staff)/staff/_components/ui/Withheld.tsx",
    variants: [
      {
        label: "In place of something a permission keeps back",
        render: () => (
          <StaffPage as="div">
            <p>
              <Withheld>Only staff with a permission can read this.</Withheld>
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
