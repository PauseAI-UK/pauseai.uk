#!/usr/bin/env node
// Coverage that depends on timing: a branch reached only when a timer or a
// connection happens to go one way passes `npm test` on a quiet machine and
// fails CI's per-file gate on a loaded one, on a PR that never touched it.
// This runs the tests several times, with a JSON coverage report each, and
// lists every statement, branch and function whose hits are none in one run
// and some in another, or differ between runs where any run had only one or
// two. Each one found wants a test that reaches it on purpose.
//
//   npm run coverage:timing                 # five runs, one after another
//   npm run coverage:timing -- --runs 8 --at-once 2
//
// `--at-once` runs that many at the same time, to load the machine as CI's
// is. Each run's report goes to tmp/coverage-timing/<n>/; the list to
// tmp/coverage-timing/unsteady.txt as well as the terminal. It takes a few
// minutes a run.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join("tmp", "coverage-timing");

/** Whether a count's hits across runs are unsteady: none in one and some in another, or a few that differ. */
export function unsteadyHits(counts) {
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  return min !== max && (min === 0 || min <= 2);
}

/**
 * The counts that differ between runs (`runs`, each a coverage-final.json
 * parsed), as "file:line what (hits in each run)", by file and line, with
 * files relative to `root`. A file one run has and another hasn't counts
 * as none there.
 */
export function unsteady(runs, root = "") {
  const files = [...new Set(runs.flatMap((run) => Object.keys(run)))].sort();
  const found = [];
  for (const path of files) {
    const name = root ? relative(root, path) : path;
    const first = runs.find((run) => run[path])[path];
    const each = (pick) => runs.map((run) => (run[path] ? pick(run[path]) : 0));
    for (const [id, loc] of Object.entries(first.statementMap)) {
      const counts = each((file) => file.s[id] ?? 0);
      if (unsteadyHits(counts)) found.push({ name, line: loc.start.line, what: "statement", counts });
    }
    for (const [id, branch] of Object.entries(first.branchMap)) {
      branch.locations.forEach((_, way) => {
        const counts = each((file) => file.b[id]?.[way] ?? 0);
        if (unsteadyHits(counts))
          found.push({ name, line: branch.loc.start.line, what: `${branch.type}, way ${way + 1}`, counts });
      });
    }
    for (const [id, fn] of Object.entries(first.fnMap)) {
      const counts = each((file) => file.f[id] ?? 0);
      if (unsteadyHits(counts)) found.push({ name, line: fn.loc.start.line, what: `function ${fn.name}`, counts });
    }
  }
  return found
    .sort((a, b) => a.name.localeCompare(b.name) || a.line - b.line)
    .map(({ name, line, what, counts }) => `${name}:${line} ${what} (${counts.join(", ")})`);
}

/** `--runs` and `--at-once`, as numbers. */
export function parseTiming(args) {
  const options = { runs: 5, atOnce: 1 };
  for (let i = 0; i < args.length; i++) {
    const value = Number(args[i + 1]);
    if (args[i] === "--runs" && value >= 2) options.runs = value;
    else if (args[i] === "--at-once" && value >= 1) options.atOnce = value;
    else throw new Error(`Usage: npm run coverage:timing -- [--runs <2 or more>] [--at-once <n>], not ${args[i]}`);
    i++;
  }
  return options;
}

/** One run of every test, its JSON coverage report in `dir`, resolving once it's done. */
function run(n, dir) {
  const args = [
    "vitest",
    "run",
    "--coverage",
    "--coverage.reporter=json",
    `--coverage.reportsDirectory=${dir}`,
    "--coverage.thresholds.100=false",
    "--coverage.thresholds.perFile=false",
  ];
  return new Promise((resolve) => {
    const log = join(OUT, `${n}.log`);
    const child = spawn("npx", args, { stdio: ["ignore", "pipe", "pipe"] });
    const out = [];
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => out.push(chunk));
    child.on("close", (code) => {
      writeFileSync(log, Buffer.concat(out));
      console.log(
        `Run ${n}: ${code === 0 ? "done" : `exited ${code}, as a test failed; its coverage still counts (${log})`}`,
      );
      resolve();
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { runs, atOnce } = parseTiming(process.argv.slice(2));
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  console.log(`Running every test ${runs} times, ${atOnce} at once…`);
  for (let n = 1; n <= runs; n += atOnce) {
    const batch = [];
    for (let m = n; m < n + atOnce && m <= runs; m++) batch.push(run(m, join(OUT, String(m))));
    await Promise.all(batch);
  }
  const reports = [];
  for (let n = 1; n <= runs; n++) {
    try {
      reports.push(JSON.parse(readFileSync(join(OUT, String(n), "coverage-final.json"), "utf8")));
    } catch {
      console.log(`Run ${n} wrote no coverage, so it's left out.`);
    }
  }
  const found = unsteady(reports, process.cwd());
  const text =
    found.length > 0
      ? `Hits that differ between ${reports.length} runs:\n${found.join("\n")}`
      : `Every count was the same in ${reports.length} runs, or never fewer than three.`;
  writeFileSync(join(OUT, "unsteady.txt"), `${text}\n`);
  console.log(`\n${text}`);
}
