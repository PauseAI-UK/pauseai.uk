// ListFrame in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import type { ListColumn } from "./ListFrame";
import When from "./When";
import ListFrame, { ListTable } from "./ListFrame";
import StaffPage from "./StaffPage";

// A list for the kit's examples, here and in Page.gallery.tsx: its rows and columns.

/** A list's rows, for the list frame: a name, a place and a count, the place long enough to wrap. */
export type ExampleRow = { name: string; place: string; count: number };
export const exampleRows: ExampleRow[] = [
  { name: "Ann Example", place: "Hackney North and Stoke Newington", count: 3 },
  { name: "Bob Sample", place: "Leeds", count: 0 },
  { name: "Cat Fixture", place: "Ceredigion Preseli", count: 12 },
  { name: "Dan Dummy", place: "Glasgow", count: 1 },
];
export const exampleColumns: ListColumn<ExampleRow>[] = [
  { key: "name", label: "Name", cell: (r) => r.name },
  { key: "place", label: "Place", cell: (r) => r.place },
  { key: "count", label: "Letters", short: true, cell: (r) => r.count },
];
export const nameOf = (row: ExampleRow) => row.name;
/** A subject too long for a row, and when the examples' rows happened. */
export const EXAMPLE_SUBJECT = "Please make the Millennium Dome into a giant pause button";
export const EXAMPLE_AT = new Date("2026-10-16T10:34:00Z");
/** A list's columns that say what they hold: a name, a line of words, a date. */
export const narrowColumns: ListColumn<ExampleRow>[] = [
  { key: "name", label: "Name", words: "name", cell: (r) => r.name },
  { key: "subject", label: "Subject", words: "line", cell: () => EXAMPLE_SUBJECT },
  { key: "when", label: "When", short: true, cell: () => <When at={EXAMPLE_AT} /> },
  { key: "place", label: "Place", cell: (r) => r.place },
];
/** Where a page of the example list is. */
export const pageHref = (n: number) => `#page-${n}`;

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
