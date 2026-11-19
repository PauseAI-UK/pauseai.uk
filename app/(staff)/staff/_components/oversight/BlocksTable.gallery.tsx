// BlocksTable in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { BlocksTableExample, supportersBlocks } from "./BlocksTable.gallery.client";

export const blocksTableGallery: Example[] = [
  {
    name: "BlocksTable",
    file: "app/(staff)/staff/_components/oversight/BlocksTable.tsx",
    variants: [
      {
        label: "Two MPs' addresses that bounced, one found in a mailbox",
        render: () => (
          <StaffPage as="div">
            <BlocksTableExample />
          </StaffPage>
        ),
      },
      {
        label:
          "Supporters': a broadcast's bounce, a number not on WhatsApp, a complaint, a hold, and a bounce of an email sent from a mailbox",
        render: () => (
          <StaffPage as="div">
            <BlocksTableExample blocks={supportersBlocks} />
          </StaffPage>
        ),
      },
      {
        label: "The second of three pages",
        render: () => (
          <StaffPage as="div">
            <BlocksTableExample blocks={supportersBlocks} total={250} page={2} />
          </StaffPage>
        ),
      },
      {
        label: "Without the supporters permission: the letter named, not linked",
        render: () => (
          <StaffPage as="div">
            <BlocksTableExample letterLinks={false} />
          </StaffPage>
        ),
      },
      {
        label: "None",
        render: () => (
          <StaffPage as="div">
            <BlocksTableExample blocks={[]} />
          </StaffPage>
        ),
      },
    ],
  },
];
