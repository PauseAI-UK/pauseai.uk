// ConditionMenu in the component gallery (app/(tools)/gallery/), in the staff mailings and events
// group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { ConditionMenuExample } from "./ConditionMenu.gallery.client";

export const conditionMenuGallery: Example[] = [
  {
    name: "ConditionMenu",
    file: "app/(staff)/staff/_components/mailings/ConditionMenu.tsx",
    variants: [
      {
        label: "Only those who…: press it for the groups, then a group for its choices beside it, events with a search",
        render: () => (
          <StaffPage as="div">
            <ConditionMenuExample />
          </StaffPage>
        ),
      },
      {
        label: "Everyone except…, counting all but each choice's",
        render: () => (
          <StaffPage as="div">
            <ConditionMenuExample not />
          </StaffPage>
        ),
      },
    ],
  },
];
