// Empty in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Grid, { Card } from "./Grid";
import Empty from "./Empty";
import StaffPage from "./StaffPage";

export const emptyGallery: Example[] = [
  {
    name: "Empty",
    file: "app/(staff)/staff/_components/ui/Empty.tsx",
    variants: [
      {
        label: "In a card, where its content would start; and in a line, beside a heading",
        render: () => (
          <StaffPage as="div">
            <Grid>
              <Card span={3} title="Letters to MPs" id="empty-letters">
                <Empty>No letters.</Empty>
              </Card>
              <Card span={3} look="aside" title="Notes" id="empty-notes">
                <Empty>No notes yet.</Empty>
              </Card>
            </Grid>
            <p>
              <strong>History</strong> <Empty inline>Nothing yet.</Empty>
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
