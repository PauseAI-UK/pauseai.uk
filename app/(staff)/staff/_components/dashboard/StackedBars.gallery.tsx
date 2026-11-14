// StackedBars in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StackedBars from "./StackedBars";
import { exampleDashboard } from "./StaffDashboard.examples";
import StaffPage from "../ui/StaffPage";

export const stackedBarsGallery: Example[] = [
  {
    name: "StackedBars",
    file: "app/(staff)/staff/_components/dashboard/StackedBars.tsx",
    variants: [
      {
        label: "Eight weeks of new supporters by their earliest source: point at a bar for what it holds",
        render: () => (
          <StaffPage as="div">
            <div style={{ maxWidth: "24rem" }}>
              <StackedBars
                name="New supporters, the last eight weeks"
                parts={[
                  { key: "luma", label: "Luma" },
                  { key: "civicrm", label: "Member" },
                  { key: "email-your-mp", label: "Letter" },
                ]}
                bars={exampleDashboard.supportersBySource.map((point) => ({
                  counts: point.sources,
                  title: `From ${point.from.toISOString().slice(0, 10)}: ${point.count}`,
                }))}
                from={exampleDashboard.supportersBySource[0].from.toISOString().slice(0, 10)}
                to={exampleDashboard.asOf.toISOString().slice(0, 10)}
              />
            </div>
          </StaffPage>
        ),
      },
    ],
  },
];
