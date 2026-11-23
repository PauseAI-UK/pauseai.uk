// BroadcastTimes in the component gallery (app/(tools)/gallery/), in the staff broadcasts group
// (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { ChangeTimesFormExample, DraftFinishExample } from "./BroadcastTimes.gallery.client";

export const broadcastTimesGallery: Example[] = [
  {
    name: "DraftFinish",
    file: "app/(staff)/staff/_components/broadcasts/BroadcastTimes.tsx",
    variants: [
      {
        label: "Keeps trying seven days, with Change, which shows its day and time",
        render: () => (
          <StaffPage as="div">
            <DraftFinishExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "ChangeTimesForm",
    file: "app/(staff)/staff/_components/broadcasts/BroadcastTimes.tsx",
    variants: [
      {
        label: "Scheduled: its time, and when it keeps trying until",
        render: () => (
          <StaffPage as="div">
            <ChangeTimesFormExample scheduled />
          </StaffPage>
        ),
      },
      {
        label: "Sending: when it keeps trying until, alone",
        render: () => (
          <StaffPage as="div">
            <ChangeTimesFormExample scheduled={false} />
          </StaffPage>
        ),
      },
    ],
  },
];
