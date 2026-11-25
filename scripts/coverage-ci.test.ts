import { describe, expect, it } from "vitest";
import { commonRoot, coverageReport, uncovered } from "./coverage-ci.mjs";

const loc = (line: number, column = 2) => ({ start: { line, column }, end: { line, column: column + 5 } });

/** A file's coverage as a shard writes it, with a statement, an if and a function, hit as given. */
function file(path: string, hits: { s: number[]; b: number[]; f: number }) {
  return {
    path,
    statementMap: { 0: loc(1), 1: loc(2) },
    s: { 0: hits.s[0], 1: hits.s[1] },
    branchMap: { 0: { type: "if", loc: loc(3), locations: [loc(3), loc(4)], line: 3 } },
    b: { 0: hits.b },
    fnMap: { 0: { name: "go", decl: loc(5), loc: loc(5), line: 5 } },
    f: { 0: hits.f },
  };
}

describe("commonRoot", () => {
  it("finds the folder every file is under", () => {
    expect(commonRoot(["/w/repo/lib/a.ts", "/w/repo/app/b.tsx"])).toBe("/w/repo");
    expect(commonRoot([])).toBe("");
  });
});

describe("uncovered", () => {
  it("lists each statement, way of a branch and function with no hits, by line, with each shard's count", () => {
    const merged = file("a", { s: [0, 1], b: [1, 0], f: 0 });
    const shard = file("a", { s: [0, 1], b: [1, 0], f: 0 });
    const elsewhere = {
      ...file("a", { s: [0, 0], b: [0, 0], f: 0 }),
      statementMap: { 0: loc(9) },
      branchMap: {},
      fnMap: {},
    };
    expect(uncovered(merged, [shard, undefined, elsewhere])).toEqual([
      { line: 1, what: "statement at 1:2", shards: "0 - -" },
      { line: 3, what: "if at 3:2, way 2 of 2", shards: "0 - -" },
      { line: 5, what: "function go at 5:2", shards: "0 - -" },
    ]);
  });
});

describe("coverageReport", () => {
  const shards = [
    {
      "/w/repo/lib/a.ts": file("/w/repo/lib/a.ts", { s: [0, 1], b: [1, 0], f: 1 }),
      "/w/repo/app/b.ts": file("/w/repo/app/b.ts", { s: [1, 1], b: [1, 1], f: 1 }),
    },
    { "/w/repo/lib/a.ts": file("/w/repo/lib/a.ts", { s: [0, 0], b: [0, 0], f: 0 }) },
  ];

  it("merges the shards and reports each file under 100%, as a path from the checkout", () => {
    expect(coverageReport(shards)).toBe(
      [
        "lib/a.ts: 2 uncovered, each shard's count",
        "  line 1: statement at 1:2 (0 0)",
        "  line 3: if at 3:2, way 2 of 2 (0 0)",
      ].join("\n"),
    );
  });

  it("reports the one file asked for, though it's covered, and says when every file is", () => {
    expect(coverageReport(shards, "app/b.ts")).toBe("app/b.ts: all covered");
    expect(coverageReport([shards[0]], "lib/none.ts")).toBe("Every file is at 100%.");
  });
});
