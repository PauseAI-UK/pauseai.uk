// StaffLink in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffLink from "./StaffLink";
import StaffPage from "./StaffPage";

export const staffLinkGallery: Example[] = [
  {
    name: "StaffLink",
    file: "app/(staff)/staff/_components/ui/StaffLink.tsx",
    variants: [
      {
        label: "A link to another page or a changed list: chosen at once, the page fetched ahead once it's hovered",
        render: () => (
          <StaffPage as="div">
            <StaffLink href="/gallery/staff">Next page</StaffLink>
          </StaffPage>
        ),
      },
    ],
  },
];
