import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every phone number is in international format, and the database refuses
// any other: the `phone` domain is the rule (docs/domain-concepts.md, "Phone
// numbers"). A column of numbers is declared `phone`, or checked by a cast to
// it. This fails on a column named as a number that's neither, so a new one
// can't miss the rule, and on a column that holds an email or a number, by
// its row, losing its check.

/** A column's name that says it holds a number. */
const NUMBER_NAME = /^(phone|number|\w+_phone|\w+_number)$/;

/** Columns that hold an email or a number by what their row is for, each checked on the rows that hold a number. */
const MIXED = [
  "opt_outs.address",
  "preference_choices.address",
  "supporter_links.matched_value",
  "broadcast_replies.from_address",
];

type Column = { table: string; name: string; type: string; checked: boolean };

/** Each table's columns in a schema, with whether a constraint of the table casts the column to `phone`. */
function columnsOf(schema: string): Column[] {
  return [...schema.matchAll(/^CREATE TABLE public\.(\w+) \(\n([\s\S]*?)\n\);/gm)].flatMap(([, table, body]) => {
    const lines = body.split("\n").map((line) => line.trim());
    const constraints = lines.filter((line) => line.startsWith("CONSTRAINT "));
    return lines.flatMap((line) => {
      const column = /^(\w+) ([\w.]+)/.exec(line);
      if (!column || line.startsWith("CONSTRAINT ")) return [];
      const [, name, type] = column;
      const checked = constraints.some((constraint) => constraint.includes(`((${name})::public.phone)`));
      return [{ table, name, type, checked }];
    });
  });
}

/** The columns that should hold numbers in international format but aren't held to it. */
function unchecked(columns: Column[]): string[] {
  return columns
    .filter((c) => (c.type === "text" && NUMBER_NAME.test(c.name)) || MIXED.includes(`${c.table}.${c.name}`))
    .filter((c) => c.type !== "public.phone" && !c.checked)
    .map((c) => `${c.table}.${c.name}`);
}

describe("phone number columns", () => {
  const schema = readFileSync("netlify/database/schema.sql", "utf8");
  const columns = columnsOf(schema);

  it("are each of the phone domain, or checked by a cast to it", () => {
    expect(unchecked(columns)).toEqual([]);
  });

  it("include every column that holds an email or a number", () => {
    expect(MIXED.filter((name) => !columns.some((c) => `${c.table}.${c.name}` === name))).toEqual([]);
  });

  it("would spot a new column of numbers, or a check lost, but not a flag about phoning nor one declared phone", () => {
    const changed = schema
      .replace("    phone text,\n", "    phone text,\n    mobile_number text,\n    home_phone public.phone,\n")
      .replace(/\n {4}CONSTRAINT opt_outs_number_check [^\n]*/, "");
    expect(unchecked(columnsOf(changed))).toEqual(["civicrm_contacts.mobile_number", "opt_outs.address"]);
    expect(columns.some((c) => c.name === "do_not_phone")).toBe(true);
  });
});
