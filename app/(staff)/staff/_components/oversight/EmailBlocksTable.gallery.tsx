// EmailBlocksTable in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { EmailBlocksTableExample } from "./EmailBlocksTable.gallery.client";

export const emailBlocksTableGallery: Example[] = [
  {
    name: "EmailBlocksTable",
    file: "app/(staff)/staff/_components/oversight/EmailBlocksTable.tsx",
    variants: [
      {
        label: "An MP's address that bounced, and one that complained",
        render: () => (
          <StaffPage as="div">
            <EmailBlocksTableExample />
          </StaffPage>
        ),
      },
      {
        label: "Without the supporters permission: the letter named, not linked",
        render: () => (
          <StaffPage as="div">
            <EmailBlocksTableExample letterLinks={false} />
          </StaffPage>
        ),
      },
      {
        label: "None",
        render: () => (
          <StaffPage as="div">
            <EmailBlocksTableExample blocks={[]} />
          </StaffPage>
        ),
      },
    ],
  },
];
