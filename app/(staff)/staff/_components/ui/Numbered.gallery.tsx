// Numbered in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Grid, { Card } from "./Grid";
import Numbered from "./Numbered";
import StaffPage from "./StaffPage";

export const numberedGallery: Example[] = [
  {
    name: "Numbered",
    file: "app/(staff)/staff/_components/ui/Numbered.tsx",
    variants: [
      {
        label: "Steps going down a page, each a card",
        render: () => (
          <StaffPage as="div">
            <Grid>
              <Card span={6} title={<Numbered n={1}>Choose who</Numbered>} id="example-step-1">
                <p>The first step.</p>
              </Card>
              <Card span={6} title={<Numbered n={2}>Write it</Numbered>} id="example-step-2">
                <p>The second.</p>
              </Card>
            </Grid>
          </StaffPage>
        ),
      },
    ],
  },
];
