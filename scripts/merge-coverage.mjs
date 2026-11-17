#!/usr/bin/env node
// Merges the coverage of CI's Test shards, and fails on any file under 100%,
// as `thresholds: { 100: true, perFile: true }` in vitest.config.mts does
// for a whole run.
//
//   node scripts/merge-coverage.mjs <coverage-final.json>...
//
// Each shard reports every file the coverage includes. One its tests didn't
// load it reports as all zeros, transformed as a Node module, whose map of
// a component can differ from the browser's: a statement ending at a column
// in one ends at the line's end in the other. Merged, those are two
// statements, one never run. So a shard's all-zero report of a file is
// dropped when another shard ran it: it can add nothing covered, only
// statements mapped another way. A file no shard ran keeps its zeros.
import { readFileSync } from "node:fs";
import { createCoverageMap } from "@vitest/istanbul-lib-coverage";

const METRICS = ["statements", "branches", "functions", "lines"];

/** Whether any of a file's statements, functions or branches ran. */
function ran(file) {
  return [...Object.values(file.s), ...Object.values(file.f), ...Object.values(file.b).flat()].some((n) => n > 0);
}

/** The shards' coverage, each as coverage-final.json has it, merged. */
export function mergeShards(shards) {
  const map = createCoverageMap({});
  for (const path of new Set(shards.flatMap((shard) => Object.keys(shard)))) {
    const reports = shards.map((shard) => shard[path]).filter(Boolean);
    const kept = reports.some(ran) ? reports.filter(ran) : reports;
    for (const report of kept) map.merge({ [path]: report });
  }
  return map;
}

/** Each file under 100% in a metric, as "path: metric pct%". */
export function shortfalls(map, root = "") {
  return map.files().flatMap((path) => {
    const summary = map.fileCoverageFor(path).toSummary();
    const name = root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
    return METRICS.filter((metric) => summary[metric].pct < 100).map(
      (metric) => `${name}: ${metric} ${summary[metric].pct}%`,
    );
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const map = mergeShards(process.argv.slice(2).map((file) => JSON.parse(readFileSync(file, "utf8"))));
  const short = shortfalls(map, process.cwd());
  const total = map.getCoverageSummary();
  for (const metric of METRICS) console.log(`${metric}: ${total[metric].covered}/${total[metric].total}`);
  if (short.length > 0) {
    console.log(`\nEvery file must be at 100% (docs/testing.md, "Coverage"). Under it:`);
    for (const line of short) console.log(`  ${line}`);
  }
  process.exit(short.length > 0 ? 1 : 0);
}
