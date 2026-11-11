import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Names sort in English order: Áine among the A names, de Souza among the
// D names. The database's own collation, C.UTF-8, puts capitals before
// lower case and every accented letter after z, so each sort by a name says
// its collation. Postgres won't change the column's instead, as views use
// notable_people.name. This fails on a sort key that sorts by a name (a
// column called name, perhaps in lower(), or a JSON field called name)
// without it.
const COLLATED = 'COLLATE "en-GB-x-icu"';
const NAME_KEY = /(?:^|[\s(.])name\b(?!\s*(?:=|<>))|->>\s*'name'/;

// The site's code; tests sort as they please.
const CODE_DIRS = ["app", "components", "lib", "netlify"];
const CODE_FILE = /\.[cm]?[jt]sx?$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/**
 * Each sort key of each ORDER BY in `code`: the clause runs to the end of
 * its line, string or brackets, or its LIMIT or OFFSET, and splits at the
 * commas outside brackets.
 */
function sortKeys(code: string): string[] {
  const keys: string[] = [];
  for (const match of code.matchAll(/\bORDER BY\b/g)) {
    let depth = 0;
    let key = "";
    for (let at = match.index + match[0].length; at < code.length; at++) {
      if (code.startsWith(COLLATED, at)) {
        key += COLLATED;
        at += COLLATED.length - 1;
        continue;
      }
      const char = code[at];
      if (char === "(" || char === "{") depth++;
      if (char === ")" || char === "}") depth--;
      if (depth < 0 || '\n`";'.includes(char) || (depth === 0 && /^\s(LIMIT|OFFSET)\b/.test(code.slice(at)))) break;
      if (depth === 0 && char === ",") {
        keys.push(key.trim());
        key = "";
      } else key += char;
    }
    keys.push(key.trim());
  }
  return keys;
}

const uncollated = (code: string) => sortKeys(code).filter((key) => NAME_KEY.test(key) && !key.includes(COLLATED));

function unsorted(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return unsorted(path);
    if (!CODE_FILE.test(entry.name) || TEST_FILE.test(entry.name)) return [];
    return uncollated(readFileSync(path, "utf8")).map((key) => `${path}: ${key}`);
  });
}

describe("name sorts", () => {
  it("every sort by a name sorts in English order", () => {
    expect(CODE_DIRS.flatMap((dir) => unsorted(dir))).toEqual([]);
  });

  it("would spot a sort by a name without it", () => {
    expect(uncollated("SELECT name FROM people ORDER BY name")).toEqual(["name"]);
    expect(uncollated("`SELECT 1 ORDER BY n.name, n.id LIMIT 5`")).toEqual(["n.name"]);
    expect(uncollated("json_agg(x ORDER BY p.name = '', lower(p.name), p.email)")).toEqual(["lower(p.name)"]);
    expect(uncollated("ORDER BY c.merge_values ->> 'name' NULLS LAST, c.id")).toEqual([
      "c.merge_values ->> 'name' NULLS LAST",
    ]);
    expect(uncollated("ORDER BY ${near} DESC, n.name\nLIMIT 3")).toEqual(["n.name"]);
  });

  it("passes a sort by a name in English order, or by something else", () => {
    expect(uncollated(`ORDER BY n.name ${COLLATED}, n.id`)).toEqual([]);
    expect(uncollated(`ORDER BY (c.merge_values ->> 'name') ${COLLATED} NULLS LAST`)).toEqual([]);
    expect(uncollated("ORDER BY m.from_name, first.at, surname")).toEqual([]);
  });
});
