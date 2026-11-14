// PasteForm in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { PasteFormExample } from "./PasteForm.gallery.client";

export const pasteFormGallery: Example[] = [
  {
    name: "PasteForm",
    file: "app/(staff)/staff/_components/politicians/PasteForm.tsx",
    variants: [
      {
        label: "The box for names, one a line, and Find these",
        render: () => (
          <StaffPage as="div">
            <PasteFormExample />
          </StaffPage>
        ),
      },
    ],
  },
];
