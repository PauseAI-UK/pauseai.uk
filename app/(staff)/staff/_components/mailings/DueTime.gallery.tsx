// DueTime in the component gallery (app/(tools)/gallery/), in the staff mailings and events group
// (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { ChangeTimeFormExample, DueTimeFieldsExample } from "./DueTime.gallery.client";

export const dueTimeGallery: Example[] = [
  {
    name: "DueTimeFields",
    file: "app/(staff)/staff/_components/mailings/DueTime.tsx",
    variants: [
      {
        label: "Today, no hour yet: the hours too soon greyed out",
        render: () => (
          <StaffPage as="div">
            <DueTimeFieldsExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "ChangeTimeForm",
    file: "app/(staff)/staff/_components/mailings/DueTime.tsx",
    variants: [
      {
        label: "A time become too soon, moved on to the first it can go",
        render: () => (
          <StaffPage as="div">
            <ChangeTimeFormExample />
          </StaffPage>
        ),
      },
    ],
  },
];
