// DeleteTwice in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "./StaffPage";
import { DeleteTwiceExample } from "./DeleteTwice.gallery.client";

export const deleteTwiceGallery: Example[] = [
  {
    name: "DeleteTwice",
    file: "app/(staff)/staff/_components/ui/DeleteTwice.tsx",
    variants: [
      {
        label: "Press once to arm it, twice to delete; and one that can't be pressed",
        render: () => (
          <StaffPage as="div">
            <DeleteTwiceExample />
          </StaffPage>
        ),
      },
    ],
  },
];
