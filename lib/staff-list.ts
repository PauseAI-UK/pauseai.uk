import { londonDayTime } from "./staff-time";

// A staff list's parts that aren't drawn: which page numbers its paging
// offers, its rows as a download, and the download's filename.

/** A download's format: a spreadsheet's, JSON, or contacts' cards (lib/vcard.ts), for a list of people. */
export const DOWNLOAD_FORMATS = ["csv", "json", "vcf"] as const;
export type DownloadFormat = (typeof DOWNLOAD_FORMATS)[number];

/** The format a download's URL asks for, or undefined for any other. */
export function downloadFormat(format: string | null): DownloadFormat | undefined {
  return DOWNLOAD_FORMATS.find((known) => known === format);
}

/** A value in a download: text, a number, yes or no, a time, or nothing. */
export type DownloadValue = string | number | boolean | Date | null;

/**
 * One column of a list as a download: its key in JSON, its heading in CSV,
 * and each row's value. A column without `text`, such as a button, is left
 * out of downloads. One whose times the list shows as a day alone says so
 * (`day`), and a CSV gives its day alone too.
 */
export type DownloadColumn<Row> = { key: string; label: string; text?: (row: Row) => DownloadValue; day?: boolean };

/** A column a download has: one with a value. */
type Downloaded<Row> = DownloadColumn<Row> & { text: (row: Row) => DownloadValue };

/** The columns a download has: those with a value. */
function downloaded<Row>(columns: DownloadColumn<Row>[]) {
  return columns.filter((c): c is Downloaded<Row> => Boolean(c.text));
}

/**
 * The pages the paging links to: the first, the last, and two either side
 * of this one, with a gap ("…") where pages are left out, but never a gap
 * standing for one page, which is shown instead.
 */
export function pageRange(page: number, pages: number): (number | "gap")[] {
  const near = (n: number) => n === 1 || n === pages || Math.abs(n - page) <= 2;
  const shown = [...Array(pages).keys()].map((i) => i + 1).filter((n) => near(n) || (near(n - 1) && near(n + 1)));
  return shown.flatMap((n, i) => (i > 0 && n - shown[i - 1] > 1 ? ["gap" as const, n] : [n]));
}

const two = (n: number) => String(n).padStart(2, "0");

/**
 * A time as a CSV has it, in London: "2026-11-18 10:23", or its `day`
 * alone, "2026-11-18". A spreadsheet reads either as a date, and sorts by it.
 */
function csvTime(at: Date, day: boolean): string {
  const london = londonDayTime(at);
  return day ? london.day : `${london.day} ${two(london.hour)}:${two(london.minute)}`;
}

/**
 * A CSV field: quoted when it holds a comma, a quote or a line break, its
 * quotes doubled. Text a spreadsheet would run as a formula (starting =, +,
 * -, @, a tab or a carriage return) starts with an apostrophe, so a name
 * someone typed can't
 * ([OWASP](https://owasp.org/www-community/attacks/CSV_Injection)). A time
 * is written as csvTime does, its day alone for a column of days (`day`).
 */
function csvField(value: DownloadValue, day = false): string {
  const raw = value === null ? "" : value instanceof Date ? csvTime(value, day) : String(value);
  const text = typeof value === "string" && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Rows as CSV (RFC 4180): a heading row, then a line each, CRLF between. */
export function toCsv<Row>(all: DownloadColumn<Row>[], rows: Row[]): string {
  const columns = downloaded(all);
  const lines = [
    columns.map((c) => csvField(c.label)),
    ...rows.map((row) => columns.map((c) => csvField(c.text(row), c.day))),
  ];
  return lines.map((fields) => fields.join(",")).join("\r\n") + "\r\n";
}

/** Rows as a JSON array, each an object of its columns' values by key, a time in full (ISO 8601). */
export function toJson<Row>(all: DownloadColumn<Row>[], rows: Row[]): string {
  const columns = downloaded(all);
  return JSON.stringify(
    rows.map((row) => Object.fromEntries(columns.map((c) => [c.key, c.text(row)]))),
    null,
    2,
  );
}

/** Words for a filename: lower case, each run of anything but letters and digits one underscore. */
function fileWords(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * A download's filename: what it is, then each filter in words, then when,
 * in London to the minute, all lower case with underscores.
 * "politicians_party_labour_2026_10_27_1430.csv".
 */
export function downloadName(what: string, filters: string[], at: Date, format: DownloadFormat): string {
  const london = londonDayTime(at);
  const when = `${london.day.replaceAll("-", "_")}_${two(london.hour)}${two(london.minute)}`;
  return `${[what, ...filters].map(fileWords).filter(Boolean).join("_")}_${when}.${format}`;
}
