#!/usr/bin/env node
// Deals CI's tests and flows into parts that take about as long as each
// other, by how long each took when last run. Vitest and Playwright's own
// `--shard` split by count, so a part with the slow files or flows (the
// gallery's, say) takes far longer than the rest.
//
// The times are kept in the Actions cache between runs (.github/workflows/ci.yml):
//
// - the tests' are Vitest's own (results.json, in node_modules/.vite/vitest),
//   which TimedSequencer reads when Vitest runs with `--shard`;
// - the flows' are written by tests/storyboard/report/times.ts.
//
// Every part reads the same times, so each deals the same parts and runs its
// own. Anything with no time yet is taken to be as long as the middle one of
// its group (a Vitest project, a storyboard section), and with no times at
// all every item is the same, so they're dealt out in turn.
//
//   node scripts/ci-parts.mjs storyboard <part>/<count> <times.json> <test-list>
//   node scripts/ci-parts.mjs merge-vitest <out dir> <results.json>...
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join, relative } from "node:path";
import { BaseSequencer } from "vitest/node";
import { listedFlows } from "./storyboard-main.mjs";

/** The middle of `numbers`, or undefined for none. */
function median(numbers) {
  if (numbers.length === 0) return undefined;
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * `items` ({ key, group, ms }, ms undefined when not known) dealt into
 * `count` parts of about the same time: longest first, each to the part
 * with the least so far. Each part's keys, in the order given.
 */
export function deal(items, count) {
  const known = items.filter((item) => item.ms !== undefined);
  const overall = median(known.map((item) => item.ms)) ?? 1;
  const byGroup = new Map();
  for (const item of known) byGroup.set(item.group, [...(byGroup.get(item.group) ?? []), item.ms]);
  const timed = items.map((item, order) => ({
    ...item,
    order,
    ms: item.ms ?? median(byGroup.get(item.group) ?? []) ?? overall,
  }));
  timed.sort((a, b) => b.ms - a.ms || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const parts = Array.from({ length: count }, () => ({ ms: 0, items: [] }));
  for (const item of timed) {
    const least = parts.reduce((best, part) => (part.ms < best.ms ? part : best));
    least.ms += item.ms;
    least.items.push(item);
  }
  return parts.map((part) => part.items.sort((a, b) => a.order - b.order).map((item) => item.key));
}

/**
 * Vitest's sequencer, sharding by the times in its results cache rather than
 * by count. Each project's files are dealt on their own, so every part gets
 * its share of each: the browser's files run fewer at once than Node's, so a
 * part with more of them takes longer, whatever its files' times add up to.
 */
export class TimedSequencer extends BaseSequencer {
  async shard(files) {
    const { root, shard } = this.ctx.config;
    const { index, count } = shard;
    // By project and path, not by place in `files`: each part's machine lists
    // the files in an order of its own, and every part must deal the same.
    const byKey = new Map(files.map((spec) => [`${spec.project.name} ${relative(root, spec.moduleId)}`, spec]));
    const items = [...byKey].map(([key, spec]) => ({
      key,
      group: spec.project.name,
      ms: this.ctx.cache.getTestSpecificationResult(spec)?.duration,
    }));
    const projects = [...new Set(items.map((item) => item.group))].sort();
    return projects
      .flatMap(
        (project) =>
          deal(
            items.filter((item) => item.group === project),
            count,
          )[index - 1],
      )
      .map((key) => byKey.get(key));
  }
}

/**
 * Vitest's results caches from each part, as one: for each file, the record
 * of the part that ran it last. Every part starts from the same cache, so
 * each holds every file, but only those it ran are new.
 */
export function mergeVitestResults(caches) {
  const projects = {};
  for (const cache of caches) {
    for (const [name, { files = {} }] of Object.entries(cache.projects)) {
      const merged = (projects[name] ??= { files: {} }).files;
      for (const [file, record] of Object.entries(files))
        if ((record.lastRun ?? 0) >= (merged[file]?.lastRun ?? 0)) merged[file] = record;
    }
  }
  return { version: caches[0].version, projects };
}

/** The lines for `playwright test --test-list` of `part` (from 1) of `count`, from `listed` (listedFlows) and `times` (ms by key). */
export function flowsForPart(listed, times, part, count) {
  const items = [...listed.keys()].map((key) => ({ key, group: key.split("|")[1], ms: times[key] }));
  return deal(items, count)[part - 1].map((key) => listed.get(key));
}

/** A JSON file's content, or undefined when it can't be read. */
function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, ...args] = process.argv.slice(2);
  if (command === "storyboard") {
    const [which, timesFile, out] = args;
    const [part, count] = which.split("/").map(Number);
    const listing = spawnSync("npx", ["playwright", "test", "--list", "--reporter=json"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (listing.status !== 0) throw new Error(`Couldn't list the flows:\n${listing.stderr}`);
    const times = readJson(timesFile) ?? {};
    const lines = flowsForPart(listedFlows(JSON.parse(listing.stdout)), times, part, count);
    writeFileSync(out, lines.join("\n"));
    console.log(`Part ${part} of ${count}: ${lines.length} flows, by the times of ${Object.keys(times).length}.`);
  } else if (command === "merge-vitest") {
    const [outDir, ...inputs] = args;
    const caches = inputs.map(readJson).filter(Boolean);
    // Vitest's folder for the cache is named by a hash of the config, as the parts' are.
    const out = join(outDir, basename(dirname(inputs[0])), "results.json");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(mergeVitestResults(caches)));
    console.log(`Merged ${caches.length} parts' test times into ${relative(process.cwd(), out)}.`);
  } else {
    throw new Error(`Unknown command ${command}: storyboard or merge-vitest.`);
  }
}
