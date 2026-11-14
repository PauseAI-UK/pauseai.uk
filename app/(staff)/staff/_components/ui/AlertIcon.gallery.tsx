// AlertIcon in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import AlertIcon from "./AlertIcon";
import StaffPage from "./StaffPage";

export const alertIconGallery: Example[] = [
  {
    name: "AlertIcon",
    file: "app/(staff)/staff/_components/ui/AlertIcon.tsx",
    variants: [
      {
        label: "Waiting, and broken",
        render: () => (
          <StaffPage as="div">
            <AlertIcon tone="amber" /> <AlertIcon tone="red" /> <AlertIcon tone="blue" />
          </StaffPage>
        ),
      },
    ],
  },
];
