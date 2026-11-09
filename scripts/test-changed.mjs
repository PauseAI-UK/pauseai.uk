#!/usr/bin/env node
// The tests for the files changed since origin/main, committed or not, with
// coverage of only the changed source files, then each one's uncovered
// lines, functions and branches. For a quick look while writing tests: the
// gate is still `npm test`, over every file.
//
//   npm run test:changed               both Vitest projects
//   npm run test:changed -- --project node   anything after -- goes to Vitest
//
// Vitest's --changed picks the tests: those that import a changed file, and
// changed test files. A failing test, such as tests/checks/placeholder-copy.test.ts
// while copy is a placeholder, still gets the coverage report. Exits as
// Vitest did: non-zero if a test failed or a changed file is under 100%.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, matchesGlob, relative } from "node:path";

const BASE = "origin/main";
const REPORTS = join("tmp", "coverage-changed");

/** The files changed since `base`, as Vitest's --changed finds them: committed, staged, modified and new. */
export function changedFiles(base = BASE, git = (args) => execFileSync("git", args, { encoding: "utf8" })) {
  const lists = [
    ["diff", "--name-only", `${base}...HEAD`],
    ["diff", "--cached", "--name-only"],
    ["ls-files", "--other", "--modified", "--exclude-standard"],
  ].map((args) => git(args).split("\n"));
  return [...new Set(lists.flat().filter((file) => file !== ""))].sort();
}

/** Those of `files` the gate's coverage report has, and that still exist. */
export function sourcesToCover(files, { include, exclude }, exists = existsSync) {
  const matches = (file, globs) => globs.some((glob) => matchesGlob(file, glob));
  return files.filter((file) => matches(file, include) && !matches(file, exclude) && exists(file));
}

/** Line numbers as ranges: 3-5, 9. */
export function lineRanges(lines) {
  const ranges = [];
  for (const line of [...new Set(lines)].sort((a, b) => a - b)) {
    const last = ranges.at(-1);
    if (last && line === last[1] + 1) last[1] = line;
    else ranges.push([line, line]);
  }
  return ranges.map(([from, to]) => (from === to ? `${from}` : `${from}-${to}`)).join(", ");
}

const percent = (counts) => {
  const covered = counts.filter((count) => count > 0).length;
  return counts.length === 0 ? 100 : Math.floor((covered / counts.length) * 1000) / 10;
};

/**
 * What one file's coverage (Istanbul's JSON, as Vitest writes it) leaves
 * out: a line is uncovered when no statement starting on it ran, and a
 * branch path when it was never taken, named by the line and column it
 * starts at, its kind and which of its paths.
 */
export function uncovered(file) {
  const lineRuns = new Map();
  for (const [id, statement] of Object.entries(file.statementMap)) {
    const line = statement.start.line;
    lineRuns.set(line, Math.max(lineRuns.get(line) ?? 0, file.s[id]));
  }
  const branches = Object.entries(file.branchMap).flatMap(([id, branch]) =>
    file.b[id].flatMap((count, path) => {
      if (count > 0) return [];
      const start = branch.locations[path]?.start ?? {};
      const where = start.line === undefined ? `${branch.line}` : `${start.line}:${start.column + 1}`;
      return [`${where} ${branch.type} ${path + 1}/${file.b[id].length}`];
    }),
  );
  return {
    percents: {
      statements: percent(Object.values(file.s)),
      branches: percent(Object.values(file.b).flat()),
      functions: percent(Object.values(file.f)),
      lines: percent([...lineRuns.values()]),
    },
    lines: [...lineRuns].filter(([, runs]) => runs === 0).map(([line]) => line),
    functions: Object.entries(file.fnMap)
      .filter(([id]) => file.f[id] === 0)
      .map(([, fn]) => `${fn.name} (line ${fn.line})`),
    branches,
  };
}

/** The report on each of `sources`, from `coverage`, keyed by absolute path, under `root`. */
export function report(sources, coverage, root) {
  const byFile = new Map(Object.entries(coverage).map(([path, file]) => [relative(root, path), file]));
  return sources
    .map((source) => {
      const file = byFile.get(source);
      if (!file) return `${source}: no code to cover`;
      const gaps = uncovered(file);
      const { statements, branches, functions, lines } = gaps.percents;
      if (statements === 0) return `${source}: no test runs it`;
      if (gaps.lines.length + gaps.functions.length + gaps.branches.length === 0) return `${source}: covered`;
      return [
        `${source}: statements ${statements}%, branches ${branches}%, functions ${functions}%, lines ${lines}%`,
        gaps.lines.length > 0 && `  lines not run: ${lineRanges(gaps.lines)}`,
        gaps.functions.length > 0 && `  functions not called: ${gaps.functions.join(", ")}`,
        gaps.branches.length > 0 && `  branches not taken: ${gaps.branches.join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

/** The Vitest arguments: the changed tests, coverage of `sources` alone, kept apart from `npm test`'s report. */
export function vitestArgs(sources, extra = []) {
  const coverage =
    sources.length === 0
      ? []
      : [
          "--coverage",
          "--coverage.reportOnFailure",
          ...sources.map((source) => `--coverage.include=${source}`),
          "--coverage.reporter=json",
          `--coverage.reportsDirectory=${REPORTS}`,
        ];
  return ["vitest", "run", "--changed", BASE, ...coverage, ...extra];
}

async function main() {
  const changed = changedFiles();
  if (changed.length === 0) {
    console.log(`Nothing has changed since ${BASE}.`);
    return 0;
  }
  const { default: config } = await import("../vitest.config.mts");
  const sources = sourcesToCover(changed, config.test.coverage);
  const vitest = spawnSync("npx", vitestArgs(sources, process.argv.slice(2)), { stdio: "inherit" });
  console.log(`\nCoverage of the source files changed since ${BASE}:`);
  const written = join(REPORTS, "coverage-final.json");
  if (sources.length === 0) console.log("none of the changed files is in the coverage report.");
  else if (!existsSync(written)) console.log("Vitest wrote no coverage report.");
  else console.log(report(sources, JSON.parse(readFileSync(written, "utf8")), process.cwd()));
  return vitest.status ?? 1;
}

if (basename(process.argv[1] ?? "") === "test-changed.mjs") process.exitCode = await main();
