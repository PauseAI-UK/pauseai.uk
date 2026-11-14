// StaffHome in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffHome from "./StaffHome";
import { exampleDashboard } from "./StaffDashboard.examples";
import StaffPage from "../ui/StaffPage";

export const staffHomeGallery: Example[] = [
  {
    name: "StaffHome",
    file: "app/(staff)/staff/_components/dashboard/StaffHome.tsx",
    variants: [
      {
        label: "For an admin: the dashboard",
        render: () => (
          <StaffPage as="div">
            <StaffHome permissions={["admin", "supporters"]} dashboard={exampleDashboard} />
          </StaffPage>
        ),
      },
      {
        label: "For someone with no permissions: the dashboard, its supporter tiles not links",
        render: () => (
          <StaffPage as="div">
            <StaffHome permissions={[]} dashboard={exampleDashboard} />
          </StaffPage>
        ),
      },
    ],
  },
];
