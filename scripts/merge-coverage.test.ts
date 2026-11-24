import { describe, expect, it } from "vitest";
import { mergeShards, shortfalls } from "./merge-coverage.mjs";

/** Start line, start column, end line, end column; Infinity ends at the line's end. */
type Range = [number, number, number, number];

interface Entries {
  statements?: [Range, number][];
  functions?: [Range, number][];
  /** Each branch's whole range, then each arm's range and count. */
  branches?: [string, Range, [Range, number][]][];
}

function loc([startLine, startColumn, endLine, endColumn]: Range) {
  return { start: { line: startLine, column: startColumn }, end: { line: endLine, column: endColumn } };
}

/** One file's report, as a shard's coverage-final.json has it. */
function report(path: string, { statements = [], functions = [], branches = [] }: Entries) {
  return {
    path,
    statementMap: Object.fromEntries(statements.map(([range], i) => [i, loc(range)])),
    s: Object.fromEntries(statements.map(([, count], i) => [i, count])),
    fnMap: Object.fromEntries(
      functions.map(([range], i) => [i, { name: `f${i}`, decl: loc(range), loc: loc(range), line: range[0] }]),
    ),
    f: Object.fromEntries(functions.map(([, count], i) => [i, count])),
    branchMap: Object.fromEntries(
      branches.map(([type, range, arms], i) => [
        i,
        { type, loc: loc(range), locations: arms.map(([armRange]) => loc(armRange)), line: range[0] },
      ]),
    ),
    b: Object.fromEntries(branches.map(([, , arms], i) => [i, arms.map(([, count]) => count)])),
  };
}

/** A shard's coverage-final.json of one file, written and read back as CI does. */
function shard(entries: Entries, path = "/repo/app/Form.tsx") {
  return JSON.parse(JSON.stringify({ [path]: report(path, entries) }));
}

// `const { pending } = useFormStatus();` on line 11: the node project ends
// the call at column 36, the browser at the line's end, which JSON writes as
// a null column.
const hookByNode: Entries = { statements: [[[11, 22, 11, 36], 0]] };
const hookByBrowser: Entries = { statements: [[[11, 22, 11, Infinity], 137]] };

describe("mergeShards", () => {
  it.each([
    ["node's first", [hookByNode, hookByBrowser]],
    ["the browser's first", [hookByBrowser, hookByNode]],
  ])("counts a hook's call each project ends differently as run, with %s", (_, order) => {
    const map = mergeShards(order.map((entries) => shard(entries)));
    expect(shortfalls(map)).toEqual([]);
  });

  it("covers a file one shard ran by what the other reports of it unloaded, all zeros", () => {
    // `const [choosing, choose] = useLeaving();` in a component, beside its
    // function and an `if`, which both projects map alike.
    const fn: Range = [150, 0, 160, 1];
    const branch: Range = [155, 2, 157, 3];
    const unloaded = shard({
      statements: [[[153, 29, 153, 40], 0]],
      functions: [[fn, 0]],
      branches: [
        [
          "if",
          branch,
          [
            [branch, 0],
            [branch, 0],
          ],
        ],
      ],
    });
    const ran = shard({
      statements: [[[153, 29, 153, Infinity], 135]],
      functions: [[fn, 135]],
      branches: [
        [
          "if",
          branch,
          [
            [branch, 2],
            [branch, 133],
          ],
        ],
      ],
    });
    expect(shortfalls(mergeShards([unloaded, ran]))).toEqual([]);
    expect(shortfalls(mergeShards([ran, unloaded]))).toEqual([]);
  });

  it("covers an import only the browser counts as a statement", () => {
    // `import Tag from "@/components/ui/Tag";`
    const unloaded = shard({ statements: [[[3, 2, 3, 30], 0]] });
    const ran = shard({
      statements: [
        [[1, 16, 1, Infinity], 1],
        [[3, 2, 3, 30], 4],
      ],
    });
    expect(shortfalls(mergeShards([unloaded, ran]))).toEqual([]);
  });

  it("covers a function each shard ends differently", () => {
    // `jsQrPromise ??= import("./jsqr").then((m) => m.jsQR);`, the arrow
    const map = mergeShards([
      shard({ functions: [[[39, 53, 39, 69], 0]] }),
      shard({ functions: [[[39, 53, 39, Infinity], 2]] }),
    ]);
    expect(shortfalls(map)).toEqual([]);
  });

  // {sent ? (
  //   <Sent />
  // ) : (
  //   <Draft />
  // )}
  const ternary = (sent: number, draft: number): Entries => ({
    branches: [
      [
        "cond-expr",
        [20, 7, 24, 7],
        [
          [[21, 4, 21, 12], sent],
          [[23, 4, 23, 13], draft],
        ],
      ],
    ],
  });

  it("adds up a multi-line JSX ternary's arms, one taken in each shard", () => {
    expect(shortfalls(mergeShards([shard(ternary(3, 0)), shard(ternary(0, 2))]))).toEqual([]);
  });

  it("fails a multi-line JSX ternary's arm no shard took", () => {
    expect(shortfalls(mergeShards([shard(ternary(3, 0)), shard(ternary(1, 0))]))).toEqual([
      "/repo/app/Form.tsx: branches 50%",
    ]);
  });

  it("fails a statement no shard ran, however each maps it", () => {
    const map = mergeShards([shard(hookByNode), shard({ statements: [[[11, 22, 11, Infinity], 0]] })]);
    expect(shortfalls(map)).toEqual(["/repo/app/Form.tsx: statements 0%", "/repo/app/Form.tsx: lines 0%"]);
  });

  it("gives a statement only one shard maps the count of the nearest statement around it, as a whole run does", () => {
    // Inside a block that ran, so it counts as run, though it didn't.
    const map = mergeShards([
      shard({
        statements: [
          [[5, 0, 9, 1], 0],
          [[7, 4, 7, 20], 0],
        ],
      }),
      shard({ statements: [[[5, 0, 9, 1], 1]] }),
    ]);
    expect(map.fileCoverageFor("/repo/app/Form.tsx").s).toEqual({ 0: 1, 1: 1 });
  });

  it("covers a dynamic import that only a shard which never ran it maps twice, by the statement around it", () => {
    // `const { flowDatabase } = await import("../flow-database.server");` on
    // line 15, in an `if` from line 12 to 17. Every range runs to its line's
    // end. A shard whose tests never took the `if` maps the import a second
    // time, from column 35, as a function of its own.
    const taken: Entries = {
      statements: [
        [[12, 2, 17, Infinity], 100],
        [[15, 29, 15, Infinity], 100],
      ],
    };
    const untaken: Entries = {
      statements: [
        [[12, 2, 17, Infinity], 50],
        [[15, 29, 15, Infinity], 0],
        [[15, 35, 15, Infinity], 0],
      ],
    };
    expect(shortfalls(mergeShards([shard(taken), shard(untaken)]))).toEqual([]);
    expect(shortfalls(mergeShards([shard(untaken), shard(taken)]))).toEqual([]);
  });

  it("adds up the shards' counts of a file each maps alike", () => {
    const map = mergeShards([shard({ statements: [[[1, 0, 1, 10], 1]] }), shard({ statements: [[[1, 0, 1, 10], 2]] })]);
    expect(map.fileCoverageFor("/repo/app/Form.tsx").s).toEqual({ 0: 3 });
  });
});

describe("shortfalls", () => {
  it("names a file by its path from the root, or whole when it's outside it", () => {
    const map = mergeShards([
      shard({ statements: [[[1, 0, 1, 10], 0]] }, "/repo/lib/x.ts"),
      shard({ statements: [[[1, 0, 1, 10], 0]] }, "/other/y.ts"),
    ]);
    expect(shortfalls(map, "/repo")).toEqual([
      "lib/x.ts: statements 0%",
      "lib/x.ts: lines 0%",
      "/other/y.ts: statements 0%",
      "/other/y.ts: lines 0%",
    ]);
  });
});
