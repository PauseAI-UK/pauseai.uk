#!/usr/bin/env node
// Merges the coverage of CI's Test shards, and fails on any file under 100%,
// as `thresholds: { 100: true, perFile: true }` in vitest.config.mts does
// for a whole run.
//
//   node scripts/merge-coverage.mjs <coverage-final.json>...
//
// The node and browser projects can map one statement to different ranges:
// a hook's call ends at a column in one and at the line's end in the other,
// and only the browser counts an import as a statement. A shard reports a
// file its tests didn't load as the node project maps it, all zeros. Istanbul
// merges a range with no match by adding the count of the nearest range
// around it, which is how one whole run comes out covered. A range that runs
// to its line's end has the column Infinity, which JSON writes as null.
// Istanbul matches a null to the one range with the same start and end line
// (https://github.com/vitest-dev/istanbuljs/pull/25), but looks for no range
// around one, so each null is made Infinity again before merging: a
// statement that only a shard whose block didn't run maps apart, such as
// the import() inside an `await import()`, then gets its block's count from
// the shards that ran it.
import { readFileSync } from "node:fs";
import { createCoverageMap } from "@vitest/istanbul-lib-coverage";

const METRICS = ["statements", "branches", "functions", "lines"];

/** A shard's report with each range's end at its line's end as the run had it, Infinity, where JSON wrote null. */
function asRun(shard) {
  return JSON.parse(JSON.stringify(shard), (key, value) => (key === "column" && value === null ? Infinity : value));
}

/** The shards' coverage-final.json files, parsed, merged. */
export function mergeShards(shards) {
  const map = createCoverageMap({});
  for (const shard of shards) map.merge(asRun(shard));
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
