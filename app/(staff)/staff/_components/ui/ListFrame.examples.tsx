// A list for the kit's examples (ListFrame.gallery.tsx, Page.gallery.tsx): its rows and columns.
import type { ListColumn } from "./ListFrame";
import When from "./When";

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
