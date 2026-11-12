#!/usr/bin/env node
// The storyboard review (docs/testing.md): runs the suite with screenshots,
// on both viewports, on this branch, and opens the page that pairs every
// frame with main's. Main is where this branch started from: the merge base
// of origin/main and HEAD, as a pull request compares. Nothing is fetched;
// origin/main is as last fetched.
//
//   npm run storyboard                      # against main, both viewports, open the page
//   npm run storyboard -- --no-main         # this branch alone: frames without a comparison
//   npm run storyboard -- --main=<ref>      # against where this branch left another one
//   npm run storyboard -- --desktop         # or --phone: one viewport
//   npm run storyboard -- --no-open         # leave the page closed (an agent reads storyboard.json)
//   npm run storyboard -- --paths           # print each frame's caption and picture, to open one directly
//   npm run storyboard -- --changed         # print only the frames that changed against main (storyboard-changed.mjs)
//   npm run storyboard -- --full            # every flow, not just those a change since their last run reaches (below)
//   npm run storyboard -- --plan            # say which flows a review would run, and why, and run none
//   npm run storyboard -- --server=URL      # a server you started for this branch (default: Playwright builds one on this checkout's port)
//   npm run storyboard -- --fresh-main      # run main again even if its frames are kept (below)
//   npm run storyboard -- --only-main       # no review: just keep main's frames, for the reviews to come
//   npm run storyboard -- --this-suite-on-main   # main's frames from this branch's suite, not main's own (below)
//   npm run storyboard -- --main-server=URL # the same, on a server you started for main
//   npm run storyboard -- staff-login -g login    # anything else goes to `playwright test`
//
// Each run has its own folder, test-results/storyboard/runs/<when>/, with
// every picture it shows in it (main's as hard links from the store), so a
// page you're looking at is never changed under you. When a run finishes,
// test-results/storyboard/latest points at it, and index.html beside it
// opens its page. The newest few runs are kept.
//
// A partial run (one that selects less than the whole suite: a section, -g,
// one viewport) starts from the latest run's frames, as hard links, and
// replaces the flows it runs: the review stays whole, each flow saying when
// it was shot. Flows gone from the suite aren't carried. A full run starts
// empty.
//
// Given no selection of its own, a review runs only the flows that might
// show something new (scripts/storyboard-reach.mjs, flowsToRun): those the
// files changed since each flow's last run can reach, those that failed, and
// those new to the suite. The rest are carried: from the latest run here, or
// from a tree the store keeps, whichever leaves fewer to run, so a new
// worktree's first review starts from main's frames. With nothing to run, it
// runs nothing. Such a review stands for every flow, as the gate's run of
// the flows does (scripts/gate.mjs), and its frames, carried ones too, are
// kept under its tree. A changed file the map can't place runs every flow,
// and the review says which file. `--full` runs every flow anyway.
//
// Main's frames are main's own: its suite, run on its build, in its own
// checkout (scripts/main-checkout.mjs). Nothing of this branch's goes into
// them, so they're kept under main's tree for every branch and worktree
// (scripts/storyboard-store.mjs), and main runs only the flows not kept
// yet. A full review keeps this branch's frames there too, under its own
// tree: they're main's once the branch has merged, if main's tree is then
// the one reviewed.
//
// `--this-suite-on-main` runs this branch's suite against main's build
// instead (scripts/serve-main.mjs, its output in the run's folder,
// main-server.log), for the flows that took pictures here. It's for a
// branch that changes how frames are pictured, where every frame would
// otherwise differ from main's own. Nothing of it is kept.
//
// A difference never fails; only this branch's checks do, and the exit code
// is theirs.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  linkSync,
  openSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { platform, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { LOCAL_URL, MAIN_OUTBOX_DIR, MAIN_URL, MAIN_WORKTREE } from "../tests/checkout.mjs";
import { writeStoryboard } from "../tests/storyboard/report/board.ts";
import { comparePngs } from "../tests/storyboard/report/frames.ts";
import { testServerUrl } from "./fresh-database.mjs";
import { checkOutMain, lockMain } from "./main-checkout.mjs";
import { describeChanged } from "./storyboard-changed.mjs";
import {
  carryable,
  carryFlows,
  flowKey,
  listedFlows,
  picturedFlows,
  runFolder,
  selectFlows,
} from "./storyboard-main.mjs";
import { changedCopyKeys, flowsToRun, reachContext, STAFF_COPY } from "./storyboard-reach.mjs";
import {
  carryKept,
  keepRuns,
  keptTrees,
  linkFlows,
  missingFlows,
  picturePath,
  picturesKept,
  pruneStore,
  ranElsewhere,
  readTree,
  storeDir,
  touchTree,
} from "./storyboard-store.mjs";

const DIR = "test-results/storyboard";
const RUNS = join(DIR, "runs");
const LATEST = join(DIR, "latest");
/** How the last full review went, and on which commit. */
const REVIEW_RECORD = "test-results/storyboard-review.json";
const RUNS_KEEP = 5;
/** How many trees' frames the store keeps (scripts/storyboard-store.mjs). */
const TREES_KEEP = 30;

const options = {
  main: "origin/main",
  open: true,
  paths: false,
  changed: false,
  projects: [],
  server: undefined,
  mainServer: undefined,
  freshMain: false,
  full: false,
  plan: false,
  onlyMain: false,
  thisSuite: false,
};
const passThrough = [];
for (const arg of process.argv.slice(2)) {
  if (arg === "--no-main") options.main = undefined;
  else if (arg.startsWith("--main=")) options.main = arg.slice("--main=".length);
  else if (arg === "--no-open") options.open = false;
  else if (arg === "--paths") options.paths = true;
  else if (arg === "--changed") options.changed = true;
  else if (arg === "--desktop" || arg === "--phone") options.projects.push(`--project=${arg.slice(2)}`);
  else if (arg.startsWith("--server=")) options.server = arg.slice("--server=".length);
  else if (arg.startsWith("--main-server=")) options.mainServer = arg.slice("--main-server=".length);
  else if (arg === "--fresh-main") options.freshMain = true;
  else if (arg === "--full") options.full = true;
  else if (arg === "--plan") options.plan = true;
  else if (arg === "--only-main") options.onlyMain = true;
  else if (arg === "--this-suite-on-main") options.thisSuite = true;
  else passThrough.push(arg);
}
// A server someone started for main is driven by this branch's suite: main's own runs on a build it makes itself.
if (options.mainServer) options.thisSuite = true;

// A signal ends the script through its exit handlers, which stop main's server and give back main's checkout.
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));

const runAt = new Date().toISOString();
const runDir = join(RUNS, runFolder(runAt));

/** Runs the suite against `url`, with screenshots, its frames going to runDir/<side>. Returns the exit code. */
function runSuite(side, url, extraEnv = {}, extraArgs = []) {
  console.log(`\n▶ Storyboard: ${side} (${url})\n`);
  const result = spawnSync(
    "npx",
    [
      "playwright",
      "test",
      `--output=test-results/playwright-storyboard-${side}`,
      ...options.projects,
      ...passThrough,
      ...extraArgs,
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        LOCAL_URL: url,
        STORYBOARD_SHOTS: "1",
        STORYBOARD_DIR: runDir,
        STORYBOARD_SIDE: side,
        STORYBOARD_RUN_AT: runAt,
        ...extraEnv,
      },
    },
  );
  return result.status ?? 1;
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, data) => {
  // Removed first: in a carried run it may be a hard link to the last run's.
  rmSync(file, { force: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
};

/** The frames kept by tree, in the main checkout, which holds the repository: every worktree's reviews share them. */
const STORE = storeDir(dirname(git("rev-parse", "--path-format=absolute", "--git-common-dir")));

/** Copies a folder as hard links: instant, and no extra space. */
function linkTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) linkTree(join(from, entry.name), join(to, entry.name));
    else linkSync(join(from, entry.name), join(to, entry.name));
  }
}

/**
 * The flows `playwright test --list` gives in `cwd`, by key (listedFlows): nothing is built. The
 * review's, with every flow on both viewports; with `shots` "0", the gate's, the phone's only those tagged.
 */
function listFlows(args, cwd = process.cwd(), env = process.env, shots = "1") {
  const result = spawnSync("npx", ["playwright", "test", "--list", "--reporter=json", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...env, STORYBOARD_SHOTS: shots },
  });
  if (result.status !== 0) throw new Error(`Couldn't list the flows in ${cwd}:\n${result.stderr}`);
  return listedFlows(JSON.parse(result.stdout));
}

/**
 * The hash of this checkout's tree as it is now, with what's uncommitted
 * and untracked: what a run of the suite here pictures.
 */
function workingTree() {
  const dir = mkdtempSync(join(tmpdir(), "pauseai-storyboard-index-"));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(dir, "index") };
    // From the checkout's own index, so git reads only the files that have changed.
    copyFileSync(git("rev-parse", "--path-format=absolute", "--git-path", "index"), env.GIT_INDEX_FILE);
    execFileSync("git", ["add", "--all"], { env });
    return execFileSync("git", ["write-tree"], { env, encoding: "utf8" }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** `fn`, asked once for each set of arguments. */
function once(fn) {
  const answers = new Map();
  return (...args) => {
    const key = args.join(" ");
    if (!answers.has(key)) answers.set(key, fn(...args));
    return answers.get(key);
  };
}

/** Whether git has the tree `tree`: one written by a run in any checkout, until git prunes it. */
const knownTree = once((tree) => spawnSync("git", ["cat-file", "-e", `${tree}^{tree}`]).status === 0);

/** The files that differ between two trees, or undefined if git no longer has `from`. */
const changedBetween = once((from, to) =>
  knownTree(from) ? git("diff", "--no-renames", "--name-only", from, to).split("\n").filter(Boolean) : undefined,
);

/** The keys of staffCopy that differ between two trees, if its file does (changedCopyKeys). */
const copyKeysBetween = once((from, to) => {
  if (!changedBetween(from, to)?.includes(STAFF_COPY)) return undefined;
  const show = (at) =>
    spawnSync("git", ["show", `${at}:${STAFF_COPY}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stdout;
  return changedCopyKeys(git("diff", "-U0", from, to, "--", STAFF_COPY), show(from), show(to));
});

/** Each tree the store keeps, but `except`, as flows to carry from: those that passed and whose pictures are there. */
function keptSources(except) {
  return keptTrees(STORE)
    .filter((tree) => tree !== except)
    .map((tree) => {
      const kept = readTree(STORE, tree);
      const runs = kept.frames
        .filter((run) => run.status === "passed" && picturesKept(STORE, run))
        .map((run) => ({ ...run, key: flowKey(run) }));
      return { tree, kept, runs };
    })
    .filter((source) => source.runs.length > 0);
}

/**
 * Of `sources`, each some flows to carry from (`runs`), the one that leaves
 * fewest of `suite` (keys) to run on `tree` (flowsToRun, worked out on the
 * checkout of `context`), the first of them on a tie: what flowsToRun
 * returns, and its `source`. Undefined with no sources.
 */
function nearest(sources, suiteKeys, tree, context, phoneTagged) {
  let best;
  for (const source of sources) {
    const chosen = flowsToRun({
      suite: suiteKeys,
      carried: source.runs,
      phoneTagged,
      context,
      changedSince: (at) => changedBetween(at, tree),
      copyKeysSince: (at) => copyKeysBetween(at, tree),
    });
    if (!best || chosen.run.size < best.run.size) best = { ...chosen, source };
  }
  return best;
}

/**
 * The flows this review runs, and where the rest are carried from (nearest):
 * the latest run here, or a tree the store keeps. Undefined to run them all,
 * with nothing to carry from.
 */
function chooseFlows() {
  const sources = [];
  const latest = join(LATEST, "branch", "frames.json");
  if (existsSync(latest))
    sources.push({ latest: true, runs: readJson(latest).frames.map((run) => ({ ...run, key: flowKey(run) })) });
  sources.push(...keptSources());
  if (sources.length === 0) return undefined;
  const phoneTagged = new Set([...listFlows(["--project=phone"], process.cwd(), process.env, "0").keys()]);
  const best = nearest(sources, new Set(suite.keys()), treeBefore, reachContext(process.cwd()), phoneTagged);
  // Every flow, and no file to say why: a run of the whole suite, as with nothing to carry from.
  return best.run.size === suite.size && best.unknown.length === 0 ? undefined : best;
}

/**
 * Carries into main's `tree` the flows of `missing` (keys) that the nearest
 * kept tree can give (nearest, worked out on main's checkout). Returns the
 * flows main still has to run, and the tree carried from, if any was.
 */
function carryFromNearest(tree, missing) {
  const phoneTagged = new Set([...listFlows(["--project=phone"], MAIN_WORKTREE, mainEnv(), "0").keys()]);
  const best = nearest(keptSources(tree), new Set(missing), tree, reachContext(MAIN_WORKTREE), phoneTagged);
  if (!best || best.run.size >= missing.length) return { run: missing };
  const wanted = new Set(missing);
  carryKept(
    STORE,
    tree,
    best.source.runs.filter((run) => wanted.has(run.key) && !best.run.has(run.key)).map(withoutKey),
  );
  return { run: [...best.run], from: best.source.tree };
}

/** A flow without the key it was given to be chosen by. */
function withoutKey(run) {
  const { key, ...rest } = run;
  void key;
  return rest;
}

/** What a review chosen by chooseFlows runs, and why. */
function planSummary(chosen, total) {
  const from = chosen.source.latest
    ? "the latest run"
    : `the kept tree ${chosen.source.tree.slice(0, 12)}, nearer than any run here`;
  if (chosen.unknown.length > 0)
    return [
      `Storyboard: every flow, ${total}, as what ${chosen.unknown.slice(0, 3).join(", ")} can change isn't known.`,
      `  Teach scripts/storyboard-reach.mjs what such a file reaches (EVERYTHING, NOTHING, or how it's read),`,
      `  or add a hit to investments/storyboard-review-speed.md naming the file.`,
    ].join("\n");
  if (chosen.run.size === 0)
    return `Storyboard: none of the ${total} flows to run: the ${chosen.changed.length} files changed since ${from} reach none.`;
  const why = [
    chosen.reached && `${chosen.reached} that the ${chosen.changed.length} files changed since they last ran can reach`,
    chosen.swept && `every desktop flow, as ${chosen.everything.slice(0, 3).join(", ")} changed`,
    chosen.fresh && `${chosen.fresh} new, failed or with no run to carry`,
  ].filter(Boolean);
  return `Storyboard: ${chosen.run.size} of ${total} flows: ${why.join("; ")}. The rest are carried from ${from}.`;
}

/**
 * The last review that stands for every flow, and the tree and commit it
 * pictured, for the gate and anything that shows whether this code has had
 * one (docs/testing.md, "The storyboard's progress").
 */
function recordReview(result) {
  mkdirSync(dirname(REVIEW_RECORD), { recursive: true });
  writeJson(REVIEW_RECORD, {
    commit: commitBefore,
    tree: treeBefore,
    main: base ?? null,
    endedAt: new Date().toISOString(),
    ...result,
  });
}

/** Drops all but the newest `keep` folders in `dir`, never `current`. */
function prune(dir, keep, current) {
  const folders = readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((path) => path !== current)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const folder of folders.slice(keep - 1)) rmSync(folder, { recursive: true, force: true });
}

/** Whether a server at `url` answers. */
async function answers(url) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Polls `url` until it answers, or `timeoutMs` has passed. */
async function waitFor(url, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined)
      throw new Error(`The server for ${url} exited with ${child.exitCode}: see main-server.log in ${runDir}`);
    if (await answers(url)) return;
    await new Promise((done) => setTimeout(done, 1000));
  }
  throw new Error(`${url} didn't answer within ${timeoutMs / 1000}s`);
}

// Main: where this branch left it.
const base = options.main !== undefined ? git("merge-base", options.main, "HEAD") : undefined;

/**
 * The environment for a command in main's checkout: this one's, but for
 * what points this checkout's suite at a build, as main's finds its own.
 */
function mainEnv() {
  const env = { ...process.env };
  for (const name of ["LOCAL_URL", "MAIN_URL", "OUTBOX_DIR", "STORYBOARD_ON_MAIN"]) delete env[name];
  // The same test Postgres as this branch's (`db-test`, say), which main's
  // checkout can't find in our .env.local.
  const testServer = testServerUrl();
  if (testServer) env.TEST_DATABASE_URL = testServer;
  return env;
}

/**
 * Runs main's own suite, in its checkout, for the flows on `lines`
 * (listedFlows), its frames going to `workDir`/main-run. Playwright builds
 * main and serves it there, on the port of that checkout's own path.
 */
async function runMainSuite(workDir, lines) {
  // Playwright would take whatever serves there for the build it has just been asked for.
  const url = execFileSync(
    "node",
    ["--input-type=module", "-e", "import('./tests/checkout.mjs').then((checkout) => console.log(checkout.OWN_URL))"],
    { cwd: MAIN_WORKTREE, env: mainEnv(), encoding: "utf8" },
  ).trim();
  if (await answers(url))
    throw new Error(
      `Something is already serving on ${url}, where main's checkout (${MAIN_WORKTREE}) serves. Stop it.`,
    );
  console.log(`\n▶ Storyboard: main's own suite (${MAIN_WORKTREE})\n`);
  const testList = join(resolve(workDir), "main-tests.txt");
  writeFileSync(testList, lines.join("\n"));
  spawnSync("npx", ["playwright", "test", `--test-list=${testList}`], {
    cwd: MAIN_WORKTREE,
    stdio: "inherit",
    env: {
      ...mainEnv(),
      STORYBOARD_SHOTS: "1",
      STORYBOARD_DIR: resolve(workDir),
      STORYBOARD_SIDE: "main-run",
      STORYBOARD_RUN_AT: runAt,
      STORYBOARD_TREE: git("rev-parse", `${base}^{tree}`),
      // This checkout's file, so how far main's run is shows where the review was started
      // (tests/storyboard/report/progress.ts).
      STORYBOARD_PROGRESS: resolve("test-results", "storyboard-progress.json"),
    },
  });
  rmSync(testList);
}

/**
 * Main's frames from the store, once it has every flow of `wanted` (keys)
 * that main has, or every flow of main's if `wanted` is undefined: main's
 * suite is listed, and run for the flows not kept, only if the store
 * doesn't have them. `workDir` is where a run of main puts its frames on
 * their way there. Returns main's tree and what's kept of it.
 */
async function mainFromStore(workDir, wanted) {
  const tree = git("rev-parse", `${base}^{tree}`);
  let kept = readTree(STORE, tree);
  let needed, missing;
  const lookAgain = () => {
    kept = readTree(STORE, tree);
    if (!kept.flows) return false;
    needed = wanted ? wanted.filter((key) => key in kept.flows) : Object.keys(kept.flows);
    missing = options.freshMain ? needed : missingFlows(STORE, kept, needed);
    return missing.length === 0;
  };
  if (lookAgain()) {
    console.log(`\n▶ Storyboard: main's frames of the ${needed.length} flows are kept; not running main.\n`);
    return { tree, kept };
  }
  const release = await lockMain();
  try {
    // Whoever had main's checkout may have been keeping these very frames.
    if (!lookAgain()) {
      checkOutMain(base);
      if (!kept.flows) {
        keepRuns(STORE, tree, workDir, [], Object.fromEntries(listFlows([], MAIN_WORKTREE, mainEnv())));
        lookAgain();
      }
      if (missing.length > 0 && !options.freshMain) {
        const near = carryFromNearest(tree, missing);
        if (near.from) {
          console.log(
            `\n▶ Storyboard: main's frames of ${missing.length - near.run.length} flows carried from the kept tree ${near.from.slice(0, 12)}, as the change from it can't reach them.\n`,
          );
          missing = near.run;
        }
      }
      if (missing.length > 0) {
        const why = options.freshMain ? "afresh, as asked" : "whose frames aren't kept";
        console.log(`\n▶ Storyboard: running main for ${missing.length} flows, ${why}.\n`);
        // The carried flows, to see whether running them afresh pictures them the same.
        const carriedBefore = new Map(
          readTree(STORE, tree)
            .frames.filter((run) => ranElsewhere(run, tree))
            .map((run) => [flowKey(run), run]),
        );
        await runMainSuite(
          workDir,
          missing.map((key) => kept.flows[key]),
        );
        const ran = join(workDir, "main-run");
        // Main may not have got as far as a flow: its build failing, say.
        if (existsSync(join(ran, "frames.json")))
          await reportMisses(
            carriedBefore,
            keepRuns(STORE, tree, workDir, readJson(join(ran, "frames.json")).frames),
            tree,
            workDir,
          );
        rmSync(ran, { recursive: true, force: true });
        kept = readTree(STORE, tree);
      }
    }
  } finally {
    release();
  }
  return { tree, kept };
}

/**
 * Says which of main's carried flows (`carriedBefore`) a run on their own
 * tree pictured differently, as the review counts a change (comparePngs, so
 * not by noise): changes the map of what a flow reaches missed
 * (scripts/storyboard-reach.mjs).
 */
async function reportMisses(carriedBefore, whole, tree, workDir) {
  if (carriedBefore.size === 0) return;
  const missed = [];
  for (const run of whole.frames) {
    const before = carriedBefore.get(flowKey(run));
    if (!before || ranElsewhere(run, tree)) continue;
    if (JSON.stringify(run.frames.map((f) => f.caption)) !== JSON.stringify(before.frames.map((f) => f.caption))) {
      missed.push(run);
      continue;
    }
    for (const [at, frame] of run.frames.entries()) {
      const was = before.frames[at].picture;
      if (frame.picture === was) continue;
      if (!frame.picture || !was) {
        missed.push(run);
        break;
      }
      const compared = await comparePngs(
        picturePath(STORE, frame.picture),
        picturePath(STORE, was),
        join(workDir, "carried-diff.png"),
      );
      if (!compared.noise) {
        missed.push(run);
        break;
      }
    }
  }
  if (missed.length === 0) {
    console.log(`\n▶ Storyboard: the ${carriedBefore.size} carried flows look the same run afresh.\n`);
    return;
  }
  console.log(
    `\n▶ Storyboard: carried flows that look different run afresh, which the map of what a flow reaches missed:`,
  );
  for (const run of missed) console.log(`  ${flowKey(run)}, carried from ${carriedBefore.get(flowKey(run)).tree}`);
}

/** Starts building and serving main on MAIN_URL, for this branch's suite, its output in the run's folder. */
async function startMain() {
  // Something already serving there would be taken for main: a server left from an earlier review.
  if (await answers(MAIN_URL))
    throw new Error(`Something is already serving on ${MAIN_URL}. Stop it, or pass --main-server=${MAIN_URL}.`);
  const port = new URL(MAIN_URL).port || "80";
  const log = join(runDir, "main-server.log");
  console.log(`\n▶ Storyboard: building main, ${git("log", "-1", "--format=%h %s", base)} (${log})\n`);
  const out = openSync(log, "w");
  // In a process group of its own, stopped whole (stopMain), so a build cut short doesn't run on.
  const server = spawn("node", ["scripts/serve-main.mjs", "--ref", base, "--port", port], {
    stdio: ["ignore", out, out],
    detached: true,
  });
  process.on("exit", () => stopMain(server));
  return server;
}

/** Stops main's server, or its build, and everything it started. */
async function stopMain(server) {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const exited = new Promise((done) => server.on("exit", done));
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    return;
  }
  await exited;
}

/**
 * Main's frames from this branch's suite, run against main's build for the
 * flows of `pictured` (keys), each on its line of `lines`. They stay in the
 * run's folder, main-run, where the reporter puts them.
 */
async function mainWithThisSuite(pictured, lines) {
  if (pictured.size === 0) return { frames: [] };
  console.log(
    `\n▶ Storyboard: running this branch's suite on main for the ${pictured.size} flows that took pictures.\n`,
  );
  const testList = join(runDir, "main-tests.txt");
  writeFileSync(testList, [...pictured].map((key) => lines.get(key)).join("\n"));
  let server;
  const release = options.mainServer ? () => {} : await lockMain();
  try {
    if (!options.mainServer) {
      server = await startMain();
      // The first run installs main's dependencies as well as building it.
      await waitFor(MAIN_URL, server, 900_000);
    }
    // Main may lack a flow, or a step of one: its failures are missing frames, not ours.
    // No tree for its flows: they're this branch's suite on main's build, which is neither's.
    runSuite("main-run", options.mainServer ?? MAIN_URL, { OUTBOX_DIR: MAIN_OUTBOX_DIR, STORYBOARD_ON_MAIN: "1" }, [
      `--test-list=${testList}`,
    ]);
  } finally {
    rmSync(testList, { force: true });
    await stopMain(server);
    release();
  }
  return selectFlows(readJson(join(runDir, "main-run", "frames.json")), pictured);
}

if (options.onlyMain) {
  if (base === undefined) throw new Error("--only-main keeps main's frames, so it needs a main: drop --no-main.");
  console.log(`\n▶ Storyboard: main is ${git("log", "-1", "--format=%h %s", base)}\n`);
  mkdirSync("test-results", { recursive: true });
  // Beside the store when it can be, so the pictures go into it as hard links.
  const workDir = mkdtempSync(join("test-results", "storyboard-only-main-"));
  try {
    const { tree } = await mainFromStore(workDir, undefined);
    touchTree(STORE, tree);
    pruneStore(STORE, TREES_KEEP);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
  process.exit(0);
}

// Folders nothing here reads, which a checkout may have from reviews laid out another way: one review
// straight in DIR, and main's frames kept in the checkout itself.
for (const old of ["branch", "main", "main-run", "diff", "storyboard.json", "../storyboard-main"]) {
  rmSync(join(DIR, old), { recursive: true, force: true });
}

// The whole suite, and what this run selects: a run is partial when it leaves
// some of the suite out, whatever the arguments that did it.
const suite = listFlows([]);
const treeBefore = workingTree();
const commitBefore = git("rev-parse", "HEAD");
const chosen = options.full || options.projects.length > 0 || passThrough.length > 0 ? undefined : chooseFlows();
if (options.plan) {
  if (!chosen) {
    console.log(
      `Storyboard: every flow, ${suite.size}: ${options.full ? "--full" : "there's no run to carry any from"}.`,
    );
  } else {
    console.log(planSummary(chosen, suite.size));
    for (const key of [...chosen.run].sort()) console.log(`  ${key}`);
  }
  process.exit(0);
}
/** Whether the review has chosen its flows and found none to run: it's then every flow carried, beside main as it is now. */
const nothing = chosen?.run.size === 0;
// What this run selects of the suite: it's partial when it leaves some out, whatever did it.
let wanted;
if (chosen) {
  console.log(`\n▶ ${planSummary(chosen, suite.size)}${nothing ? "" : " --full runs every one."}\n`);
  wanted = new Map([...suite].filter(([key]) => chosen.run.has(key)));
  if (!nothing) {
    const testList = join(mkdtempSync(join(tmpdir(), "pauseai-storyboard-")), "tests.txt");
    writeFileSync(testList, [...wanted.values()].join("\n"));
    passThrough.push(`--test-list=${testList}`);
  }
} else {
  wanted = listFlows([...options.projects, ...passThrough]);
}
const partial = [...suite.keys()].some((key) => !wanted.has(key));
// Main's own frames, from the store: not with --no-main, nor when this branch's suite makes main's.
const fromStore = options.main !== undefined && !options.thisSuite;

mkdirSync(runDir, { recursive: true });
const branchFrames = join(runDir, "branch", "frames.json");
const mainFrames = join(runDir, "main", "frames.json");
/** A tree the store keeps, when the review chose to carry from it and not from the latest run. */
const seed = chosen && !chosen.source.latest ? chosen.source : undefined;
const carried = !seed && partial && existsSync(join(LATEST, "branch")) ? LATEST : undefined;
if (carried) {
  if (!chosen) console.log(`\n▶ Storyboard: a partial run; the other flows are carried from the latest run.\n`);
  linkTree(join(carried, "branch"), join(runDir, "branch"));
  if (existsSync(join(carried, "main"))) linkTree(join(carried, "main"), join(runDir, "main"));
  // Main's pictures from a run with --this-suite-on-main, which stay in the run. Not into a run that
  // reads main's own from the store: its flows of those are dropped below.
  if (!fromStore && existsSync(join(carried, "main-run")))
    linkTree(join(carried, "main-run"), join(runDir, "main-run"));
  // Flows gone from the suite go from the review.
  writeJson(branchFrames, carryable(readJson(branchFrames), suite));
}
if (seed) {
  // The kept tree's flows that this run leaves alone, their pictures linked into the run's folder.
  const leftAlone = { has: (key) => suite.has(key) && !chosen.run.has(key) };
  mkdirSync(dirname(branchFrames), { recursive: true });
  writeJson(branchFrames, linkFlows(STORE, seed.kept, leftAlone, runDir, "branch"));
}
/** Main's flows carried from the latest run, for the flows this run doesn't replace. */
const carriedMain = carried && existsSync(mainFrames) ? readJson(mainFrames) : undefined;

const full = !partial && passThrough.length === 0;
// Whether the build is known to be of the code as it is: Playwright makes it for this run.
const builtHere = !options.server && !(await answers(LOCAL_URL));
if (!builtHere && !nothing)
  console.log(
    `\n▶ Storyboard: a server is already up at ${options.server ?? LOCAL_URL}. Its build may be older than the code, so this run's flows aren't recorded as this code's, and the next review runs them again. Stop it, and the review builds its own.\n`,
  );

// Each flow records the tree it ran on only when the build is that tree's.
const code = nothing
  ? 0
  : runSuite("branch", options.server ?? LOCAL_URL, { STORYBOARD_TREE: builtHere ? treeBefore : "" });

// A review that stands for every flow keeps them all under the tree they picture, the carried ones too, as each
// looks as it would on this tree: if the build was this tree's, and nothing in the checkout changed meanwhile.
if (existsSync(branchFrames) && (full || chosen) && (nothing || (builtHere && workingTree() === treeBefore))) {
  keepRuns(STORE, treeBefore, runDir, readJson(branchFrames).frames, Object.fromEntries(suite));
}

let mainError;
if (options.main === undefined || !existsSync(branchFrames)) {
  if (carriedMain) writeJson(mainFrames, carryable(carriedMain, suite));
} else {
  console.log(`\n▶ Storyboard: main is ${git("log", "-1", "--format=%h %s", base)}\n`);
  try {
    let selected, mainSuite, foreign;
    if (fromStore) {
      // Every flow of main's, but for a run narrowed by hand, which asks only for its own: a review that
      // chose its flows is every flow beside main as it is now, and main carries what it can.
      const { tree, kept } = await mainFromStore(runDir, partial && !chosen ? [...wanted.keys()] : undefined);
      touchTree(STORE, tree);
      // Every flow of main's that's kept, not just this run's: a partial run's carried flows are then
      // beside main as it is now. The pictures are linked into the run, so every path stays inside its
      // folder: latest/ works, and pruning the store never breaks a run.
      selected = linkFlows(STORE, kept, { has: () => true }, runDir);
      // Carried, for what isn't kept: only flows main still has, and none shot by this branch's suite.
      mainSuite = { has: (key) => key in kept.flows };
      foreign = "main-run/";
    } else {
      selected = await mainWithThisSuite(picturedFlows(readJson(branchFrames), wanted.keys()), wanted);
      mainSuite = suite;
    }
    mkdirSync(dirname(mainFrames), { recursive: true });
    // What board.ts pairs this branch's frames with: this run's flows, and a carried run's main frames for the rest.
    writeJson(mainFrames, carriedMain ? carryFlows(carryable(carriedMain, mainSuite, foreign), selected) : selected);
  } catch (error) {
    // The review of this branch's own frames is still written; the failure is reported at the end.
    mainError = error;
  }
}
pruneStore(STORE, TREES_KEEP);

if (existsSync(branchFrames)) {
  const { summary, withMain } = await writeStoryboard(runDir);
  console.log(
    `\nStoryboard: ${summary.frames} frames in ${summary.flows} flows, ${
      withMain ? `${summary.changed} changed against main` : "no run of main to compare with"
    }${summary.failed ? `, ${summary.failed} failed` : ""}${
      summary.mainFailed ? `, ${summary.mainFailed} failed on main` : ""
    }. ${join(runDir, "index.html")}\n`,
  );
  // A review that stands for every flow: run whole, or of every flow that might show something new.
  if (full || chosen) {
    recordReview({
      complete: true,
      full,
      run: basename(runDir),
      flows: summary.flows,
      failed: summary.failed,
      changed: withMain ? summary.changed : null,
    });
  }
}

const page = join(runDir, "index.html");
if (existsSync(page)) {
  // The run is whole: it becomes the latest, and the oldest go.
  const link = `${LATEST}.new`;
  rmSync(link, { force: true });
  symlinkSync(relative(DIR, runDir), link);
  renameSync(link, LATEST);
  // Opens this run's page by name, not through latest/, so a later run never changes it.
  writeFileSync(
    join(DIR, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>Storyboard</title><meta http-equiv="refresh" content="0; url=${relative(DIR, page)}">`,
  );
  // Which run is newest, for an open page of an older one to link to it
  // (tests/storyboard/report/page.ts). A script, as a page opened from disk can't fetch.
  writeFileSync(
    join(DIR, "latest.js"),
    `window.storyboardLatest = ${JSON.stringify({ run: basename(runDir), at: readJson(join(runDir, "storyboard.json")).generatedAt })};\n`,
  );
  prune(RUNS, RUNS_KEEP, runDir);
}

if (options.paths) {
  try {
    const { frames } = readJson(join(runDir, "storyboard.json"));
    for (const f of frames) {
      if (!f.branch) continue;
      console.log(`${f.viewport} › ${f.section} › ${f.flow} › ${f.index}. ${f.caption}`);
      console.log(`  ${resolve(runDir, f.branch)}${f.diff ? `\n  diff: ${resolve(runDir, f.diff)}` : ""}`);
    }
  } catch {
    console.log("No storyboard.json: the run wrote no frames.");
  }
}

if (options.changed && existsSync(join(runDir, "storyboard.json"))) {
  console.log(`\n${describeChanged(readJson(join(runDir, "storyboard.json")), realpathSync(runDir)).join("\n")}`);
}

if (mainError)
  console.error(`\nStoryboard: main's side failed, so nothing is compared with it. ${mainError.message}\n`);

// Said again at the end, where it's read: every flow ran because a changed file couldn't be placed.
if (chosen?.unknown.length) console.log(`\n${planSummary(chosen, suite.size)}\n`);

if (options.open && existsSync(page)) {
  const opener = platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
  spawn(opener, [resolve(page)], { stdio: "ignore", detached: true, shell: platform() === "win32" }).unref();
}
process.exit(code || (mainError ? 1 : 0));
