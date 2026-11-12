#!/usr/bin/env node
// The CI gate, as one command (AGENTS.md, "The CI gate"):
//
//   npm run gate                      # the fast checks, then everything CI runs
//   npm run gate -- --fast            # the fast checks alone
//   npm run gate -- --no-storyboard   # everything but the storyboard
//
// The fast checks look at the files changed since this branch left
// origin/main, committed or not, and untracked ones: Prettier formats them,
// then the types, ESLint and Stylelint check them, and new migrations are
// checked to come after main's (scripts/migration-order.mjs). If one fails, the gate
// stops there. Then what .github/workflows/ci.yml runs, in parallel lanes as
// CI's jobs are: the types then the storyboard (CI's Storyboard job needs
// Types, and both write .next), the tests with coverage, the linters and the
// placeholder check one after another, and the backup Worker's package. Not
// `next build`: the storyboard builds the site. Nothing is fetched;
// origin/main is as last fetched.
//
// The storyboard is the review (`npm run storyboard`), where CI runs the
// flows without pictures: it runs the flows a change can reach, with
// pictures, and carries the rest from the last run, so the gate and the
// review are one run. CI runs every flow.
//
// Every command has a time limit and a log in tmp/gate/, emptied each run.
// While they run, a line a minute says which are still going and how long
// each one's log has been quiet. At the end, a table of each command's exit
// code (124 for one stopped at its limit), the end of each failed one's log,
// and the gate's own exit code: 1 if any failed.
//
// How each command stands is also in tmp/gate/status.json, for anything
// outside the gate that wants to show it, such as a terminal's status line
// (docs/testing.md, "The gate's status").
import { execFileSync, spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { constants } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const LOG_DIR = "tmp/gate";
const MINUTE = 60_000;
/** Files ESLint checks. */
const SCRIPT = /\.[cm]?[jt]sx?$/;

/** @param {string[]} args */
export function parseArgs(args) {
  const options = { fast: false, storyboard: true };
  for (const arg of args) {
    if (arg === "--fast") options.fast = true;
    else if (arg === "--no-storyboard") options.storyboard = false;
    else throw new Error(`Unknown option ${arg}. Usage: npm run gate [-- --fast] [--no-storyboard]`);
  }
  return options;
}

/**
 * The changed files that still exist, once each, from the output of
 * `git diff --name-only` and `git ls-files --others`.
 */
export function changedFiles(outputs, exists = existsSync) {
  const files = outputs.flatMap((output) => output.split("\n")).filter((file) => file && exists(file));
  return [...new Set(files)].sort();
}

/**
 * A command the gate runs: `id` names its log, `minutes` is its limit,
 * `required` skips the rest of its lane when it fails, and `skip` says why
 * it isn't run at all.
 *
 * @typedef {{ id: string, label: string, command: string, args: string[], minutes: number, cwd?: string, required?: boolean, skip?: string }} Step
 */

/** @returns {Step} */
const npx = (id, label, args, minutes, skip) => ({ id, label, command: "npx", args, minutes, skip });
/** @returns {Step} */
const npm = (id, args, minutes, extra = {}) => ({
  id,
  label: `${extra.cwd ? `(${extra.cwd}) ` : ""}npm ${args.join(" ")}`,
  command: "npm",
  args,
  minutes,
  ...extra,
});

/**
 * The fast checks on `files`, as phases run one after another, each a list
 * of lanes run at once: Prettier first, as it rewrites what the others read.
 *
 * @param {string[]} files
 * @returns {Step[][][]}
 */
export function fastPlan(files) {
  const scripts = files.filter((file) => SCRIPT.test(file));
  const css = files.filter((file) => file.endsWith(".css"));
  return [
    [
      [
        npx(
          "prettier",
          "npx prettier --write <changed files>",
          ["prettier", "--write", "--ignore-unknown", ...files],
          3,
          files.length ? undefined : "no changed files",
        ),
      ],
    ],
    [
      [npx("tsc", "npx tsc --noEmit", ["tsc", "--noEmit"], 5)],
      [
        npx(
          "eslint",
          "npx eslint <changed scripts>",
          ["eslint", "--max-warnings", "0", "--no-warn-ignored", ...scripts],
          5,
          scripts.length ? undefined : "no changed scripts",
        ),
      ],
      [
        npx(
          "stylelint",
          "npx stylelint <changed CSS>",
          ["stylelint", "--allow-empty-input", ...css],
          3,
          css.length ? undefined : "no changed CSS",
        ),
      ],
      [
        {
          id: "migration-order",
          label: "node scripts/migration-order.mjs --open-prs",
          command: "node",
          args: ["scripts/migration-order.mjs", "--open-prs"],
          minutes: 1,
        },
      ],
    ],
  ];
}

/**
 * What CI runs, as one phase of lanes run at once.
 *
 * @param {{ storyboard: boolean }} options
 * @returns {Step[][][]}
 */
export function slowPlan({ storyboard }) {
  return [
    [
      [
        npm("typecheck", ["run", "typecheck"], 5, { required: true }),
        ...(storyboard ? [npm("storyboard", ["run", "storyboard", "--", "--no-open"], 20)] : []),
      ],
      [npm("test", ["test"], 15)],
      [
        npm("lint", ["run", "lint"], 5),
        npm("lint-css", ["run", "lint:css"], 3),
        npm("lint-unused", ["run", "lint:unused"], 5),
        npm("format-check", ["run", "format:check"], 3),
        npm("placeholders", ["run", "placeholders"], 1),
      ],
      [
        npm("backup-install", ["ci", "--no-audit", "--no-fund"], 5, { cwd: "backup", required: true }),
        npm("backup-test", ["test"], 10, { cwd: "backup" }),
        npm("backup-typecheck", ["run", "typecheck"], 3, { cwd: "backup" }),
      ],
    ],
  ];
}

/** @param {number} ms */
export function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`;
}

/**
 * @typedef {{ step: Step, code: number | null, ms: number, log?: string, note?: string }} Result
 * `code` is null for a step that didn't run, and `note` says why.
 */

/** The table of results the gate ends with. @param {Result[]} results */
export function formatTable(results) {
  const rows = [
    ["Command", "Exit", "Time", "Log"],
    ...results.map(({ step, code, ms, log, note }) => [
      step.label,
      code === null ? "-" : String(code),
      code === null ? "-" : formatDuration(ms),
      [log, note].filter(Boolean).join(", "),
    ]),
  ];
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  return rows
    .map((row) =>
      row
        .map((cell, column) => cell.padEnd(widths[column]))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

/** The last `count` lines of a file. */
export function tail(file, count) {
  return readFileSync(file, "utf8").trimEnd().split("\n").slice(-count).join("\n");
}

/** The commands running now, for the heartbeat and to stop on Ctrl-C. */
const running = new Map();

/** Stops a command's process group, and kills it if it hasn't gone in ten seconds. */
function stop(child) {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    return;
  }
  setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // Gone already.
    }
  }, 10_000).unref();
}

/**
 * How a group of commands stands, from how each of them does: failed if one
 * has; else running while any is, or while some are done and others wait
 * their turn; passed once all have, or were skipped; waiting if none has
 * started.
 *
 * @param {State[]} states
 * @returns {"waiting" | "running" | "passed" | "failed"}
 */
export function groupState(states) {
  if (states.includes("failed")) return "failed";
  if (states.every((state) => state === "waiting")) return "waiting";
  if (states.every((state) => state === "passed" || state === "skipped")) return "passed";
  return "running";
}

/**
 * The group a command is in: the two long ones each their own, and the
 * rest, quick, together. The gate's storyboard is "flows": it checks that
 * every flow works, through the review (`npm run storyboard`).
 *
 * @param {string} id
 */
const groupOf = (id) => (id === "storyboard" ? "flows" : id === "test" ? "test" : "checks");

/**
 * Keeps `file` saying how each of `steps` stands, and each group of them
 * (`groups`: checks, test and flows, those the gate is running): every
 * step waiting to begin with, then as `set` is told, and `ended` once `end`
 * is called. `commit` is the one the gate started on, so a reader can tell
 * whether its result is of the code as it is now. `pid` is the gate's
 * process, so a reader can tell a gate that was killed, which never says it
 * ended, from one still going.
 *
 * @param {Step[]} steps
 * @param {string} commit
 */
export function statusWriter(steps, commit, file = join(LOG_DIR, "status.json")) {
  const startedAt = new Date().toISOString();
  /** @type {Record<string, State>} */
  const states = Object.fromEntries(steps.map((step) => [step.id, "waiting"]));
  let ended = false;
  // Written beside the file and moved over it, so a reader never sees half of one.
  const write = () => {
    const groups = {};
    for (const group of new Set(steps.map((step) => groupOf(step.id)))) {
      groups[group] = groupState(steps.filter((step) => groupOf(step.id) === group).map((step) => states[step.id]));
    }
    const status = {
      pid: process.pid,
      commit,
      startedAt,
      updatedAt: new Date().toISOString(),
      ended,
      groups,
      steps: states,
    };
    writeFileSync(`${file}.${process.pid}`, `${JSON.stringify(status)}\n`);
    renameSync(`${file}.${process.pid}`, file);
  };
  write();
  return {
    /** @param {Step} step @param {State} state */
    set(step, state) {
      states[step.id] = state;
      write();
    },
    end() {
      ended = true;
      write();
    },
  };
}

/**
 * Runs one step, its output to its log in `logDir`, in a process group of its
 * own so all it starts is stopped with it at its limit. `changed` is told as
 * it starts running, and how it ends: passed, failed or skipped.
 *
 * @param {Step} step
 * @returns {Promise<Result>}
 */
export function runStep(step, logDir = LOG_DIR, report = () => {}, changed = () => {}) {
  if (step.skip) {
    changed(step, "skipped");
    return Promise.resolve({ step, code: null, ms: 0, note: step.skip });
  }
  const log = join(logDir, `${step.id}.log`);
  const out = openSync(log, "w");
  const started = Date.now();
  report(`▶ ${step.label} (${log}, limit ${step.minutes}m)`);
  const child = spawn(step.command, step.args, { cwd: step.cwd, stdio: ["ignore", out, out], detached: true });
  closeSync(out);
  running.set(child, { step, log, started });
  changed(step, "running");
  return new Promise((resolve) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stop(child);
    }, step.minutes * MINUTE);
    const finish = (code, note) => {
      clearTimeout(timer);
      running.delete(child);
      const ms = Date.now() - started;
      report(`${code === 0 ? "✓" : "✗"} ${step.label}: ${code}${note ? `, ${note}` : ""}, ${formatDuration(ms)}`);
      changed(step, code === 0 ? "passed" : "failed");
      resolve({ step, code, ms, log, note });
    };
    child.on("error", (error) => finish(127, error.message));
    child.on("exit", (code, signal) => {
      if (timedOut) finish(124, `stopped at its limit of ${step.minutes}m`);
      else finish(code ?? 128 + constants.signals[signal]);
    });
  });
}

/**
 * Runs each phase's lanes at once, each lane's steps one after another, the
 * phases in turn. A lane stops at a failed required step, the rest of it
 * marked as skipped.
 *
 * @param {Step[][][]} phases
 * @returns {Promise<Result[]>}
 */
export async function runPlan(phases, logDir = LOG_DIR, report = () => {}, changed = () => {}) {
  const results = [];
  for (const lanes of phases) {
    const done = await Promise.all(
      lanes.map(async (lane) => {
        const laneResults = [];
        let failed;
        for (const step of lane) {
          if (failed) {
            changed(step, "skipped");
            laneResults.push({ step, code: null, ms: 0, note: `skipped: ${failed} failed` });
            continue;
          }
          const result = await runStep(step, logDir, report, changed);
          laneResults.push(result);
          if (step.required && result.code !== 0) failed = step.label;
        }
        return laneResults;
      }),
    );
    results.push(...done.flat());
  }
  return results;
}

/** Whether every step that ran passed. @param {Result[]} results */
export function passed(results) {
  return results.every(({ code }) => code === null || code === 0);
}

/** A line naming each command still running, how long it's taken and how long its log has been quiet. */
function heartbeat() {
  const now = Date.now();
  const lines = [...running.values()].map(({ step, log, started }) => {
    const quiet = now - statSync(log).mtimeMs;
    return `${step.label} ${formatDuration(now - started)}${quiet >= 2 * MINUTE ? ` (log quiet ${formatDuration(quiet)})` : ""}`;
  });
  if (lines.length) console.log(`… still running: ${lines.join("; ")}`);
}

async function main(args) {
  const options = parseArgs(args);
  const git = (...gitArgs) => execFileSync("git", gitArgs, { encoding: "utf8" });
  const base = git("merge-base", "origin/main", "HEAD").trim();
  const files = changedFiles([git("diff", "--name-only", base), git("ls-files", "--others", "--exclude-standard")]);
  rmSync(LOG_DIR, { recursive: true, force: true });
  mkdirSync(LOG_DIR, { recursive: true });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      for (const child of running.keys()) stop(child);
      process.exit(130);
    });
  }
  const beat = setInterval(heartbeat, MINUTE);

  const fast = fastPlan(files);
  const slow = options.fast ? [] : slowPlan(options);
  const status = statusWriter([...fast, ...slow].flat(2), git("rev-parse", "HEAD").trim());

  console.log(`Gate: the fast checks, on ${files.length} files changed since origin/main`);
  const results = await runPlan(fast, LOG_DIR, console.log, status.set);
  if (!options.fast && passed(results)) {
    console.log(`\nGate: what CI runs${options.storyboard ? "" : ", but the storyboard"}`);
    results.push(...(await runPlan(slow, LOG_DIR, console.log, status.set)));
  } else if (!options.fast) {
    console.log("\nGate: a fast check failed, so the rest didn't run.");
  }
  clearInterval(beat);
  status.end();

  for (const { step, code, log } of results) {
    if (code === null || code === 0) continue;
    console.log(`\n✗ ${step.label}, the end of ${log}:\n${tail(log, 30)}`);
  }
  console.log(`\n${formatTable(results)}\n`);
  const ok = passed(results);
  console.log(ok ? "Gate passed." : "Gate failed.");
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  });
}
