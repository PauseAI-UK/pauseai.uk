// JobActions in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { JobActionsExample } from "./JobActions.gallery.client";

export const jobActionsGallery: Example[] = [
  {
    name: "JobActions",
    file: "app/(staff)/staff/_components/jobs/JobActions.tsx",
    variants: [
      {
        label: "A job's button",
        render: () => (
          <StaffPage as="div">
            <JobActionsExample />
          </StaffPage>
        ),
      },
    ],
  },
];
