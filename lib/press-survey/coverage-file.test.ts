import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OUTLETS } from "../content/press-coverage";
import { addToCoverageFile, commentLines, type Addition } from "./coverage-file";

const file = readFileSync(join(__dirname, "..", "content", "press-coverage.ts"), "utf8");
const names = OUTLETS.map((outlet) => outlet.name);

const addition = (fields: Partial<Addition>): Addition => ({
  outlet: "The Example Gazette",
  title: 'Protesters say "pause"',
  url: "https://example.com/a",
  date: "2026-11-10",
  medium: "Article",
  note: "Quotes Jane Smith of PauseAI UK.",
  ...fields,
});

it("commentLines wraps a note into comment lines", () => {
  expect(commentLines("one two three four", "  ", 9)).toEqual(["  // one two", "  // three", "  // four"]);
});

describe("addToCoverageFile", () => {
  it("adds a new outlet at the end of OUTLETS, escaping every value", () => {
    const text = addToCoverageFile(
      file,
      [addition({}), addition({ title: "Second", url: "https://example.com/b", date: undefined })],
      names,
    );
    expect(text).toContain(
      [
        "  {",
        '    name: "The Example Gazette",',
        "    articles: [",
        "      {",
        "        // Quotes Jane Smith of PauseAI UK.",
        '        title: "Protesters say \\"pause\\"",',
        '        url: "https://example.com/a",',
        '        date: "2026-11-10",',
        '        medium: "Article",',
        "      },",
        "      {",
        "        // Quotes Jane Smith of PauseAI UK.",
        '        title: "Second",',
        '        url: "https://example.com/b",',
        '        medium: "Article",',
        "      },",
        "    ],",
        "  },",
        "];",
      ].join("\n"),
    );
  });

  it("adds to an outlet the file has, after its last article", () => {
    const text = addToCoverageFile(
      file,
      [addition({ outlet: "Financial Times" }), addition({ outlet: "The Japan Times" })],
      names,
    );
    const ft = text.indexOf('    name: "Financial Times",');
    const added = text.indexOf('        title: "Protesters say \\"pause\\"",', ft);
    expect(added).toBeGreaterThan(text.indexOf("1b3e3117-b979-4187-b983-c785d230c09b", ft));
    expect(added).toBeLessThan(text.indexOf('    name: "Wired Italia",'));
    expect(text.match(/Protesters say/g)).toHaveLength(2);
    expect(text.split("\n").length).toBe(file.split("\n").length + 2 * 7);
  });

  it("finds every outlet in the file by name", () => {
    for (const name of names) expect(() => addToCoverageFile(file, [addition({ outlet: name })], names)).not.toThrow();
  });

  it("throws rather than guess where an addition goes", () => {
    expect(() => addToCoverageFile("const x = 1;", [], [])).toThrow("Can't find OUTLETS");
    expect(() => addToCoverageFile(file, [addition({ outlet: "Nowhere" })], ["Nowhere"])).toThrow(
      "Can't find Nowhere's articles",
    );
    const shortened = 'export const OUTLETS: Outlet[] = [\n  {\n    name: "A",\n    articles: [\n];\n    ],';
    expect(() => addToCoverageFile(shortened, [addition({ outlet: "A" })], ["A"])).toThrow("Can't find A's articles");
  });
});
