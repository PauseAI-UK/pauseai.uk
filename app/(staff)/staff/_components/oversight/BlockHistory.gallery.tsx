// BlockHistory in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import BlockHistory from "./BlockHistory";
import { exampleBroadcastBlock, exampleNumber } from "./BlocksTable.examples";

export const blockHistoryGallery: Example[] = [
  {
    name: "BlockHistory",
    file: "app/(staff)/staff/_components/oversight/BlockHistory.tsx",
    variants: [
      {
        label: "A number's: texts WhatsApp refused and skipped, and an unblock",
        render: () => (
          <StaffPage as="div">
            <BlockHistory block={exampleNumber} />
          </StaffPage>
        ),
      },
      {
        label: "An address's: a hard bounce, and a soft one found in a mailbox",
        render: () => (
          <StaffPage as="div">
            <BlockHistory block={exampleBroadcastBlock} />
          </StaffPage>
        ),
      },
    ],
  },
];
