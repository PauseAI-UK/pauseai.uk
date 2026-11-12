// The kinds of staff page (docs/style-guide.md, "Kinds of page"). Every page
// is one of them, and says which (ui/Page): its kind is how it starts and how
// it's laid out. tests/checks/staff-page-kinds.test.ts checks each page says.

/**
 * - `list`: filters over a table, the window's width (Supporters).
 * - `month-list`: things we made, newest first under their months (Mailings).
 * - `record`: a main thing, which starts with the band (a supporter).
 * - `item`: a lesser thing, which starts with the plain head and a line of facts (a letter).
 * - `form`: something to fill in (New ask).
 * - `board`: cards or tiles on the grid (the dashboard).
 */
export const PAGE_KINDS = ["list", "month-list", "record", "item", "form", "board"] as const;

export type PageKind = (typeof PAGE_KINDS)[number];
