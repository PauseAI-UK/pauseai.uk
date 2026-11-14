// Sparkline in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Sparkline from "./Sparkline";
import { exampleDashboard } from "./StaffDashboard.examples";
import StaffPage from "../ui/StaffPage";

export const sparklineGallery: Example[] = [
  {
    name: "Sparkline",
    file: "app/(staff)/staff/_components/dashboard/Sparkline.tsx",
    variants: [
      {
        label: "Eight weeks of registrations: point at it for a week's count",
        render: () => (
          <StaffPage as="div">
            <div style={{ maxWidth: "24rem" }}>
              <Sparkline
                name="Event registrations, the last eight weeks"
                values={exampleDashboard.series.eventRegistrations.map((point) => point.count)}
                labels={exampleDashboard.series.eventRegistrations.map(
                  (point) => `From ${point.from.toISOString().slice(0, 10)}: ${point.count}`,
                )}
                from={exampleDashboard.series.eventRegistrations[0].from.toISOString().slice(0, 10)}
                to={exampleDashboard.asOf.toISOString().slice(0, 10)}
              />
            </div>
          </StaffPage>
        ),
      },
    ],
  },
];
