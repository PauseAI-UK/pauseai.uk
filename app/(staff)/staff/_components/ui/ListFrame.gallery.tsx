// ListFrame in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import ListFrame, { ListTable } from "./ListFrame";
import StaffPage from "./StaffPage";
import { exampleColumns, exampleRows, nameOf, narrowColumns, pageHref } from "./ListFrame.examples";

export const listFrameGallery: Example[] = [
  {
    name: "ListTable",
    file: "app/(staff)/staff/_components/ui/ListFrame.tsx",
    variants: [
      {
        label: "The rows alone, striped, for a table that isn't a whole list",
        render: () => (
          <StaffPage as="div">
            <ListTable columns={exampleColumns} rows={exampleRows} rowKey={nameOf} />
          </StaffPage>
        ),
      },
      {
        label:
          "In a box too narrow for it: the columns of words keep room for a few, the date stays on one line, and the table scrolls sideways",
        render: () => (
          <StaffPage as="div">
            <div style={{ width: "24rem" }}>
              <ListTable columns={narrowColumns} rows={exampleRows} rowKey={nameOf} />
            </div>
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "ListFrame",
    file: "app/(staff)/staff/_components/ui/ListFrame.tsx",
    variants: [
      {
        label: "Page 6 of 50: how many, the downloads, striped rows, and the pages near this one",
        render: () => (
          <StaffPage as="div">
            <ListFrame
              count="5,000 rows"
              total={5000}
              page={6}
              pages={50}
              pageSize={100}
              href={pageHref}
              download={(format) => `#download-${format}`}
              columns={exampleColumns}
              rows={exampleRows}
              rowKey={nameOf}
              empty="Nothing found."
            />
          </StaffPage>
        ),
      },
      {
        label: "One page, with no downloads",
        render: () => (
          <StaffPage as="div">
            <ListFrame
              count="4 rows"
              total={4}
              page={1}
              pages={1}
              pageSize={100}
              columns={exampleColumns}
              rows={exampleRows}
              rowKey={nameOf}
              empty="Nothing found."
            />
          </StaffPage>
        ),
      },
      {
        label: "Nothing in it: the frame stays, with how many, the headings and a row saying so",
        render: () => (
          <StaffPage as="div">
            <ListFrame
              count="0 rows"
              total={0}
              page={1}
              pages={1}
              pageSize={100}
              columns={exampleColumns}
              rows={[]}
              rowKey={nameOf}
              empty="Nothing here yet."
            />
          </StaffPage>
        ),
      },
      {
        label: "Nothing found by its filters: the way to clear them, in the row",
        render: () => (
          <StaffPage as="div">
            <ListFrame
              count="0 rows"
              total={0}
              page={1}
              pages={1}
              pageSize={100}
              columns={exampleColumns}
              rows={[]}
              rowKey={nameOf}
              empty="Nothing found."
              clear="#cleared"
            />
          </StaffPage>
        ),
      },
    ],
  },
];
