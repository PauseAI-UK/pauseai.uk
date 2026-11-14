import { describe, expect, it } from "vitest";
import {
  isOutcode,
  readSignupFile,
  signupEventColumns,
  signupFileText,
  signupHeading,
  signupPileCounts,
  signupRows,
  type SignupFileRead,
  type SignupPlan,
  type SignupPlanRow,
} from "./signup-csv";

type Read = Extract<SignupFileRead, { ok: true }>;

function read(text: string): Read {
  const file = readSignupFile(text);
  if (!file.ok) throw new Error(`Refused: ${file.reason}`);
  return file;
}

/** The people in a file, with `event` as the column linked to an event. */
const rows = (text: string, event: string | null = null) => signupRows(read(text), event);

const bytes = (...values: number[]) => new Uint8Array(values).buffer;

describe("signupHeading", () => {
  it("ignores case, accents, spaces and punctuation", () => {
    expect(signupHeading(" E-mail Addréss? ")).toBe("emailaddress");
  });
});

describe("isOutcode", () => {
  it("knows a postcode's first half from a whole one", () => {
    for (const code of ["SE15", "se15", "M1", "EC1A"]) expect(isOutcode(code)).toBe(true);
    for (const code of ["SE15 1AA", "SE151AA", "London", ""]) expect(isOutcode(code)).toBe(false);
  });
});

describe("signupFileText", () => {
  it("reads UTF-8, UTF-16 by its first bytes, and Windows-1252 for what's neither", () => {
    expect(signupFileText(new TextEncoder().encode("Zoë").buffer as ArrayBuffer)).toBe("Zoë");
    expect(signupFileText(bytes(0xff, 0xfe, 0x5a, 0x00))).toBe("Z");
    expect(signupFileText(bytes(0x5a, 0x6f, 0xeb))).toBe("Zoë");
  });
});

describe("readSignupFile", () => {
  it("refuses a file with nothing in it", () => {
    expect(readSignupFile("")).toEqual({ ok: false, reason: "empty" });
    expect(readSignupFile(" \n,,,\n﻿")).toEqual({ ok: false, reason: "empty" });
  });

  it("says which of a name and an email it can't find, and what it did find", () => {
    expect(readSignupFile("Signed at,Comment\n1,2")).toEqual({
      ok: false,
      reason: "missing",
      missing: ["name", "email"],
      headings: ["Signed at", "Comment"],
    });
    expect(readSignupFile("Name,Comment\na,b")).toMatchObject({ reason: "missing", missing: ["email"] });
    expect(readSignupFile("Email,Comment\na,b")).toMatchObject({ reason: "missing", missing: ["name"] });
  });

  it("won't choose between two columns that could each be the one thing", () => {
    expect(readSignupFile("Name,Email,E-mail address\na,b,c")).toEqual({
      ok: false,
      reason: "clash",
      field: "email",
      headings: ["Email", "E-mail address"],
    });
  });

  it("finds the headings under titles, with commas, semicolons or tabs, and counts what's filled", () => {
    const file = read("﻿My list; for you;\n\nName;E-MAIL;Colour;\na;b@example.com;\n;c@example.com;red\n");
    expect(file.columns).toEqual([
      { heading: "Name", index: 0, field: "name", filled: 1 },
      { heading: "E-MAIL", index: 1, field: "email", filled: 2 },
      { heading: "Colour", index: 2, field: null, filled: 1 },
    ]);
    expect(read("Name\tEmail\na\tb").columns.map((c) => c.field)).toEqual(["name", "email"]);
    expect(read('"Notes, mostly",Name,Email\nx,y,z').columns.map((c) => c.field)).toEqual([null, "name", "email"]);
  });

  it("numbers rows by the line they start on, however lines end, and reads quotes", () => {
    const file = read('Name,Email\r\n"A ""B"" C",x@example.com\r"line\none",y@example.com\n\nlast,z@example.com');
    expect(file.rows).toEqual([
      { line: 2, cells: ['A "B" C', "x@example.com"] },
      { line: 3, cells: ["line one", "y@example.com"] },
      { line: 6, cells: ["last", "z@example.com"] },
    ]);
  });

  it("keeps a quote in the middle of a cell, and takes off what spreadsheets add", () => {
    expect(read('Name,Email\nJo "Joey" Bloggs,="a@example.com"').rows[0].cells).toEqual([
      'Jo "Joey" Bloggs',
      "a@example.com",
    ]);
  });

  it("ignores first and last names, as a supporter has one name", () => {
    const file = read("Name,First name,Surname,,Email\na,b,c,d,e");
    expect(file.columns.map((c) => c.field)).toEqual(["name", null, null, "email"]);
    expect(readSignupFile("First name,Surname,Email\na,b,c")).toMatchObject({ reason: "missing", missing: ["name"] });
  });
});

describe("signupEventColumns", () => {
  it("offers ignored columns mostly of yes and no, with a yes in them", () => {
    const file = read(`Name,Email,March,Reason,Never,Blank
a,a@example.com,Y,ticked,no,
b,b@example.com,,scribble,no,
c,c@example.com,x,scribble,,`);
    expect(signupEventColumns(file)).toEqual(["March"]);
  });
});

describe("signupRows", () => {
  it("reads a person, with no event column", () => {
    expect(rows("Name,Email\n Jane   Smith , jane@example.com")).toEqual([
      {
        line: 2,
        name: "Jane Smith",
        email: "jane@example.com",
        phone: null,
        postcode: null,
        going: false,
        problem: null,
      },
    ]);
  });

  it("reads every field, cleaning what it can", () => {
    const [person] = rows(
      "Name,Email,Phone,Postcode,Town,Newsletter,March\nJo Bloggs,JO Bloggs <JO@Example.com>,7700900123,se15   1aa,Leeds,Yes.,✓",
      "March",
    );
    expect(person).toEqual({
      line: 2,
      name: "Jo Bloggs",
      email: "jo@example.com",
      phone: "07700900123",
      postcode: "SE15 1AA",
      going: true,
      problem: null,
    });
  });

  it("copes with the ways an address and a phone number are written, and missing cells", () => {
    const people = rows(
      "Name,Email,Phone,Town\na,mailto:a @example.com.,+44 7700 900123\nb,b@example.com\nc,c@example.com,,",
    );
    expect(people.map((p) => [p.email, p.phone])).toEqual([
      ["a@example.com", "+44 7700 900123"],
      ["b@example.com", null],
      ["c@example.com", null],
    ]);
  });

  it("takes a row cut short as blank in its missing cells, yes or no included", () => {
    const [person] = rows("Name,Email,March\na,a@example.com", "March");
    expect(person).toMatchObject({ going: false, problem: null });
  });

  it("drops an optional cell too long to be what it says", () => {
    const [person] = rows(`Name,Email,Postcode\na,a@example.com,${"y".repeat(101)}`);
    expect(person).toMatchObject({ postcode: null, problem: null });
  });

  it("holds back each kind of row it can't use", () => {
    const long = "x".repeat(101);
    const problems = rows(
      `Name,Email,Phone,March
,noname@example.com,,
${long},long@example.com,,
Nomail,,,
Bad,notanemail,,
Bad,two@example.com;three@example.com,,
Long,${"m".repeat(250)}@example.com,,
Phone,phone@example.com,call me,
Short,short@example.com,123,
Twin,twin@example.com,,
Twin,TWIN@example.com,,
March,march@example.com,,?
Fine,fine@example.com,07700900123,no`,
      "March",
    ).map((p) => p.problem);
    expect(problems).toEqual([
      { kind: "no-name" },
      { kind: "long-name" },
      { kind: "no-email" },
      { kind: "bad-email" },
      { kind: "bad-email" },
      { kind: "bad-email" },
      { kind: "bad-phone" },
      { kind: "bad-phone" },
      { kind: "same-email" },
      { kind: "same-email" },
      { kind: "unread-yes-no", value: "?", column: "March" },
      null,
    ]);
  });

  it("ignores a column of yeses unless it's the one linked to the event", () => {
    const text = "Name,Email,March\na,a@example.com,maybe";
    expect(rows(text)[0]).toMatchObject({ going: false, problem: null });
    expect(rows(text, "Nothing like it")[0]).toMatchObject({ going: false, problem: null });
  });
});

const plan = (eventColumn: string | null, ...planRows: Partial<SignupPlanRow>[]): SignupPlan => ({
  input: { csv: "", filename: "f.csv", eventId: null, eventColumn, signedOn: "2026-10-31", note: "" },
  eventName: null,
  signature: "",
  rows: planRows.map(
    (row, i) =>
      ({
        line: i + 2,
        name: "Jo",
        email: "jo@example.com",
        phone: null,
        postcode: null,
        going: false,
        problem: null,
        pile: "held",
        known: null,
        newEntry: false,
        ...row,
      }) as SignupPlanRow,
  ),
});

describe("signupPileCounts", () => {
  it("counts each pile", () => {
    expect(signupPileCounts(plan(null, { pile: "held" }, { pile: "none" }, { pile: "none" }))).toEqual({
      held: 1,
      register: 0,
      going: 0,
      none: 2,
      done: 0,
    });
  });
});
