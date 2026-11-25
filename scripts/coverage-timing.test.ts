import { describe, expect, it } from "vitest";
import { parseTiming, unsteady, unsteadyHits } from "./coverage-timing.mjs";

const loc = (line: number) => ({ start: { line, column: 0 }, end: { line, column: 9 } });

/** A file's coverage in one run, with one statement, one if and one function, hit as given. */
function run(s: number, b: [number, number], f: number) {
  return {
    "/repo/lib/a.ts": {
      statementMap: { 0: loc(1) },
      s: { 0: s },
      branchMap: { 0: { type: "if", loc: loc(2), locations: [loc(2), loc(3)] } },
      b: { 0: b },
      fnMap: { 0: { name: "go", loc: loc(4) } },
      f: { 0: f },
    },
  };
}

describe("unsteadyHits", () => {
  it("is none in one run and some in another, or a few that differ, and not many that differ", () => {
    expect(unsteadyHits([0, 3])).toBe(true);
    expect(unsteadyHits([2, 1])).toBe(true);
    expect(unsteadyHits([1, 1])).toBe(false);
    expect(unsteadyHits([5, 9])).toBe(false);
  });
});

describe("unsteady", () => {
  it("lists each count that differs between runs, by file and line", () => {
    expect(unsteady([run(1, [4, 0], 7), run(0, [4, 1], 7)], "/repo")).toEqual([
      "lib/a.ts:1 statement (1, 0)",
      "lib/a.ts:2 if, way 2 (0, 1)",
    ]);
  });

  it("counts a file a run hasn't, or a count it hasn't, as none, and keeps paths whole with no root", () => {
    const partial = { "/repo/lib/a.ts": { ...run(1, [1, 1], 1)["/repo/lib/a.ts"], s: {}, b: {}, f: {} } };
    expect(unsteady([{}, run(1, [1, 1], 1), partial])).toEqual([
      "/repo/lib/a.ts:1 statement (0, 1, 0)",
      "/repo/lib/a.ts:2 if, way 1 (0, 1, 0)",
      "/repo/lib/a.ts:2 if, way 2 (0, 1, 0)",
      "/repo/lib/a.ts:4 function go (0, 1, 0)",
    ]);
  });
});

describe("parseTiming", () => {
  it("takes how many runs, and how many at once", () => {
    expect(parseTiming([])).toEqual({ runs: 5, atOnce: 1 });
    expect(parseTiming(["--runs", "8", "--at-once", "2"])).toEqual({ runs: 8, atOnce: 2 });
    expect(() => parseTiming(["--runs", "1"])).toThrow(/Usage/);
  });
});
