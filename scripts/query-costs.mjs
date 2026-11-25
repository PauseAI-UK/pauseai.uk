#!/usr/bin/env node
// The queries the tests run that the planner prices over JIT's threshold.
// CI's Postgres compiles such a query before running it, which can take
// seconds, so a test that runs one times out in CI and passes here in
// milliseconds (docs/code-structure.md, "How fast a query has to be").
//
//   npm run query-costs                         # every node test
//   npm run query-costs -- lib/supporters       # the tests Vitest picks by these
//
// It runs the tests on a Postgres of its own (scripts/own-postgres.mjs), in
// memory, with auto_explain loaded into the tests' connections through
// PGOPTIONS. It reads the plans from the server's log as they come,
// statements inside PL/pgSQL functions too, emptying the log as it goes, and
// lists each query over the threshold with the most it cost, highest first.
import { spawn } from "node:child_process";
import { readFileSync, truncateSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { postgresDir, startPostgres, stopPostgres } from "./own-postgres.mjs";

/** jit_above_cost's default: a query priced over it is compiled where Postgres has JIT. */
export const JIT_ABOVE_COST = 100_000;

/** What loads auto_explain into a connection, logging every plan as JSON, those inside functions too. */
export const AUTO_EXPLAIN = [
  "-c session_preload_libraries=auto_explain",
  "-c auto_explain.log_min_duration=0",
  "-c auto_explain.log_nested_statements=on",
  "-c auto_explain.log_format=json",
].join(" ");

/**
 * The queries in `log`, Postgres's log with auto_explain's plans in it,
 * priced over `threshold`: each query's text, whitespace run together, and
 * the most it cost, highest first.
 *
 * @returns {{ query: string, cost: number }[]}
 */
export function costlyQueries(log, threshold = JIT_ABOVE_COST) {
  const lines = log.split("\n");
  const most = new Map();
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].endsWith("plan:")) continue;
    // The plan follows, each of its lines indented with a tab.
    const body = [];
    while (lines[i + 1]?.startsWith("\t")) body.push(lines[++i].slice(1));
    let plan;
    try {
      plan = JSON.parse(body.join("\n"));
    } catch {
      continue;
    }
    const cost = plan.Plan?.["Total Cost"] ?? 0;
    if (cost <= threshold) continue;
    const query = String(plan["Query Text"]).replace(/\s+/g, " ").trim();
    most.set(query, Math.max(most.get(query) ?? 0, cost));
  }
  return [...most].map(([query, cost]) => ({ query, cost })).sort((a, b) => b.cost - a.cost);
}

/** The report of costlyQueries. */
export function costReport(found, threshold = JIT_ABOVE_COST) {
  if (found.length === 0) return `No query the tests ran is priced over ${threshold.toLocaleString("en-GB")}.`;
  return [
    `Priced over ${threshold.toLocaleString("en-GB")}, the most each cost:`,
    ...found.map(({ query, cost }) => `  ${Math.round(cost).toLocaleString("en-GB")}  ${query.slice(0, 300)}`),
  ].join("\n");
}

/**
 * Reads `file` as it grows, a whole number of lines at a time, handing each
 * to `take` and emptying the file, so a run's plans, which can come to
 * gigabytes, never pile up. Postgres appends to its log, so it writes on at
 * the start once the file is emptied. Returns what stops it, after a last read.
 */
export function drain(file, take, every = 1000) {
  let rest = "";
  const read = () => {
    const text = rest + readFileSync(file, "utf8");
    truncateSync(file);
    const end = text.lastIndexOf("\n");
    rest = text.slice(end + 1);
    if (end >= 0) take(text.slice(0, end + 1));
  };
  const timer = setInterval(read, every);
  return () => {
    clearInterval(timer);
    read();
    if (rest) take(rest);
  };
}

/**
 * Keeps, across the pieces of a log handed to `add`, each query's highest
 * cost. A plan split between two pieces is put back together, as each
 * piece ends at a line's end and a plan's lines run on, indented.
 */
export function costTracker(threshold = JIT_ABOVE_COST) {
  const most = new Map();
  let pending = "";
  const parse = (text) => {
    for (const { query, cost } of costlyQueries(text, threshold)) most.set(query, Math.max(most.get(query) ?? 0, cost));
  };
  return {
    add(text) {
      const all = pending + text;
      // Hold back from the last plan's start, which may go on in the next piece.
      const last = all.lastIndexOf("plan:\n");
      const cut = last === -1 ? all.length : all.lastIndexOf("\n", last) + 1;
      parse(all.slice(0, cut));
      pending = all.slice(cut);
    },
    found() {
      parse(pending);
      pending = "";
      return [...most].map(([query, cost]) => ({ query, cost })).sort((a, b) => b.cost - a.cost);
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // A server of its own, whose log it can empty as it reads it.
  const dir = postgresDir(process.pid);
  const started = startPostgres(dir);
  if (!("env" in started)) {
    console.error(`A Postgres of its own didn't start: ${started.problem}`);
    process.exit(1);
  }
  process.on("exit", () => stopPostgres(dir));
  const tracker = costTracker();
  const stop = drain(join(dir, "log"), (text) => tracker.add(text));
  const tests = spawn("npx", ["vitest", "run", "--project", "node", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, ...started.env, PGOPTIONS: AUTO_EXPLAIN },
  });
  const status = await new Promise((resolve) => tests.on("close", resolve));
  stop();
  console.log(`\n${costReport(tracker.found())}`);
  if (status !== 0) console.log("\nA test failed, so its queries may be missing.");
}
