// Grid in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Grid, { Card, Column } from "./Grid";
import StaffPage from "./StaffPage";
import Strip from "./Strip";

export const gridGallery: Example[] = [
  {
    name: "Grid",
    file: "app/(staff)/staff/_components/ui/Grid.tsx",
    variants: [
      {
        label:
          "Six columns on a wide screen, two below: cards taking a half, two-thirds and a third, then a sixth each",
        render: () => (
          <StaffPage as="div">
            <Grid>
              <Card span={3}>A half</Card>
              <Card span={3}>A half</Card>
              <Card span={4}>Two-thirds, beside</Card>
              <Card span={2}>
                a third, taller than it: each is as tall as what&apos;s in it, so this one is longer.
              </Card>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Card key={n} span={1}>
                  A sixth
                </Card>
              ))}
            </Grid>
          </StaffPage>
        ),
      },
      {
        label: "Even: things of one kind, each as tall as its row",
        render: () => (
          <StaffPage as="div">
            <Grid even>
              <Card span={2}>A third</Card>
              <Card span={2}>A third, with more in it than the others, which grow to match.</Card>
              <Card span={2}>A third</Card>
            </Grid>
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "Card",
    file: "app/(staff)/staff/_components/ui/Grid.tsx",
    variants: [
      {
        label: "With a title, and a strip and a line in it",
        render: () => (
          <StaffPage as="div">
            <Grid>
              <Card span={3} title="An example card" id="example-card">
                <Strip tone="green">
                  <span>Done</span>
                </Strip>
                <p>A line under it.</p>
              </Card>
            </Grid>
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "Column",
    file: "app/(staff)/staff/_components/ui/Grid.tsx",
    variants: [
      {
        label: "Two cards, one under the other, beside a record two-thirds wide",
        render: () => (
          <StaffPage as="div">
            <Grid>
              <Card span={4}>The record, two-thirds wide.</Card>
              <Column span={2}>
                <Card look="aside" title="Asks" id="column-asks">
                  An aside
                </Card>
                <Card look="log" title="History" id="column-history">
                  A history under it
                </Card>
              </Column>
            </Grid>
          </StaffPage>
        ),
      },
    ],
  },
];
