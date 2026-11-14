// StaffDashboard in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffDashboard from "./StaffDashboard";
import { exampleDashboard, exampleQuietDashboard } from "./StaffDashboard.examples";
import StaffPage from "../ui/StaffPage";

export const staffDashboardGallery: Example[] = [
  {
    name: "StaffDashboard",
    file: "app/(staff)/staff/_components/dashboard/StaffDashboard.tsx",
    variants: [
      {
        label: "A busy week with something waiting of each kind, for someone who may see supporters",
        render: () => (
          <StaffPage as="div">
            <StaffDashboard dashboard={exampleDashboard} permissions={["supporters"]} />
          </StaffPage>
        ),
      },
      {
        label: "For someone who may not: the supporter tiles aren't links",
        render: () => (
          <StaffPage as="div">
            <StaffDashboard dashboard={exampleDashboard} permissions={[]} />
          </StaffPage>
        ),
      },
      {
        label: "A quiet month: nothing waiting, nothing counted",
        render: () => (
          <StaffPage as="div">
            <StaffDashboard dashboard={exampleQuietDashboard} permissions={["supporters"]} />
          </StaffPage>
        ),
      },
    ],
  },
];
