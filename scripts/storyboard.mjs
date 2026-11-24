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
//   npm run storyboard -- --full            # every flow, not just those this branch's change reaches (below)
//   npm run storyboard -- --plan            # say which flows a review would picture and run, and why, and run none
//   npm run storyboard -- --server=URL      # a server you started for this branch (default: Playwright builds one on this checkout's port)
//   npm run storyboard -- --fresh-main      # run main again even if its frames are kept (below)
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
// Given no selection of its own, a review pictures only the flows that the
// files this branch changes from main can reach, and those new to the suite
// (scripts/storyboard-reach.mjs, flowsReached), and its page shows only
// them. It gets main's frames of those flows first, running main for any
// not kept, then runs this branch's. A flow of them that nothing changed
// since the latest run here reaches is carried from that run, not run again
// (flowsToRun). With nothing to picture, it runs nothing. A changed file the
// map can't place pictures no flow, and the review says which file.
// `--full` runs every flow anyway. Checking that every flow still works is
// `npm run test:storyboard`'s, and main's CI's, not the review's.
//
// A run narrowed by hand (a section, -g, one viewport) starts from the
// latest run's frames, as hard links, and replaces the flows it runs, each
// flow saying when it was shot. Flows gone from the suite aren't carried.
//
// A review also runs a few flows the change doesn't reach (spotChecks), and
// compares each with main's frames of it, which it should look the same as.
// If one looks different, the map of what a change reaches has missed
// something: the review says so, and runs every flow.
//
// Main's frames are main's own: its suite, run on its build, in its own
// checkout (scripts/main-checkout.mjs). Nothing of this branch's goes into
// them, so they're kept under main's tree for every branch and worktree
// (scripts/storyboard-store.mjs), and main runs only the flows a review
// needs that aren't kept yet. A review keeps this branch's frames there
// too, under its own tree: they're main's once the branch has merged, if
// main's tree is then the one reviewed.
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
import { createHash } from "node:crypto";
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
import { serverEnv } from "./fresh-database.mjs";
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
import {
  flowsReached,
  flowsToRun,
  reachContext,
  readByNoFlow,
  spotCheckKeys,
  sqlWithoutComments,
} from "./storyboard-reach.mjs";
import {
  fillCarried,
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

/**
 * The environment that tells a run of the suite which of the gallery's frames
 * to carry and not picture (`carried`, flowsToRun's, by flow): a file of
 * them in `dir`, by caption and component (tests/storyboard/gallery.spec.ts).
 */
function carryEnv(dir, carried) {
  if (carried.size === 0) return {};
  const file = resolve(dir, "carried.json");
  const byFlow = [...carried].map(([key, frames]) => [key, frames.map(({ caption, file }) => ({ caption, file }))]);
  writeFileSync(file, JSON.stringify(Object.fromEntries(byFlow)));
  return { STORYBOARD_CARRY: file };
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, data) => {
  mkdirSync(dirname(file), { recursive: true });
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

/**
 * The files that differ between two trees, and those of them only one has
 * (added or deleted), or undefined if git no longer has `from`. A SQL file
 * changed only in its comments isn't one: Postgres runs the same.
 */
const changedBetween = once((from, to) => {
  if (!knownTree(from)) return undefined;
  const lines = git("diff", "--no-renames", "--name-status", "-z", from, to).split("\0");
  const files = [];
  const addedOrDeleted = [];
  const sameSql = (path) =>
    sqlWithoutComments(git("show", `${from}:${path}`)) === sqlWithoutComments(git("show", `${to}:${path}`));
  // With -z, a status and then its path, each ended by a NUL.
  for (let at = 0; at + 1 < lines.length; at += 2) {
    if (lines[at] === "M" && lines[at + 1].endsWith(".sql") && sameSql(lines[at + 1])) continue;
    files.push(lines[at + 1]);
    if (lines[at] === "A" || lines[at] === "D") addedOrDeleted.push(lines[at + 1]);
  }
  return { files, addedOrDeleted };
});

/**
 * What a flow ran on that its tree doesn't hold: the dependencies installed
 * in the checkout at `dir` (npm's own record of them) and the Node running
 * them. A flow that ran on others is run again (flowsToRun).
 */
function setupOf(dir) {
  const installed = join(dir, "node_modules", ".package-lock.json");
  return createHash("sha256")
    .update(process.version)
    .update(existsSync(installed) ? readFileSync(installed) : "")
    .digest("hex")
    .slice(0, 16);
}

/** A flow's run, with the key it's chosen by. */
const withKey = (run) => ({ ...run, key: flowKey(run) });

/** What the store keeps of `tree`, as flows to carry from: those that passed and whose pictures are there. */
function keptSource(tree) {
  const kept = readTree(STORE, tree);
  const runs = kept.frames.filter((run) => run.status === "passed" && picturesKept(STORE, run)).map(withKey);
  return { tree, kept, runs };
}

/** The latest run here, as flows to carry from, if there is one. */
function latestSources() {
  const latest = join(LATEST, "branch", "frames.json");
  return existsSync(latest) ? [{ latest: true, runs: readJson(latest).frames.map(withKey) }] : [];
}

/**
 * The keys of the flows `list` gives, as a set flowsToRun can ask of, listed
 * only once it asks: only a change that reaches every flow needs the phone's
 * flows of CI's run, and listing them starts Playwright, which takes seconds.
 */
function whenAsked(list) {
  let keys;
  return { has: (key) => (keys ??= new Set(list().keys())).has(key) };
}

/** How many frames of the gallery's flows a choice of flows (flowsToRun's) carries, and so doesn't picture. */
const framesCarried = (chosen) => [...chosen.carried.values()].reduce((sum, frames) => sum + frames.length, 0);

/**
 * Of `sources`, each some flows to carry from (`runs`), the one that leaves
 * fewest of `suite` (keys) to run on `tree` (flowsToRun, worked out on the
 * checkout of `context`): what flowsToRun returns, and its `source`. On a
 * tie, the one that leaves fewest of the gallery's frames to picture, then
 * the first. Undefined with no sources.
 */
function nearest(sources, suiteKeys, tree, context, phoneTagged) {
  let best;
  for (const source of sources) {
    const chosen = flowsToRun({
      suite: suiteKeys,
      carried: source.runs,
      phoneTagged,
      context,
      setup: setupOf(context.root),
      changedSince: (at) => changedBetween(at, tree),
    });
    const fewer = best && chosen.run.size - best.run.size;
    if (!best || fewer < 0 || (fewer === 0 && framesCarried(chosen) > framesCarried(best)))
      best = { ...chosen, source };
    // None to run: no source can leave fewer, and the first wins a tie.
    if (best.run.size === 0) break;
  }
  return best;
}

/**
 * The flows a review pictures: those the files this branch changes from main
 * can reach (flowsReached). What each flow opened is read from whichever
 * run of it comes first: main's own, the latest run here, or any tree the
 * store keeps.
 */
function reachedFromMain() {
  const records = [
    ...readTree(STORE, sinceTree).frames,
    ...latestSources().flatMap((source) => source.runs),
    ...keptTrees(STORE)
      .filter((tree) => tree !== sinceTree)
      .flatMap((tree) => readTree(STORE, tree).frames),
  ];
  return flowsReached({
    suite: new Set(suite.keys()),
    records: records.map(withKey),
    phoneTagged,
    context,
    changed: changedBetween(sinceTree, treeBefore),
  });
}

/**
 * Of the flows a review pictures (`keys`), those it runs, and where the rest
 * are carried from (nearest): the latest run here, for a flow nothing
 * changed since reaches, or main's own frames, which the frames of a gallery
 * flow that this branch's change doesn't reach look like. With nothing to
 * carry from, it runs them all.
 */
function chooseRuns(keys) {
  // Main's own frames stand for this branch's only beside main's own, not beside this suite's run on main.
  const main = options.thisSuite ? [] : [keptSource(sinceTree)].filter((source) => source.runs.length > 0);
  const best = nearest([...latestSources(), ...main], keys, treeBefore, context, phoneTagged);
  return best ?? { run: new Set(keys), carried: new Map() };
}

/**
 * A few flows a review runs though this branch's change doesn't reach them,
 * or reaches only some frames of them (a gallery flow): `reached` is
 * flowsReached's. Chosen by main's tree (spotCheckKeys), so every review of a
 * branch checks the same ones, whose frames on main are then kept.
 */
function spotKeys(reached) {
  return spotCheckKeys(
    [...suite.keys()].filter((key) => !reached.run.has(key) || reached.carried.has(key)),
    sinceTree,
  );
}

/**
 * What each of the spot checks (`keys`, spotKeys) is checked against, its
 * frames' pictures by their files. A flow the change doesn't reach: main's
 * frames of it, which it should look the same as. A gallery flow the review
 * would have pictured in part (`chosen`, chooseRuns's), which it runs
 * whole: the frames it would have carried. One with neither isn't checked,
 * as a flow main hasn't passed.
 */
function spotChecks(keys, reached, chosen) {
  const main = new Map(keptSource(sinceTree).runs.map((run) => [run.key, run]));
  return keys.flatMap((key) => {
    const part = chosen.carried.get(key);
    if (part) {
      const pictureOf = carriedPicture(chosen.source);
      const frames = part.map((frame) => ({
        caption: frame.caption,
        file: frame.png || frame.picture ? pictureOf(frame) : undefined,
      }));
      return [{ key, frames, whole: false }];
    }
    const run = main.get(key);
    if (reached.run.has(key) || !run) return [];
    const frames = run.frames.map((frame) => ({
      caption: frame.caption,
      file: frame.picture ? picturePath(STORE, frame.picture) : undefined,
    }));
    return [{ key, frames, whole: true }];
  });
}

/** Where a frame of the run a review carries from (`source`, chosen's) has its picture: the latest run's folder, or the store. */
function carriedPicture(source) {
  const latest = source.latest && realpathSync(LATEST);
  return (frame) => (latest ? join(latest, frame.png) : picturePath(STORE, frame.picture));
}

/**
 * The spot checks (spotChecks) that failed: flows that didn't pass, or have
 * other frames than the ones they're checked against (some of them, in
 * order, for a gallery flow the review would have pictured in part), or a
 * picture that differs past the review's noise (comparePngs).
 */
async function spotMisses(spot) {
  const ran = new Map(readJson(branchFrames).frames.map((run) => [flowKey(run), run]));
  const missed = [];
  for (const { key, frames: carried, whole } of spot) {
    const run = ran.get(key);
    // Not run, as when the build failed: nothing to check.
    if (!run) continue;
    let same = run.status === "passed" && (!whole || run.frames.length === carried.length);
    // Each carried frame with the one run again that it stands for: the one in its place, or, for a flow the
    // review would have pictured in part, the next with its caption.
    let next = 0;
    for (const [at, was] of carried.entries()) {
      if (!same) break;
      const found = whole ? at : run.frames.findIndex((frame, i) => i >= next && frame.caption === was.caption);
      next = found + 1;
      const now = run.frames[found];
      same = now !== undefined && now.caption === was.caption && Boolean(now.png) === Boolean(was.file);
      if (same && now.png) {
        const compared = await comparePngs(join(runDir, now.png), was.file, join(runDir, "spot-check.png"));
        same = compared.mismatch === 0 || compared.noise;
      }
    }
    if (!same) missed.push(key);
  }
  rmSync(join(runDir, "spot-check.png"), { force: true });
  return missed;
}

/** What to do about flows the map missed, said where it's found and again at the end. */
function missedSummary(missed, changed) {
  return [
    `Storyboard: ${missed.length} of the flows this branch's change shouldn't reach look different from main's:`,
    ...missed.map((key) => `  ${key}`),
    `  So the map of what a change reaches (scripts/storyboard-reach.mjs) missed something in the ${changed.length} files changed,`,
    `  or a frame of theirs differs from run to run. So every flow is run. Find which, and fix the map or the frame;`,
    `  or add a hit to investments/storyboard-review-speed.md naming the flows.`,
  ].join("\n");
}

/** A flow a review runs (`chosen`, chooseRuns's), and, for a gallery flow it pictures in part, how much of it. */
function planLine(chosen, key) {
  const carried = chosen.carried.get(key);
  if (!carried) return key;
  const of = chosen.source.runs.find((run) => run.key === key).frames.length;
  return `${key}, ${of - carried.length} of ${of} sections`;
}

/** Which flows a review pictures (`reached`, flowsReached's), and why. */
function planSummary(reached, total) {
  const plan = flowsSummary(reached, total);
  if (reached.unknown.length === 0) return plan;
  return [
    plan,
    `  What ${reached.unknown.slice(0, 3).join(", ")} can change isn't known, so it reaches no flow but the spot checks.`,
    `  Teach scripts/storyboard-reach.mjs what such a file reaches (EVERYTHING, SET_UP, NOTHING, or how it's read),`,
    `  or add a hit to investments/storyboard-review-speed.md naming the file.`,
  ].join("\n");
}

/** Which flows a review pictures, and why: planSummary's first line. */
function flowsSummary(reached, total) {
  const count = reached.changed.length;
  const files = `the ${count} ${count === 1 ? "file" : "files"} this branch changes from main`;
  if (reached.run.size === 0 && reached.changed.length === 0)
    return `Storyboard: none of the ${total} flows: this branch changes nothing from main.`;
  if (reached.run.size === 0) return `Storyboard: none of the ${total} flows: none is reached by ${files}.`;
  if (reached.fresh === total)
    return `Storyboard: every flow, ${total}: none has a record of what it opens, as each was recorded another way, or not at all.`;
  if (reached.run.size === total) return `Storyboard: every flow, ${total}: all are reached by ${files}.`;
  const why = [
    reached.reached && `${reached.reached} reached by ${files}`,
    reached.swept && `every desktop flow, as ${reached.everything.slice(0, 3).join(", ")} changed`,
    reached.fresh && `${reached.fresh} new, or with no record of what they open`,
  ].filter(Boolean);
  return `Storyboard: ${reached.run.size} of ${total} flows: ${why.join("; ")}. The rest aren't pictured.`;
}

/** Which of the `pictured` flows a review runs (`chosen`, chooseRuns's), if not all: the rest it carries, and where from. */
function runsSummary(chosen, pictured) {
  if (chosen.run.size === pictured && chosen.carried.size === 0) return undefined;
  const from = chosen.source.latest ? "the latest run here" : "main's frames";
  const inPart = chosen.carried.size > 0 ? `, ${chosen.carried.size} of them gallery flows in part` : "";
  if (chosen.run.size === pictured)
    return `Storyboard: all ${pictured} to run${inPart}, the rest of each of those carried from ${from}.`;
  return `Storyboard: ${chosen.run.size} of those ${pictured} to run${inPart}. The rest are carried from ${from}, as nothing changed since reaches them.`;
}

/**
 * The last review of every flow, or of the flows it chose itself, and the
 * tree and commit it pictured, for the gate and anything that shows whether
 * this code has had one (docs/testing.md, "The storyboard's progress").
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
 * Where this branch left main, for choosing a review's flows by what the
 * branch changes: the same, and with --no-main where it left origin/main,
 * if this checkout has one.
 */
const since =
  base ?? (spawnSync("git", ["merge-base", "origin/main", "HEAD"], { encoding: "utf8" }).stdout.trim() || undefined);
const sinceTree = since && git("rev-parse", `${since}^{tree}`);

/**
 * The environment for a command in main's checkout: this one's, but for
 * what points this checkout's suite at a build, as main's finds its own.
 */
function mainEnv() {
  const env = { ...process.env };
  for (const name of ["LOCAL_URL", "MAIN_URL", "OUTBOX_DIR", "STORYBOARD_ON_MAIN"]) delete env[name];
  // The same Postgres as this branch's, which main's checkout wouldn't find
  // by itself: this checkout's own (main's has its own), or `db-test`,
  // say, from our .env.local.
  return { ...env, ...serverEnv() };
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
      STORYBOARD_SETUP: setupOf(MAIN_WORKTREE),
      // This checkout's file, so how far main's run is shows where the review was started
      // (tests/storyboard/report/progress.ts).
      STORYBOARD_PROGRESS: resolve("test-results", "storyboard-progress.json"),
    },
  });
  rmSync(testList);
}

/**
 * Main's frames from the store, once it has the flows of main's that
 * `wants` picks from them (keys), or every flow of main's if `wants` is
 * undefined: main's suite is listed, and run for the flows not kept, only
 * if the store doesn't have them. `workDir` is where a run of main puts its
 * frames on their way there. Returns main's tree and what's kept of it.
 */
async function mainFromStore(workDir, wants) {
  const tree = git("rev-parse", `${base}^{tree}`);
  let kept = readTree(STORE, tree);
  let needed, missing;
  const lookAgain = () => {
    kept = readTree(STORE, tree);
    if (!kept.flows) return false;
    needed = wants ? wants(Object.keys(kept.flows)) : Object.keys(kept.flows);
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
  const missed = [];
  let again = 0;
  for (const run of whole.frames) {
    const before = carriedBefore.get(flowKey(run));
    if (!before || ranElsewhere(run, tree)) continue;
    again++;
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
  if (again === 0) return;
  if (missed.length === 0) {
    console.log(`\n▶ Storyboard: the ${again} flows that had been carried look the same run afresh.\n`);
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
// Main's own frames, from the store: not with --no-main, nor when this branch's suite makes main's.
const fromStore = options.main !== undefined && !options.thisSuite;
/**
 * Whether the review chooses its flows, by what this branch changes from main: unless it's told which to run,
 * or to run them all, or there's no main to tell the changes from.
 */
const choosing = !options.full && options.projects.length === 0 && passThrough.length === 0 && since !== undefined;
/** What this checkout's flows reach, read from its code, and the phone's flows of CI's run: for choosing by. */
const context = choosing ? reachContext(process.cwd()) : undefined;
const phoneTagged = whenAsked(() => listFlows(["--project=phone"], process.cwd(), process.env, "0"));
/** The flows the review pictures, when it chooses them (reachedFromMain): its page shows only these. */
const reached = choosing ? reachedFromMain() : undefined;
// Flows the change doesn't reach that the review runs anyway, to check the map against main's frames
// (spotKeys): none without main's own frames, or when nothing changed but files no flow reads, as docs and
// unit tests.
const spot = reached && fromStore && reached.changed.some((file) => !readByNoFlow(file)) ? spotKeys(reached) : [];
if (options.plan) {
  if (!reached) {
    const all = `every flow, ${suite.size}`;
    const why = options.full
      ? `${all}: --full`
      : since === undefined
        ? `${all}: there's no main to tell this branch's changes from`
        : "the flows it's told to, as a run narrowed by hand does";
    console.log(`Storyboard: ${why}.`);
  } else {
    console.log(planSummary(reached, suite.size));
    // By what's kept now: main's frames of the flows, once a review has them, may leave less of a gallery flow to picture.
    const chosen = chooseRuns(new Set(reached.run));
    const runs = runsSummary(chosen, reached.run.size);
    if (runs) console.log(runs);
    for (const key of [...chosen.run].sort()) console.log(`  ${planLine(chosen, key)}`);
    if (spot.length > 0)
      console.log(`Storyboard: and ${spot.length} flows the change doesn't reach, to check they look as main's do.`);
  }
  process.exit(0);
}

mkdirSync(runDir, { recursive: true });
const branchFrames = join(runDir, "branch", "frames.json");
const mainFrames = join(runDir, "main", "frames.json");
let mainError;

/**
 * Main's side of the page, from the store: the flows of main's that `shown` says (of a key), once main has run
 * those of them `wants` picks that aren't kept (mainFromStore). `carriedMain`, a carried run's main frames,
 * fills in for what isn't kept. A failure waits for the end: the review of this branch's own frames is still
 * written.
 */
async function mainSide(wants, shown, carriedMain) {
  console.log(`\n▶ Storyboard: main is ${git("log", "-1", "--format=%h %s", base)}\n`);
  try {
    const { tree, kept } = await mainFromStore(runDir, wants);
    touchTree(STORE, tree);
    // The pictures are linked into the run, so every path stays inside its folder: latest/ works, and
    // pruning the store never breaks a run.
    const selected = linkFlows(STORE, kept, { has: shown }, runDir);
    // Carried, for what isn't kept: only flows main still has, and none shot by this branch's suite.
    const stillMains = { has: (key) => key in kept.flows && shown(key) };
    writeJson(
      mainFrames,
      carriedMain ? carryFlows(carryable(carriedMain, stillMains, "main-run/"), selected) : selected,
    );
  } catch (error) {
    mainError = error;
  }
}

/** Whether a flow of main's is on a page of the flows `keys`: one of them, or one this branch's suite no longer has, shown as gone. */
const onPage = (keys) => (key) => keys.has(key) || !suite.has(key);

// A review gets main's frames first, of the flows it pictures and checks: this branch's side then carries
// from them what its change doesn't reach of a flow (chooseRuns). With no flow to picture, main isn't asked.
if (reached && fromStore) {
  const keys = new Set([...reached.run, ...spot]);
  if (keys.size > 0) await mainSide((mains) => mains.filter(onPage(keys)), onPage(keys));
  else writeJson(mainFrames, { frames: [] });
}

/** Of the flows the review pictures, those it runs, and where it carries the rest from (chooseRuns). */
const chosen = reached ? chooseRuns(new Set(reached.run)) : undefined;
/** Whether the review has found no flow to run: its page is then what it carries, beside main as it is now. */
const nothing = chosen?.run.size === 0 && spot.length === 0;
/** A file for `playwright test --test-list` of the flows `keys`. */
function testList(keys) {
  const file = join(mkdtempSync(join(tmpdir(), "pauseai-storyboard-")), "tests.txt");
  writeFileSync(file, keys.map((key) => suite.get(key)).join("\n"));
  return `--test-list=${file}`;
}
// What this run selects of the suite: it's partial when it leaves some out, whatever did it.
let wanted;
/** The arguments that select the flows the review chose, if it chose. */
let chosenArgs = [];
if (reached) {
  console.log(
    `\n▶ ${planSummary(reached, suite.size)}${reached.run.size === suite.size ? "" : " --full runs every one."}`,
  );
  const runs = runsSummary(chosen, reached.run.size);
  if (runs) console.log(`▶ ${runs}`);
  for (const key of chosen.carried.keys())
    if (!spot.includes(key)) console.log(`▶ Storyboard: ${planLine(chosen, key)}, the rest carried.`);
  if (spot.length > 0)
    console.log(`▶ Storyboard: and ${spot.length} flows the change doesn't reach, to check they look as main's do.`);
  console.log("");
  const keys = new Set([...chosen.run, ...spot]);
  wanted = new Map([...suite].filter(([key]) => keys.has(key)));
  if (!nothing) chosenArgs = [testList([...wanted.keys()])];
} else {
  wanted = listFlows([...options.projects, ...passThrough]);
}
const partial = [...suite.keys()].some((key) => !wanted.has(key));

/** The flows a review pictures and doesn't run: carried as they are. */
const leftAlone = reached && { has: (key) => reached.run.has(key) && !wanted.has(key) };
/** The run this one starts from: the latest, when a review chose to carry from it, and for a run narrowed by hand. */
const carried = (reached ? chosen.source?.latest : partial) && existsSync(join(LATEST, "branch")) ? LATEST : undefined;
if (carried) {
  if (!reached) console.log(`\n▶ Storyboard: a partial run; the other flows are carried from the latest run.\n`);
  linkTree(join(carried, "branch"), join(runDir, "branch"));
  // Main's side of the latest run too, but under a review's own, made from the store above.
  if (!(reached && fromStore)) {
    if (existsSync(join(carried, "main"))) linkTree(join(carried, "main"), join(runDir, "main"));
    // Main's pictures from a run with --this-suite-on-main, which stay in the run. Not into a run that
    // reads main's own from the store: its flows of those are dropped below.
    if (!fromStore && existsSync(join(carried, "main-run")))
      linkTree(join(carried, "main-run"), join(runDir, "main-run"));
  }
  // Flows gone from the suite go from the review, and those a review no longer pictures.
  writeJson(branchFrames, carryable(readJson(branchFrames), leftAlone || suite));
} else if (reached) {
  // Main's frames of the flows this run leaves alone, their pictures linked into the run's folder: or, with
  // nothing to carry from, no flow yet.
  writeJson(
    branchFrames,
    chosen.source ? linkFlows(STORE, chosen.source.kept, leftAlone, runDir, "branch") : { frames: [] },
  );
}
/** Main's flows carried from the latest run, for the flows this run doesn't replace. */
const carriedMain = carried && !(reached && fromStore) && existsSync(mainFrames) ? readJson(mainFrames) : undefined;

const full = !partial && passThrough.length === 0;
// Whether the build is known to be of the code as it is: Playwright makes it for this run.
const builtHere = !options.server && !(await answers(LOCAL_URL));
if (!builtHere && !nothing)
  console.log(
    `\n▶ Storyboard: a server is already up at ${options.server ?? LOCAL_URL}. Its build may be older than the code, so this run's flows aren't recorded as this code's, and the next review runs them again. Stop it, and the review builds its own.\n`,
  );

// Each flow records the tree it ran on only when the build is that tree's.
const stamps = { STORYBOARD_TREE: builtHere ? treeBefore : "", STORYBOARD_SETUP: setupOf(process.cwd()) };
// The gallery's flows it pictures in part, but those it spot-checks, which it runs whole: each with the frames it
// carries from the run it chose.
const inPart = new Map([...(chosen?.carried ?? [])].filter(([key]) => !spot.includes(key)));
let code = nothing
  ? 0
  : runSuite("branch", options.server ?? LOCAL_URL, { ...stamps, ...carryEnv(runDir, inPart) }, chosenArgs);
if (inPart.size > 0 && existsSync(branchFrames))
  writeJson(branchFrames, fillCarried(readJson(branchFrames), inPart, runDir, "branch", carriedPicture(chosen.source)));

// The flows run only to check them: if one looks different from main's, or from what would have been carried
// of it, the map missed something, and every other flow runs too, on both sides, the gallery's it pictured in
// part whole.
const missed = spot.length > 0 ? await spotMisses(spotChecks(spot, reached, chosen)) : [];
if (missed.length > 0) {
  console.log(`\n▶ ${missedSummary(missed, reached.changed)}\n`);
  const rest = [...suite.keys()].filter((key) => !wanted.has(key) || inPart.has(key));
  code = runSuite("branch", options.server ?? LOCAL_URL, stamps, [testList(rest)]) || code;
  await mainSide(undefined, () => true);
}

// A review keeps its flows under the tree they picture, the carried ones too, as each looks as it would on
// this tree: if the build was this tree's, and nothing in the checkout changed meanwhile.
if (existsSync(branchFrames) && (full || reached) && (nothing || (builtHere && workingTree() === treeBefore))) {
  // Each flow the review carried is known to look as it does at this tree, so the next review asks only what
  // changed since (flowsToRun).
  const manifest = readJson(branchFrames);
  for (const run of manifest.frames) if (run.tree && run.tree !== treeBefore) run.seen = treeBefore;
  writeJson(branchFrames, manifest);
  keepRuns(STORE, treeBefore, runDir, manifest.frames, Object.fromEntries(suite));
}

// Main's side, for any run but a review's from the store, made first (above). What board.ts pairs this
// branch's frames with: this run's flows, and a carried run's main frames for the rest of the page.
/** The flows this run's page has, once this branch's side is written. */
const pageKeys = () => new Set(readJson(branchFrames).frames.map(flowKey));
if (reached && fromStore) {
  // Made already.
} else if (options.main === undefined || !existsSync(branchFrames)) {
  if (carriedMain) writeJson(mainFrames, carryable(carriedMain, pageKeys()));
} else if (fromStore) {
  // Every flow of main's for a run of every flow, and a run narrowed by hand asks only for its own: its
  // page shows main's frames of every flow it has that's kept, so the carried ones are beside main as it is now.
  if (partial) await mainSide((mains) => mains.filter((key) => wanted.has(key)), onPage(pageKeys()), carriedMain);
  else await mainSide(undefined, () => true, carriedMain);
} else {
  console.log(`\n▶ Storyboard: main is ${git("log", "-1", "--format=%h %s", base)}\n`);
  try {
    const selected = await mainWithThisSuite(picturedFlows(readJson(branchFrames), wanted.keys()), wanted);
    writeJson(mainFrames, carriedMain ? carryFlows(carryable(carriedMain, pageKeys()), selected) : selected);
  } catch (error) {
    mainError = error;
  }
}
pruneStore(STORE, TREES_KEEP);

// The spot checks marked for the page, after the store has kept the flows: being one is this review's, not the flow's.
if (spot.length > 0 && existsSync(branchFrames)) {
  const spotted = new Set(spot);
  const manifest = readJson(branchFrames);
  for (const run of manifest.frames) if (spotted.has(flowKey(run))) run.spot = true;
  writeJson(branchFrames, manifest);
}

if (existsSync(branchFrames)) {
  const { summary, withMain } = await writeStoryboard(runDir);
  console.log(
    `\nStoryboard: ${summary.frames} frames in ${summary.flows} flows, ${
      withMain ? `${summary.changed} changed against main` : "no run of main to compare with"
    }${summary.failed ? `, ${summary.failed} failed` : ""}${
      summary.mainMissing ? `, ${summary.mainMissing} with main missing` : ""
    }. ${join(runDir, "index.html")}\n`,
  );
  // A review of this code: of every flow, or of those the review chose as the ones its change reaches.
  if (full || reached) {
    recordReview({
      complete: true,
      full,
      run: basename(runDir),
      flows: summary.flows,
      failed: summary.failed,
      changed: withMain ? summary.changed : null,
      // Flows the change shouldn't reach that looked different from main's (spotChecks).
      ...(missed.length > 0 ? { missed } : {}),
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

// Said again at the end, where it's read: a changed file couldn't be placed, so only the spot checks stood
// for it, or a flow that would have been carried looked different, so every flow ran.
if (reached?.unknown.length) console.log(`\n${planSummary(reached, suite.size)}\n`);
if (missed.length > 0) console.log(`\n${missedSummary(missed, reached.changed)}\n`);

if (options.open && existsSync(page)) {
  const opener = platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
  spawn(opener, [resolve(page)], { stdio: "ignore", detached: true, shell: platform() === "win32" }).unref();
}
process.exit(code || (mainError ? 1 : 0));
