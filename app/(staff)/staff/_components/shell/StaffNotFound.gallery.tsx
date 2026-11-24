// StaffNotFound in the component gallery (app/(tools)/gallery/), in the staff interface's shell.
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import StaffNotFound from "./StaffNotFound";

export const staffNotFoundGallery: Example[] = [
  {
    name: "StaffNotFound",
    file: "app/(staff)/staff/_components/shell/StaffNotFound.tsx",
    variants: [
      {
        label: "In place of a staff page whose record isn't there",
        render: () => (
          <StaffPage as="div">
            <StaffNotFound />
          </StaffPage>
        ),
      },
    ],
  },
];
