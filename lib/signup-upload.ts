// Reading a CSV of sign-ups, in the browser to show its columns and on the
// server to import it. It's liberal about how a file is written (separators,
// encodings, spellings of a heading, ways of saying yes) and has no opinion on
// what a column means beyond the names here: any other column is ignored.
import { toCsv } from "./staff-list";

/** What a column of a file can go into. */
export const SIGNUP_FIELDS = [
  "name",
  "firstName",
  "lastName",
  "email",
  "phone",
  "postcode",
  "city",
  "mailingList",
] as const;
export type SignupField = (typeof SIGNUP_FIELDS)[number];

/** The headings each field goes by, as signupHeading() writes them. */
export const SIGNUP_FIELD_NAMES: Record<SignupField, readonly string[]> = {
  name: ["name", "full name", "your name", "names", "contact name", "supporter"],
  firstName: ["first name", "first", "forename", "given name"],
  lastName: ["last name", "last", "surname", "family name"],
  email: ["email", "email address", "e-mail", "e-mail address", "your email", "emails", "mail"],
  phone: ["phone", "phone number", "mobile", "mobile number", "telephone", "tel", "cell", "your phone"],
  postcode: ["postcode", "post code", "postal code", "zip", "zip code", "your postcode"],
  city: ["city", "town", "city or town", "town or city", "city/town", "town/city"],
  mailingList: [
    "mailing list",
    "mailing",
    "newsletter",
    "consent",
    "keep me informed",
    "keep me in the loop",
    "contact me",
    "hear from us",
    "email updates",
    "updates",
    "opt in",
  ],
};

/** The ways of writing yes and no in a cell, as yesNoOf() writes them. A blank is no. */
export const SIGNUP_YES = [
  "y",
  "yes",
  "yeah",
  "yep",
  "x",
  "✓",
  "✔",
  "☑",
  "✅",
  "true",
  "t",
  "1",
  "ticked",
  "tick",
  "checked",
  "on",
  "ok",
];
const SIGNUP_NO = [
  "n",
  "no",
  "nope",
  "false",
  "f",
  "0",
  "-",
  "–",
  "—",
  "n/a",
  "na",
  "none",
  "unticked",
  "unchecked",
  "off",
];

/** The largest file the page takes: under what a Server Action may be sent (next.config.ts), with room for the rest of the form. */
export const MAX_SIGNUP_FILE_BYTES = 4 * 1024 * 1024;

/** A file's first rows that can be titles over its headings. */
const ROWS_TO_FIND_HEADINGS = 10;
const MAX_NAME_LENGTH = 100;
/** The longest address SMTP allows. */
const MAX_EMAIL_LENGTH = 254;
/** Longer than any real phone number, city or postcode. */
const MAX_OPTIONAL_LENGTH = 100;
const FEWEST_PHONE_DIGITS = 7;
/** Loose: one @, something either side, a dot in the domain, nothing that would separate two addresses. */
const EMAIL_PATTERN = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
/** The first half of a UK postcode alone: "SE15", "M1", "EC1A". */
const OUTCODE_PATTERN = /^[A-Z]{1,2}\d[A-Z\d]?$/;

/** A heading as compared: lower case, no accents, no spaces or punctuation. */
export function signupHeading(heading: string): string {
  return heading
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const FIELD_OF_HEADING = new Map(
  SIGNUP_FIELDS.flatMap((field) => SIGNUP_FIELD_NAMES[field].map((name) => [signupHeading(name), field] as const)),
);

/** Whether a postcode, without its spaces, is only its first half. */
export function isOutcode(postcode: string): boolean {
  return OUTCODE_PATTERN.test(postcode.replace(/\s/g, "").toUpperCase());
}

/**
 * A file's text, whichever way a spreadsheet saved it: UTF-16 where its first
 * bytes say so, UTF-8 where it's valid, else Windows-1252, as Excel's "CSV" is.
 */
export function signupFileText(bytes: ArrayBuffer): string {
  const [first, second] = new Uint8Array(bytes);
  if (first === 0xff && second === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** The character separating a line's cells: whichever of comma, semicolon and tab it has most of, outside quotes. */
function separatorOf(text: string): string {
  const line =
    text
      .replace(/"[^"]*"/g, "")
      .split(/\r\n|\r|\n/)
      .find((row) => row.trim()) ?? "";
  const count = (separator: string) => line.split(separator).length;
  return [";", "\t"].reduce((best, separator) => (count(separator) > count(best) ? separator : best), ",");
}

/** One row of a file: the line it starts on, as a spreadsheet numbers them, and its cells, trimmed. */
type SignupRecord = { line: number; cells: string[] };

/** A cell as written, less what spreadsheets add: spaces, control characters, and the ="…" that keeps a leading zero. */
function cleanCell(cell: string): string {
  const text = cell.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return text.replace(/^="(.*)"$/, "$1").trim();
}

/** A CSV's rows, leaving out those with nothing in them. Quotes follow RFC 4180, with a stray one kept as written. */
function parseSignupCsv(text: string): SignupRecord[] {
  const body = text.replace(/^﻿/, "");
  const separator = separatorOf(body);
  const records: SignupRecord[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let start = 1;
  const endRow = () => {
    cells.push(cleanCell(cell));
    cell = "";
    if (cells.some(Boolean)) records.push({ line: start, cells });
    cells = [];
    start = line;
  };
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\n" || c === "\r") {
      if (c === "\r" && body[i + 1] === "\n") i++;
      line++;
      if (quoted) cell += "\n";
      else endRow();
    } else if (quoted && c === '"' && body[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (c === '"' && (quoted || !cell.trim())) {
      quoted = !quoted;
    } else if (!quoted && c === separator) {
      cells.push(cleanCell(cell));
      cell = "";
    } else {
      cell += c;
    }
  }
  endRow();
  return records;
}

/** A column of a file: its heading, where it sits, what it goes into (null: ignored) and how many rows have a value. */
export type SignupColumn = { heading: string; index: number; field: SignupField | null; filled: number };

export type SignupFileRead =
  | { ok: true; columns: SignupColumn[]; rows: SignupRecord[] }
  /** Nothing in it, or no heading for a name or an email, the two a person can't go in without. */
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "missing"; missing: ("name" | "email")[]; headings: string[] }
  /** Two columns that could each be the one thing, so reading either might be wrong. */
  | { ok: false; reason: "clash"; field: SignupField; headings: string[] };

/** Reads a file's headings and rows, or says why it can't be read. Titles over the headings are skipped. */
export function readSignupFile(text: string): SignupFileRead {
  const records = parseSignupCsv(text);
  if (records.length === 0) return { ok: false, reason: "empty" };
  const found = records
    .slice(0, ROWS_TO_FIND_HEADINGS)
    .findIndex((record) => record.cells.some((cell) => FIELD_OF_HEADING.get(signupHeading(cell)) === "email"));
  const at = Math.max(found, 0);
  const headings = records[at].cells;
  const rows = records.slice(at + 1);

  const fieldOf = (heading: string) => FIELD_OF_HEADING.get(signupHeading(heading)) ?? null;
  const fields = headings.map(fieldOf);
  const hasName = fields.includes("name");
  const columns = headings.flatMap((heading, index): SignupColumn[] => {
    if (!heading) return [];
    const field = fieldOf(heading);
    // A full name's column says it all, so first and last names beside it are ignored.
    const used = hasName && (field === "firstName" || field === "lastName") ? null : field;
    return [{ heading, index, field: used, filled: rows.filter((row) => row.cells[index]).length }];
  });

  for (const field of SIGNUP_FIELDS) {
    const same = columns.filter((column) => column.field === field);
    if (same.length > 1) return { ok: false, reason: "clash", field, headings: same.map((column) => column.heading) };
  }
  const has = (field: SignupField) => columns.some((column) => column.field === field);
  const missing: ("name" | "email")[] = [];
  if (!has("name") && !has("firstName") && !has("lastName")) missing.push("name");
  if (!has("email")) missing.push("email");
  if (missing.length > 0) return { ok: false, reason: "missing", missing, headings: columns.map((c) => c.heading) };
  return { ok: true, columns, rows };
}

/** What a cell says, yes or no; "unread" if it's neither, which holds its row back. */
function yesNoOf(cell: string): "yes" | "no" | "unread" {
  const said = cell
    .toLowerCase()
    .replace(/[.!]+$/, "")
    .trim();
  if (!said || SIGNUP_NO.includes(said)) return "no";
  return SIGNUP_YES.includes(said) ? "yes" : "unread";
}

/**
 * The ignored columns that can link to an event: with a yes in them, and more
 * yeses and noes than anything else, so a column of free text that happens to
 * say "ticked" isn't offered.
 */
export function signupEventColumns(file: Extract<SignupFileRead, { ok: true }>): string[] {
  return file.columns
    .filter((column) => {
      if (column.field) return false;
      const said = file.rows
        .map((row) => row.cells[column.index])
        .filter(Boolean)
        .map(yesNoOf);
      const unread = said.filter((answer) => answer === "unread").length;
      return said.includes("yes") && said.length - unread > unread;
    })
    .map((column) => column.heading);
}

/** An address however it was written: "Jane <jane@example.com>", "mailto:", capitals, stray spaces and a full stop. */
function cleanEmail(cell: string): string {
  const inside = /<([^<>]*)>/.exec(cell)?.[1] ?? cell;
  return inside
    .replace(/^mailto:/i, "")
    .replace(/\s/g, "")
    .replace(/[.,;:]+$/, "")
    .toLowerCase();
}

/** Why a row can't go in. `value` and `column` are the cell that says so, for a yes or no it can't read. */
export type SignupRowProblem =
  | { kind: "no-name" | "long-name" | "no-email" | "bad-email" | "bad-phone" | "same-email" | "blocked" }
  | { kind: "unread-yes-no"; value: string; column: string };

/** A person as a row of the file gives them. */
export type SignupRow = {
  line: number;
  name: string;
  email: string;
  phone: string | null;
  postcode: string | null;
  city: string | null;
  mailingList: boolean;
  /** A yes in the column linked to an event. */
  going: boolean;
  problem: SignupRowProblem | null;
};

/** A phone number as written, but for a mobile's leading zero, which spreadsheets drop; undefined if it can't be one. */
function cleanPhone(cell: string): string | undefined {
  const digits = cell.replace(/\D/g, "");
  if (/[a-z]/i.test(cell) || digits.length < FEWEST_PHONE_DIGITS) return undefined;
  return /^7\d{9}$/.test(digits) ? `0${digits}` : cell;
}

/** An optional cell as kept: null when blank, or too long to be what it says. */
function optional(cell: string): string | null {
  return cell && cell.length <= MAX_OPTIONAL_LENGTH ? cell : null;
}

/** The people in a file, with `eventColumn` the column that says who's going to the upload's event. */
export function signupRows(file: Extract<SignupFileRead, { ok: true }>, eventColumn: string | null): SignupRow[] {
  const column = (field: SignupField) => file.columns.find((c) => c.field === field);
  const event = file.columns.find((c) => c.heading === eventColumn);
  const mailing = column("mailingList");
  const emails = new Map<string, number>();
  const cleaned = file.rows.map((row) => {
    const cell = (field: SignupField) => {
      const found = column(field);
      return found ? (row.cells[found.index] ?? "") : "";
    };
    const email = cleanEmail(cell("email"));
    if (email) emails.set(email, (emails.get(email) ?? 0) + 1);
    return { row, cell, email };
  });
  return cleaned.map(({ row, cell, email }) => {
    const name = (cell("name") || `${cell("firstName")} ${cell("lastName")}`).replace(/\s+/g, " ").trim();
    const phone = cell("phone") ? cleanPhone(cell("phone")) : null;
    const answer = (from: SignupColumn | undefined) => (from ? (row.cells[from.index] ?? "") : "");
    const problem = ((): SignupRowProblem | null => {
      if (!email) return { kind: "no-email" };
      if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) return { kind: "bad-email" };
      if (emails.get(email)! > 1) return { kind: "same-email" };
      if (!name) return { kind: "no-name" };
      if (name.length > MAX_NAME_LENGTH) return { kind: "long-name" };
      if (phone === undefined) return { kind: "bad-phone" };
      for (const from of [mailing, event]) {
        if (from && yesNoOf(answer(from)) === "unread") {
          return { kind: "unread-yes-no", value: answer(from), column: from.heading };
        }
      }
      return null;
    })();
    return {
      line: row.line,
      name,
      email,
      phone: phone ?? null,
      postcode: optional(cell("postcode"))?.replace(/\s+/g, " ").toUpperCase() ?? null,
      city: optional(cell("city")),
      mailingList: yesNoOf(answer(mailing)) === "yes",
      going: yesNoOf(answer(event)) === "yes",
      problem,
    };
  });
}

/** What the page sends to preview and import a file: the file itself, and what staff chose. */
export type SignupUploadInput = {
  csv: string;
  filename: string;
  eventId: string | null;
  eventColumn: string | null;
  /** The date on the forms, YYYY-MM-DD. */
  signedOn: string;
  note: string;
};

/** Where the page keeps the file for the preview: only this browser tab, so nothing of it stays on the server until it's imported. */
export const SIGNUP_UPLOAD_STORAGE = "signup-upload";

/** What will happen to a person: one pile each. */
export const SIGNUP_PILES = ["held", "register", "going", "none", "done"] as const;
export type SignupPile = (typeof SIGNUP_PILES)[number];

/** A person in the preview. */
export type SignupPlanRow = SignupRow & {
  pile: SignupPile;
  /** How they're already a supporter, or null if they'll be a new one. */
  known: "email" | "mobile" | null;
  /** Whether they'll get a form entry, which an earlier upload of the same day's forms may have given them. */
  newEntry: boolean;
};

/** What finalising a file will do, for the preview, with what finalising checks hasn't changed. */
export type SignupPlan = {
  input: SignupUploadInput;
  eventName: string | null;
  rows: SignupPlanRow[];
  ignored: string[];
  signature: string;
};

/** How many of a plan's people are in each pile. */
export function signupPileCounts(plan: Pick<SignupPlan, "rows">): Record<SignupPile, number> {
  const counts = Object.fromEntries(SIGNUP_PILES.map((pile) => [pile, 0])) as Record<SignupPile, number>;
  for (const row of plan.rows) counts[row.pile]++;
  return counts;
}

/** The rows held back as a CSV to fix and upload again: columns it can read again, and why, which it will ignore. */
export function signupHeldCsv(plan: SignupPlan, words: { why: string }, why: (row: SignupPlanRow) => string): string {
  const yes = (answer: boolean) => (answer ? "Y" : "");
  const columns = [
    { key: "name", label: "Name", text: (row: SignupPlanRow) => row.name },
    { key: "email", label: "Email", text: (row: SignupPlanRow) => row.email },
    { key: "phone", label: "Phone", text: (row: SignupPlanRow) => row.phone },
    { key: "postcode", label: "Postcode", text: (row: SignupPlanRow) => row.postcode },
    { key: "city", label: "City", text: (row: SignupPlanRow) => row.city },
    { key: "mailing", label: "Mailing list", text: (row: SignupPlanRow) => yes(row.mailingList) },
    ...(plan.input.eventColumn
      ? [{ key: "event", label: plan.input.eventColumn, text: (row: SignupPlanRow) => yes(row.going) }]
      : []),
    { key: "why", label: words.why, text: why },
  ];
  return toCsv(
    columns,
    plan.rows.filter((row) => row.pile === "held"),
  );
}
