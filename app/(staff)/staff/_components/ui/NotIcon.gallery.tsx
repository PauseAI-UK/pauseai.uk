// NotIcon in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import NotIcon from "./NotIcon";
import StaffPage from "./StaffPage";

export const notIconGallery: Example[] = [
  {
    name: "NotIcon",
    file: "app/(staff)/staff/_components/ui/NotIcon.tsx",
    variants: [
      {
        label: "Before Except, and a condition the preview shows those who don't meet",
        render: () => (
          <StaffPage as="div">
            <p>
              <NotIcon />
              Except
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
