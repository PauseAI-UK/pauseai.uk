// AsksList in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import AsksList from "./AsksList";
import { exampleAsksWithCounts } from "./AsksList.examples";

export const asksListGallery: Example[] = [
  {
    name: "AsksList",
    file: "app/(staff)/staff/_components/campaigns/AsksList.tsx",
    variants: [
      {
        label: "Every ask, with its answers",
        render: () => (
          <StaffPage as="div">
            <AsksList asks={exampleAsksWithCounts} now={new Date("2026-10-01T12:00:00Z")} />
          </StaffPage>
        ),
      },
    ],
  },
];
