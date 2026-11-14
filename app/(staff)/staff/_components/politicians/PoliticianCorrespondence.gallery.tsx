// PoliticianCorrespondence in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { PoliticianCorrespondenceExample } from "./PoliticianCorrespondence.gallery.client";

export const politicianCorrespondenceGallery: Example[] = [
  {
    name: "PoliticianCorrespondence",
    file: "app/(staff)/staff/_components/politicians/PoliticianCorrespondence.tsx",
    variants: [
      {
        label: "Threads with a reply, an automatic reply, none, and own words",
        render: () => (
          <StaffPage as="div">
            <PoliticianCorrespondenceExample />
          </StaffPage>
        ),
      },
      {
        label: "Past the newest few, folded",
        render: () => (
          <StaffPage as="div">
            <PoliticianCorrespondenceExample count={12} />
          </StaffPage>
        ),
      },
    ],
  },
];
