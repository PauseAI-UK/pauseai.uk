// DraftWriter in the component gallery (app/(tools)/gallery/), in the staff broadcasts group
// (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { DraftFootExample, DraftTitleExample } from "./DraftWriter.gallery.client";

export const draftWriterGallery: Example[] = [
  {
    name: "DraftTitle",
    file: "app/(staff)/staff/_components/mailings/DraftWriter.tsx",
    variants: [
      {
        label: "With whether it's saved",
        render: () => (
          <StaffPage as="div">
            <DraftTitleExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "ScheduleButton",
    file: "app/(staff)/staff/_components/mailings/DraftWriter.tsx",
    variants: [
      {
        label: "A draft's foot: when it goes, Schedule enabled and refused, and what stops it",
        render: () => (
          <StaffPage as="div">
            <DraftFootExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "ProblemList",
    file: "app/(staff)/staff/_components/mailings/DraftWriter.tsx",
    variants: [
      {
        label: "With what stops it, and with nothing",
        render: () => (
          <StaffPage as="div">
            <DraftFootExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "DueSection",
    file: "app/(staff)/staff/_components/mailings/DraftWriter.tsx",
    variants: [
      {
        label: "No time chosen yet",
        render: () => (
          <StaffPage as="div">
            <DraftFootExample />
          </StaffPage>
        ),
      },
    ],
  },
];
