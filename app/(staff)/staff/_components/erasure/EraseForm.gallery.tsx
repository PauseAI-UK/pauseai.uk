// EraseForm in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { EraseFormExample } from "./EraseForm.gallery.client";

export const eraseFormGallery: Example[] = [
  {
    name: "EraseForm",
    file: "app/(staff)/staff/_components/erasure/EraseForm.tsx",
    variants: [
      {
        label: "The erase page's form",
        render: () => (
          <StaffPage as="div">
            <EraseFormExample />
          </StaffPage>
        ),
      },
    ],
  },
];
