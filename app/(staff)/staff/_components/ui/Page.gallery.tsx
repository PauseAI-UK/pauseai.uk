// Page in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Band, { BandFact } from "./Band";
import { ButtonLink } from "@/components/ui/Button";
import Grid, { Card, Column } from "./Grid";
import ListFrame, { ListTable } from "./ListFrame";
import Page from "./Page";
import PageHead from "./PageHead";
import StaffPage from "./StaffPage";
import { exampleColumns, exampleRows, nameOf, pageHref } from "./ListFrame.examples";
import Tag from "@/components/ui/Tag";

export const pageGallery: Example[] = [
  {
    name: "Page",
    file: "app/(staff)/staff/_components/ui/Page.tsx",
    variants: [
      {
        label: "A list: its head, then the list frame, the window's width, under the filter bar",
        render: () => (
          <StaffPage as="div">
            <Page kind="list">
              <PageHead intro="What the list holds">A list</PageHead>
              <ListFrame
                count="4 rows"
                total={4}
                page={1}
                pages={1}
                pageSize={100}
                href={pageHref}
                columns={exampleColumns}
                rows={exampleRows}
                rowKey={nameOf}
                empty="Nothing found."
              />
            </Page>
          </StaffPage>
        ),
      },
      {
        label: "A list by month: its head, with the button for a new one, then each month's rows",
        render: () => (
          <StaffPage as="div">
            <Page kind="month-list">
              <PageHead
                intro="Things we made, newest first"
                action={
                  <ButtonLink variant="primary" fit href="#">
                    New thing
                  </ButtonLink>
                }
              >
                A list by month
              </PageHead>
              <Grid>
                <Column span={6}>
                  <h2>October 2026</h2>
                  <ListTable columns={exampleColumns} rows={exampleRows.slice(0, 2)} rowKey={nameOf} />
                  <h2>September 2026</h2>
                  <ListTable columns={exampleColumns} rows={exampleRows.slice(2)} rowKey={nameOf} />
                </Column>
              </Grid>
            </Page>
          </StaffPage>
        ),
      },
      {
        label: "A record: the trail to it, its band, then its cards on the grid",
        render: () => (
          <StaffPage as="div">
            <Page kind="record" under="supporters" here="Jane Example">
              <Band title="Jane Example" tag={<Tag>Member</Tag>}>
                <BandFact label="Place">Manchester, England</BandFact>
                <BandFact label="Signed up">29 Oct 2026</BandFact>
              </Band>
              <Grid>
                <Card span={4} title="The main thing" id="kind-record-main">
                  What the record is for.
                </Card>
                <Card span={2} look="aside" title="Beside it" id="kind-record-aside">
                  What sits beside it.
                </Card>
              </Grid>
            </Page>
          </StaffPage>
        ),
      },
      {
        label: "An item, a lesser thing: the trail through the record it belongs to, the plain head with its facts",
        render: () => (
          <StaffPage as="div">
            <Page
              kind="item"
              under="campaigns"
              via={[{ href: "#campaign", label: "An example campaign" }]}
              here="Letter"
            >
              <PageHead tags={<Tag tone="green">Sent</Tag>} facts={["Jane Example MP", "Example North"]}>
                Letter from Sam Sample to Jane Example MP
              </PageHead>
              <Grid>
                <Card span={3} title="The thing itself" id="kind-item-main">
                  The letter, as it went.
                </Card>
                <Card span={3} look="log" title="History" id="kind-item-log">
                  What happened to it.
                </Card>
              </Grid>
            </Page>
          </StaffPage>
        ),
      },
      {
        label: "A form: the trail, its title, then what to fill in, in a card, with help beside it",
        render: () => (
          <StaffPage as="div">
            <Page kind="form" under="asks" here="New ask">
              <PageHead>New ask</PageHead>
              <Grid>
                <Card span={4} title="What to fill in" id="kind-form-main">
                  The fields, and the button.
                </Card>
                <Card span={2} look="aside" title="Help" id="kind-form-aside">
                  What the fields mean.
                </Card>
              </Grid>
            </Page>
          </StaffPage>
        ),
      },
      {
        label: "A board: its head, then cards or tiles of a kind on the grid, each as tall as its row",
        render: () => (
          <StaffPage as="div">
            <Page kind="board">
              <PageHead intro="Things of a kind, side by side">A board</PageHead>
              <Grid even>
                <Card span={2} title="One" id="kind-board-one">
                  A thing.
                </Card>
                <Card span={2} title="Two" id="kind-board-two">
                  Another, with more to say than the first, which makes it taller.
                </Card>
                <Card span={2} title="Three" id="kind-board-three">
                  A third.
                </Card>
              </Grid>
            </Page>
          </StaffPage>
        ),
      },
    ],
  },
];
