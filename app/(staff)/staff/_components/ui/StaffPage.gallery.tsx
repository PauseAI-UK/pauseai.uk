// StaffPage in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffNav from "../shell/StaffNav";
import StaffPage from "./StaffPage";

export const staffPageGallery: Example[] = [
  {
    name: "StaffPage",
    file: "app/(staff)/staff/_components/ui/StaffPage.tsx",
    variants: [
      {
        label: "A page's frame, at the compact density, with a heading and a line",
        render: () => (
          <StaffPage as="div">
            <h1>An example staff page</h1>
            <p>A line of text under its heading.</p>
          </StaffPage>
        ),
      },
      {
        label: "With the navigation beside it",
        render: () => (
          <StaffPage as="div" nav={<StaffNav email="jo@pauseai.uk" permissions={["admin"]} current="campaigns" />}>
            <h1>Letters</h1>
            <p>The page takes the width beside the sidebar.</p>
          </StaffPage>
        ),
      },
    ],
  },
];
