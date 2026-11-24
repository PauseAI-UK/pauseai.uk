// StaffNames in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffMember from "./StaffMember";
import { StaffNames } from "./StaffNames";
import StaffPage from "./StaffPage";

export const staffNamesGallery: Example[] = [
  {
    name: "StaffNames",
    file: "app/(staff)/staff/_components/ui/StaffNames.tsx",
    variants: [
      {
        label: "Around a StaffMember whose name it knows, from Google: a button that opens a bubble with it",
        render: () => (
          <StaffPage as="div">
            <StaffNames names={{ "jo@pauseai.uk": "Jo Bloggs" }}>
              <p>
                Imported by <StaffMember email="jo@pauseai.uk" /> on 3 Nov 2026
              </p>
            </StaffNames>
          </StaffPage>
        ),
      },
    ],
  },
];
