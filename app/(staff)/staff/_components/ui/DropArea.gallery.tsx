// DropArea in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { DropAreaExample } from "./DropArea.gallery.client";
import StaffPage from "./StaffPage";

export const dropAreaGallery: Example[] = [
  {
    name: "DropArea",
    file: "app/(staff)/staff/_components/ui/DropArea.tsx",
    variants: [
      {
        label: "Files to drop on it, or choose",
        render: () => (
          <StaffPage as="div">
            <DropAreaExample />
          </StaffPage>
        ),
      },
      {
        label: "While what was given is on its way",
        render: () => (
          <StaffPage as="div">
            <DropAreaExample pending />
          </StaffPage>
        ),
      },
    ],
  },
];
