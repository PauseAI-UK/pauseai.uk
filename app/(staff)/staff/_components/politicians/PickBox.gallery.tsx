// PickBox in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { PickBoxExample } from "./PickBox.gallery.client";

export const pickBoxGallery: Example[] = [
  {
    name: "PickBox",
    file: "app/(staff)/staff/_components/politicians/PickBox.tsx",
    variants: [
      {
        label: "Ticked, not ticked, and part ticked",
        render: () => (
          <StaffPage as="div">
            <PickBoxExample />
          </StaffPage>
        ),
      },
    ],
  },
];
