// StaffMember in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffMember from "./StaffMember";
import StaffPage from "./StaffPage";

export const staffMemberGallery: Example[] = [
  {
    name: "StaffMember",
    file: "app/(staff)/staff/_components/ui/StaffMember.tsx",
    variants: [
      {
        label: "In a sentence, and in a narrow column, where it breaks before the @",
        render: () => (
          <StaffPage as="div">
            <p>
              Imported by <StaffMember email="jo@pauseai.uk" /> on 3 Nov 2026
            </p>
            <p style={{ width: "8rem" }}>
              <StaffMember email="samuel.whitlock@pauseai.uk" />
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
