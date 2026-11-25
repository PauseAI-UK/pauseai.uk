#!/usr/bin/env node
// CI's merged coverage, here: what each file CI found under 100% leaves
// uncovered, by line, and how each shard counted it.
//
//   npm run coverage:ci -- <run id>
//   npm run coverage:ci -- <run id> --file lib/server/db.server.ts
//
// CI runs the tests in three shards and merges their coverage
// (scripts/merge-coverage.mjs), and a file can pass `npm test` here and fail
// that merge, as each shard maps a file a little differently. CI's failure
// names the file and a percentage, not the statement. This downloads the
// run's coverage artifacts (with gh) to tmp/coverage-ci/<run id>/, merges
// them as CI does, and prints each statement, branch and function left
// uncovered, with its line and each shard's count. `--file` picks one file.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCoverageMap } from "@vitest/istanbul-lib-coverage";
import { mergeShards } from "./merge-coverage.mjs";

/** The folder every path in `files` is under: the checkout CI ran in. */
export function commonRoot(files) {
  if (files.length === 0) return "";
  const parts = files.map((file) => file.split("/").slice(0, -1));
  const shared = [];
  for (let i = 0; parts.every((p) => i < p.length && p[i] === parts[0][i]); i++) shared.push(parts[0][i]);
  return shared.join("/");
}

/** A location as "line:column". */
const at = (loc) => `${loc.start.line}:${loc.start.column}`;

/**
 * What one file's merged coverage (`merged`, an istanbul FileCoverage's
 * data) leaves uncovered: each statement, branch's way and function with
 * no hits, by line, with what each shard (`shards`, the same file's data
 * from each, or undefined where a shard doesn't have it) counted at the
 * same place, or "-" where it maps nothing there.
 */
export function uncovered(merged, shards) {
  const counted = (kind, loc, way) =>
    shards
      .map((shard) => {
        if (!shard) return "-";
        const map = kind === "statement" ? shard.statementMap : kind === "branch" ? shard.branchMap : shard.fnMap;
        const hits = kind === "statement" ? shard.s : kind === "branch" ? shard.b : shard.f;
        const id = Object.keys(map).find((key) => at(kind === "statement" ? map[key] : map[key].loc) === at(loc));
        if (id === undefined) return "-";
        return String(kind === "branch" ? (hits[id][way] ?? "-") : hits[id]);
      })
      .join(" ");
  const found = [];
  for (const [id, loc] of Object.entries(merged.statementMap)) {
    if (merged.s[id] === 0)
      found.push({ line: loc.start.line, what: `statement at ${at(loc)}`, shards: counted("statement", loc) });
  }
  for (const [id, branch] of Object.entries(merged.branchMap)) {
    merged.b[id].forEach((hits, way) => {
      if (hits === 0)
        found.push({
          line: branch.loc.start.line,
          what: `${branch.type} at ${at(branch.loc)}, way ${way + 1} of ${merged.b[id].length}`,
          shards: counted("branch", branch.loc, way),
        });
    });
  }
  for (const [id, fn] of Object.entries(merged.fnMap)) {
    if (merged.f[id] === 0)
      found.push({
        line: fn.loc.start.line,
        what: `function ${fn.name} at ${at(fn.loc)}`,
        shards: counted("function", fn.loc),
      });
  }
  return found.sort((a, b) => a.line - b.line);
}

/**
 * The report for the shards' reports (`shards`, each coverage-final.json
 * parsed): each file under 100% (or only `only`, a path from the root), and
 * what it leaves uncovered.
 */
export function coverageReport(shards, only) {
  const map = mergeShards(shards);
  const root = commonRoot(map.files());
  const name = (path) => (root ? path.slice(root.length + 1) : path);
  const maps = shards.map((shard) => createCoverageMap(shard));
  const lines = [];
  for (const path of map.files()) {
    if (only && name(path) !== only) continue;
    const file = map.fileCoverageFor(path);
    const summary = file.toSummary();
    if (!only && ["statements", "branches", "functions", "lines"].every((metric) => summary[metric].pct === 100))
      continue;
    const found = uncovered(
      file.data,
      maps.map((shard) => (shard.files().includes(path) ? shard.fileCoverageFor(path).data : undefined)),
    );
    lines.push(
      `${name(path)}: ${found.length === 0 ? "all covered" : `${found.length} uncovered, each shard's count`}`,
    );
    for (const { line, what, shards: counts } of found) lines.push(`  line ${line}: ${what} (${counts})`);
  }
  return lines.length > 0 ? lines.join("\n") : "Every file is at 100%.";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [run, ...rest] = process.argv.slice(2);
  if (!run || !/^\d+$/.test(run)) {
    console.error("Usage: npm run coverage:ci -- <run id> [--file <path>]");
    process.exit(1);
  }
  const only = rest[0] === "--file" ? rest[1] : undefined;
  const dir = join("tmp", "coverage-ci", run);
  if (!existsSync(dir))
    execFileSync("gh", ["run", "download", run, "--pattern", "coverage-*", "--dir", dir], { stdio: "inherit" });
  const files = readdirSync(dir)
    .filter((name) => name.startsWith("coverage-"))
    .sort()
    .map((name) => join(dir, name, "coverage-final.json"));
  console.log(`Shards, in this order: ${files.map((file) => file.split("/").at(-2)).join(", ")}\n`);
  console.log(
    coverageReport(
      files.map((file) => JSON.parse(readFileSync(file, "utf8"))),
      only,
    ),
  );
}
