import { describe, expect, it } from "vitest";
import {
  changedFiles,
  type FileCoverage,
  lineRanges,
  report,
  sourcesToCover,
  uncovered,
  vitestArgs,
} from "./test-changed.mjs";

// A function `pick` on lines 1-6 whose `if` on line 2 was only ever true,
// and `never`, on line 8, never called.
const partial: FileCoverage = {
  statementMap: {
    0: { start: { line: 2, column: 2 }, end: { line: 4 } },
    1: { start: { line: 3, column: 4 }, end: { line: 3 } },
    2: { start: { line: 5, column: 2 }, end: { line: 5 } },
    3: { start: { line: 5, column: 20 }, end: { line: 5 } },
    4: { start: { line: 9, column: 2 }, end: { line: 9 } },
  },
  s: { 0: 1, 1: 1, 2: 0, 3: 0, 4: 0 },
  fnMap: { 0: { name: "pick", line: 1 }, 1: { name: "never", line: 8 } },
  f: { 0: 1, 1: 0 },
  branchMap: {
    0: {
      type: "if",
      line: 2,
      locations: [
        { start: { line: 2, column: 2 }, end: { line: 4 } },
        { start: {}, end: {} },
      ],
    },
    1: {
      type: "cond-expr",
      line: 6,
      locations: [
        { start: { line: 6, column: 22 }, end: { line: 6 } },
        { start: { line: 6, column: 32 }, end: { line: 6 } },
      ],
    },
  },
  b: { 0: [1, 0], 1: [0, 3] },
};

const covered: FileCoverage = {
  statementMap: { 0: { start: { line: 1, column: 0 }, end: { line: 1 } } },
  s: { 0: 2 },
  fnMap: {},
  f: {},
  branchMap: {},
  b: {},
};

describe("changedFiles", () => {
  it("lists what's committed since the base, staged, modified and new, once each, in order", () => {
    const asked: string[][] = [];
    const git = (args: string[]) => {
      asked.push(args);
      return { diff: args.includes("--cached") ? "lib/b.ts\n" : "lib/c.ts\nlib/a.ts\n", "ls-files": "lib/a.ts\n" }[
        args[0]
      ]!;
    };
    expect(changedFiles("origin/main", git)).toEqual(["lib/a.ts", "lib/b.ts", "lib/c.ts"]);
    expect(asked).toEqual([
      ["diff", "--name-only", "origin/main...HEAD"],
      ["diff", "--cached", "--name-only"],
      ["ls-files", "--other", "--modified", "--exclude-standard"],
    ]);
  });
});

describe("sourcesToCover", () => {
  const coverage = { include: ["lib/**/*.{ts,tsx}", "proxy.ts"], exclude: ["**/*.test.{ts,tsx}", "**/page.tsx"] };

  it("keeps the files the coverage report has, leaving out tests, pages, other files and deleted ones", () => {
    const files = ["docs/testing.md", "lib/a.test.ts", "lib/a.ts", "lib/gone.ts", "lib/x/page.tsx", "proxy.ts"];
    expect(sourcesToCover(files, coverage, (file) => file !== "lib/gone.ts")).toEqual(["lib/a.ts", "proxy.ts"]);
  });

  it("checks the disk when not told", () => {
    expect(sourcesToCover(["lib/now.ts", "lib/no-such-file.ts"], coverage)).toEqual(["lib/now.ts"]);
  });
});

describe("lineRanges", () => {
  it("joins runs of lines, in order, once each", () => {
    expect(lineRanges([9, 3, 4, 5, 4, 12, 13])).toBe("3-5, 9, 12-13");
    expect(lineRanges([])).toBe("");
  });
});

describe("uncovered", () => {
  it("names the lines no statement ran on, the functions never called and the branch paths never taken", () => {
    expect(uncovered(partial)).toEqual({
      percents: { statements: 40, branches: 50, functions: 50, lines: 50 },
      lines: [5, 9],
      functions: ["never (line 8)"],
      branches: ["2 if 2/2", "6:23 cond-expr 1/2"],
    });
  });

  it("counts a file with nothing to cover as covered", () => {
    expect(uncovered({ ...covered, statementMap: {}, s: {} }).percents).toEqual({
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    });
  });
});

describe("report", () => {
  it("says of each file whether it's covered, and what isn't", () => {
    const coverage = {
      "/repo/lib/partial.ts": partial,
      "/repo/lib/covered.ts": covered,
      "/repo/lib/unrun.ts": { ...covered, s: { 0: 0 } },
    };
    expect(report(["lib/covered.ts", "lib/partial.ts", "lib/types.ts", "lib/unrun.ts"], coverage, "/repo")).toBe(
      [
        "lib/covered.ts: covered",
        "lib/partial.ts: statements 40%, branches 50%, functions 50%, lines 50%",
        "  lines not run: 5, 9",
        "  functions not called: never (line 8)",
        "  branches not taken: 2 if 2/2, 6:23 cond-expr 1/2",
        "lib/types.ts: no code to cover",
        "lib/unrun.ts: no test runs it",
      ].join("\n"),
    );
  });

  it("leaves out what's all covered: a file with only a branch not taken", () => {
    const branchOnly = { ...partial, s: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 }, f: { 0: 1, 1: 1 } };
    expect(report(["lib/partial.ts"], { "/repo/lib/partial.ts": branchOnly }, "/repo")).toBe(
      [
        "lib/partial.ts: statements 100%, branches 50%, functions 100%, lines 100%",
        "  branches not taken: 2 if 2/2, 6:23 cond-expr 1/2",
      ].join("\n"),
    );
  });
});

describe("vitestArgs", () => {
  it("runs the changed tests with coverage of the changed sources alone, reported even when a test fails", () => {
    expect(vitestArgs(["lib/a.ts", "proxy.ts"], ["--project", "node"])).toEqual([
      "vitest",
      "run",
      "--changed",
      "origin/main",
      "--coverage",
      "--coverage.reportOnFailure",
      "--coverage.include=lib/a.ts",
      "--coverage.include=proxy.ts",
      "--coverage.reporter=json",
      "--coverage.reportsDirectory=tmp/coverage-changed",
      "--project",
      "node",
    ]);
  });

  it("runs them without coverage when no changed file is in the report", () => {
    expect(vitestArgs([])).toEqual(["vitest", "run", "--changed", "origin/main"]);
  });
});
