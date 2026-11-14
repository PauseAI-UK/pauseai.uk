// Rows in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { Button } from "@/components/ui/Button";
import Grid, { Card } from "./Grid";
import Rows, { Row } from "./Rows";
import StaffLink from "./StaffLink";
import StaffPage from "./StaffPage";

export const rowsGallery: Example[] = [
  {
    name: "Rows",
    file: "app/(staff)/staff/_components/ui/Rows.tsx",
    variants: [
      {
        label: "In a card: each row's main line, its second line and what ends it, the ends lined up",
        render: () => (
          <StaffPage as="div">
            <Grid>
              <Card span={3} title="Asks" id="rows-asks">
                <Rows>
                  <Row second="Asked on 1 Nov 2026 · set by staff@example.org" end={<strong>Signed</strong>}>
                    <StaffLink href="#statement">The example statement</StaffLink>
                  </Row>
                  <Row second="Asked on 6 Feb 2026" end={<strong>Declined</strong>}>
                    <StaffLink href="#conference">The example conference in Exampleton next spring</StaffLink>
                  </Row>
                  <Row>A row of one line</Row>
                </Rows>
              </Card>
            </Grid>
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "Row",
    file: "app/(staff)/staff/_components/ui/Rows.tsx",
    variants: [
      {
        label:
          "Led by a date, for things named by their day; in a box too narrow, the words wrap, the date and button don't",
        render: () => (
          <StaffPage as="div">
            <div style={{ width: "20rem" }}>
              <Rows label="Example events">
                <Row
                  lead="16 Oct 2026"
                  second="Exampleton · 9 going"
                  end={
                    <Button variant="ghost" size="small" fit>
                      Edit
                    </Button>
                  }
                >
                  <StaffLink href="#breakfast">Breakfast with the example organisers</StaffLink>
                </Row>
                <Row
                  lead="7 Nov 2026"
                  second="Online · 14 going"
                  end={
                    <Button variant="ghost" size="small" fit>
                      Edit
                    </Button>
                  }
                >
                  <StaffLink href="#meetup">First meet-up</StaffLink>
                </Row>
              </Rows>
            </div>
          </StaffPage>
        ),
      },
    ],
  },
];
