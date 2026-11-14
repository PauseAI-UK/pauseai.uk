// KeepSignedIn in the component gallery (app/(tools)/gallery/), in the staff
// admin group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import KeepSignedIn from "./KeepSignedIn";
import StaffPage from "../ui/StaffPage";

export const keepSignedInGallery: Example[] = [
  {
    name: "KeepSignedIn",
    file: "app/(staff)/staff/_components/accounts/KeepSignedIn.tsx",
    variants: [
      {
        label: "The login form's box, unticked",
        render: () => (
          <StaffPage as="div">
            <KeepSignedIn />
          </StaffPage>
        ),
      },
    ],
  },
];
