// OneOffList in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { OneOffTable } from "./OneOffList";
import StaffPage from "../ui/StaffPage";
import { exampleOneOffs } from "./OneOffList.examples";

export const oneOffListGallery: Example[] = [
  {
    name: "OneOffTable",
    file: "app/(staff)/staff/_components/letters/OneOffList.tsx",
    variants: [
      {
        label: "On a person's page",
        render: () => (
          <StaffPage as="div">
            <OneOffTable threads={exampleOneOffs} />
          </StaffPage>
        ),
      },
    ],
  },
];
