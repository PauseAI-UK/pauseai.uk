// PoliticianTable in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { PoliticianTableEmptyExample, PoliticianTableExample } from "./PoliticianTable.gallery.client";

export const politicianTableGallery: Example[] = [
  {
    name: "PoliticianTable",
    file: "app/(staff)/staff/_components/politicians/PoliticianTable.tsx",
    variants: [
      {
        label: "Signed and not, a test peer no longer sitting",
        render: () => (
          <StaffPage as="div">
            <PoliticianTableExample />
          </StaffPage>
        ),
      },
      {
        label: "Nobody matches",
        render: () => (
          <StaffPage as="div">
            <PoliticianTableEmptyExample />
          </StaffPage>
        ),
      },
    ],
  },
];
