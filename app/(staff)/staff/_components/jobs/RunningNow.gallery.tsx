// RunningNow in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import RunningNow from "./RunningNow";
import StaffPage from "../ui/StaffPage";
import { jobsCopy } from "./copy";

export const runningNowGallery: Example[] = [
  {
    name: "RunningNow",
    file: "app/(staff)/staff/_components/jobs/RunningNow.tsx",
    variants: [
      {
        label: "A run going, started by a staff member",
        render: () => (
          <StaffPage as="div">
            <RunningNow>{jobsCopy.import.running("Jo", "9:00")}</RunningNow>
          </StaffPage>
        ),
      },
    ],
  },
];
