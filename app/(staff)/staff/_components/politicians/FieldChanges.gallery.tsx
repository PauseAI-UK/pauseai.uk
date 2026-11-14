// FieldChanges in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { FieldChanges } from "./FieldChanges";
import StaffPage from "../ui/StaffPage";

export const fieldChangesGallery: Example[] = [
  {
    name: "FieldChanges",
    file: "app/(staff)/staff/_components/politicians/FieldChanges.tsx",
    variants: [
      {
        label: "What an edit changed, each field before and after",
        render: () => (
          <StaffPage as="div">
            <FieldChanges changed={{ party: ["Labour", "Independent"], email: [null, "polly@example.org"] }} />
          </StaffPage>
        ),
      },
    ],
  },
];
