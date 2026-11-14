// MenuSubmit in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "./StaffPage";
import { MenuSubmitExample } from "./MenuSubmit.gallery.client";

export const menuSubmitGallery: Example[] = [
  {
    name: "MenuSubmit",
    file: "app/(staff)/staff/_components/ui/MenuSubmit.tsx",
    variants: [
      {
        label: "A menu's item that sends a form, the menu staying up while it waits",
        render: () => (
          <StaffPage as="div">
            <MenuSubmitExample />
          </StaffPage>
        ),
      },
    ],
  },
];
