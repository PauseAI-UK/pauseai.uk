// EraseLink in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import EraseLink from "./EraseLink";

export const eraseLinkGallery: Example[] = [
  {
    name: "EraseLink",
    file: "app/(staff)/staff/_components/erasure/EraseLink.tsx",
    variants: [
      {
        label: "At the foot of a supporter's page",
        render: () => (
          <StaffPage as="div">
            <EraseLink supporterId={7} />
          </StaffPage>
        ),
      },
    ],
  },
];
