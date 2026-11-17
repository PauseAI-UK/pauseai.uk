import { describe, expect, it } from "vitest";
import { mergeShards, shortfalls } from "./merge-coverage.mjs";

/** A file's report with one statement, at `end` on line 1, run `count` times. */
function report(path: string, count: number, end: number | null = 10) {
  return {
    path,
    statementMap: { 0: { start: { line: 1, column: 0 }, end: { line: 1, column: end } } },
    fnMap: {},
    branchMap: {},
    s: { 0: count },
    f: {},
    b: {},
  };
}

describe("mergeShards", () => {
  it("drops a shard's all-zero report of a file another shard ran, mapped another way", () => {
    const map = mergeShards([{ "/a.tsx": report("/a.tsx", 3, null) }, { "/a.tsx": report("/a.tsx", 0, 10) }]);
    expect(shortfalls(map)).toEqual([]);
    expect(map.getCoverageSummary().statements.total).toBe(1);
  });

  it("adds up the shards that ran a file, and keeps the zeros of one no shard ran", () => {
    const map = mergeShards([
      { "/a.ts": report("/a.ts", 1), "/b.ts": report("/b.ts", 0) },
      { "/a.ts": report("/a.ts", 2), "/b.ts": report("/b.ts", 0) },
    ]);
    expect(map.fileCoverageFor("/a.ts").s).toEqual({ 0: 3 });
    expect(shortfalls(map)).toEqual(["/b.ts: statements 0%", "/b.ts: lines 0%"]);
  });
});

describe("shortfalls", () => {
  it("names a file by its path from the root, or whole when it's outside it", () => {
    const map = mergeShards([
      { "/repo/lib/x.ts": report("/repo/lib/x.ts", 0), "/other/y.ts": report("/other/y.ts", 0) },
    ]);
    expect(shortfalls(map, "/repo")).toEqual([
      "lib/x.ts: statements 0%",
      "lib/x.ts: lines 0%",
      "/other/y.ts: statements 0%",
      "/other/y.ts: lines 0%",
    ]);
  });
});
