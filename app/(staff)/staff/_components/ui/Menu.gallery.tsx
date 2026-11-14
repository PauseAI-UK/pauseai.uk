// Menu in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Menu from "./Menu";
import StaffPage from "./StaffPage";

export const menuGallery: Example[] = [
  {
    name: "Menu",
    file: "app/(staff)/staff/_components/ui/Menu.tsx",
    variants: [
      {
        label: "A button that opens a box of choices",
        render: () => (
          <StaffPage as="div">
            <Menu id="example-menu" label="Choose">
              <p>One</p>
              <p>Two</p>
            </Menu>
          </StaffPage>
        ),
      },
    ],
  },
];
