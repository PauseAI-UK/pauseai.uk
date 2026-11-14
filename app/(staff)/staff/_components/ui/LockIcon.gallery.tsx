// LockIcon in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import LockIcon from "./LockIcon";
import StaffPage from "./StaffPage";

export const lockIconGallery: Example[] = [
  {
    name: "LockIcon",
    file: "app/(staff)/staff/_components/ui/LockIcon.tsx",
    variants: [
      {
        label: "After a locked chip's words, where its arrow would be",
        render: () => (
          <StaffPage as="div">
            <p>
              Consent: PauseAI UK
              <LockIcon />
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
