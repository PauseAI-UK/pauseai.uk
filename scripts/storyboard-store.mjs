// The storyboard's frames, kept by the tree they picture (scripts/storyboard.mjs).
//
// A flow's frames come from the code the site and the suite are built from,
// and from nothing else: the same tree gives the same pictures, whichever
// branch or checkout it's in. So the flows a run finishes are kept under
// the hash of the tree it ran, in the main checkout's
// test-results/storyboard-frames/, which every worktree shares:
//
//   trees/<platform>-<tree>.json   the tree's flows, and the frames of each one that has run
//   pictures/<ab>/<sha256>.png     each picture once, by its contents
//
// The review reads main's side from it. Main's own suite, run on main's own
// build, puts it there, and so does a full review of a branch: once the
// branch is merged, if main's tree is the one reviewed, main's frames are
// kept already. The platform is in the name as a Mac and Linux draw text
// differently.
//
// Plain JavaScript, as scripts/storyboard.mjs imports it with Node.
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { flowKey } from "./storyboard-main.mjs";

/** The store, under the main checkout at `root`. */
export function storeDir(root) {
  return join(root, "test-results", "storyboard-frames");
}

const treeFile = (store, tree, platform) => join(store, "trees", `${platform}-${tree}.json`);
const pictureFile = (store, hash) => join(store, "pictures", hash.slice(0, 2), `${hash}.png`);

/** Where the store keeps the picture `hash`. */
export const picturePath = pictureFile;

/** The folder a flow's pictures go in, as the reporter names it (tests/storyboard/report/reporter.ts). */
export function flowFolder({ section, viewport, flow }) {
  return `${section}-${viewport}-${flow}`.replace(/[^\w.-]+/g, "-");
}

/** Puts the file at `from` at `to` as a hard link, or a copy where the two are on different disks. */
function place(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  // Removed first: it may be a hard link to another run's picture.
  rmSync(to, { force: true });
  try {
    linkSync(from, to);
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
    copyFileSync(from, to);
  }
}

/** Keeps the picture at `file`, and returns the hash it's kept under. */
function keepPicture(store, file) {
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
  const to = pictureFile(store, hash);
  if (!existsSync(to)) {
    // Under another name first, so a picture is never there half written.
    const arriving = `${to}.${process.pid}`;
    place(file, arriving);
    renameSync(arriving, to);
  }
  return hash;
}

/**
 * What's kept of `tree`: `flows`, every flow of its suite by key, each with
 * its line for `playwright test --test-list`, once someone has listed them;
 * and `frames`, each flow that has run, a frame's picture as its hash.
 */
export function readTree(store, tree, platform = process.platform) {
  const file = treeFile(store, tree, platform);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { frames: [] };
}

/**
 * Adds `runs`, the flows of a review of `tree`, to what's kept of it, their
 * pictures read from `runDir`, and returns the whole. Each replaces its
 * namesake, with two exceptions:
 *
 * - a flow that passed is never replaced by a run of it that didn't: the
 *   tree is the same, so the pass is the one to keep;
 * - a flow that ran on this tree and passed is never replaced by one
 *   carried from another (ranElsewhere).
 *
 * `flows`, if given, is the tree's whole suite (readTree).
 */
export function keepRuns(store, tree, runDir, runs, flows, platform = process.platform) {
  const fresh = runs
    .filter((run) => run.status !== "interrupted")
    .map((run) => ({
      ...run,
      frames: run.frames.map(({ png, ...frame }) =>
        png ? { ...frame, picture: keepPicture(store, join(runDir, png)) } : frame,
      ),
    }));
  return addRuns(store, tree, fresh, flows, platform);
}

/**
 * Whether a flow kept under `tree` ran on another: carried there, as the
 * change between the two can't reach it (scripts/storyboard-reach.mjs), so
 * it looks the same on both. `run.tree` is the tree it ran on; a flow kept
 * without one ran on the tree it's under.
 */
export function ranElsewhere(run, tree) {
  return run.tree !== undefined && run.tree !== tree;
}

/** Adds `runs`, flows kept under other trees, to what's kept of `tree` (keepRuns says which replace what). */
export function carryKept(store, tree, runs, platform = process.platform) {
  return addRuns(store, tree, runs, undefined, platform);
}

/** The trees kept for `platform`, most recently used first. */
export function keptTrees(store, platform = process.platform) {
  const trees = join(store, "trees");
  if (!existsSync(trees)) return [];
  return readdirSync(trees)
    .filter((name) => name.startsWith(`${platform}-`) && name.endsWith(".json"))
    .map((name) => ({
      tree: name.slice(platform.length + 1, -".json".length),
      at: statSync(join(trees, name)).mtimeMs,
    }))
    .sort((a, b) => b.at - a.at)
    .map(({ tree }) => tree);
}

/** Whether every picture of `run` is still in the store. */
export function picturesKept(store, run) {
  return run.frames.every((frame) => !frame.picture || existsSync(pictureFile(store, frame.picture)));
}

function addRuns(store, tree, fresh, flows, platform) {
  // Read now, after the pictures: another checkout may have added to it meanwhile.
  const kept = readTree(store, tree, platform);
  const passed = new Set(kept.frames.filter((run) => run.status === "passed").map(flowKey));
  const ranHere = new Set(
    kept.frames.filter((run) => run.status === "passed" && !ranElsewhere(run, tree)).map(flowKey),
  );
  const added = fresh.filter(
    (run) =>
      (run.status === "passed" || !passed.has(flowKey(run))) && !(ranElsewhere(run, tree) && ranHere.has(flowKey(run))),
  );
  const replaced = new Set(added.map(flowKey));
  const suite = flows ?? kept.flows;
  const whole = {
    ...(suite ? { flows: suite } : {}),
    frames: [...kept.frames.filter((run) => !replaced.has(flowKey(run))), ...added],
  };
  const file = treeFile(store, tree, platform);
  mkdirSync(dirname(file), { recursive: true });
  const arriving = `${file}.${process.pid}`;
  writeFileSync(arriving, JSON.stringify(whole));
  renameSync(arriving, file);
  return whole;
}

/**
 * The flows of `needed` (keys) that `kept` (readTree) can't give: those that
 * haven't run, those that didn't pass, which are tried again, and those with
 * a picture gone from the store.
 */
export function missingFlows(store, kept, needed) {
  const have = new Set(
    kept.frames
      .filter((run) => run.status === "passed")
      .filter((run) => picturesKept(store, run))
      .map(flowKey),
  );
  return [...needed].filter((key) => !have.has(key));
}

/**
 * The flows of `wanted` (keys) that `kept` has, as a run's manifest
 * (frames.json), their pictures linked into `runDir` under `side`. A flow
 * with a picture gone from the store is left out.
 */
export function linkFlows(store, kept, wanted, runDir, side = "main") {
  const frames = [];
  for (const run of kept.frames) {
    if (!wanted.has(flowKey(run))) continue;
    if (run.frames.some((frame) => frame.picture && !existsSync(pictureFile(store, frame.picture)))) continue;
    frames.push({
      ...run,
      frames: run.frames.map(({ picture, ...frame }, at) => {
        if (!picture) return frame;
        const png = join(side, "frames", flowFolder(run), `frame-${at + 1}.png`);
        place(pictureFile(store, picture), join(runDir, png));
        return { ...frame, png };
      }),
    });
  }
  return { frames };
}

/** Marks `tree` as used now, so pruneStore keeps it longest. */
export function touchTree(store, tree, now = new Date(), platform = process.platform) {
  const file = treeFile(store, tree, platform);
  if (existsSync(file)) utimesSync(file, now, now);
}

/** How long a picture no tree refers to is left: one being kept now has no tree yet. */
const SPARE_MS = 24 * 60 * 60 * 1000;

/**
 * Drops all but the `keep` trees used most recently, then every picture no
 * tree left refers to, if it's older than SPARE_MS.
 */
export function pruneStore(store, keep, now = Date.now()) {
  const trees = join(store, "trees");
  if (!existsSync(trees)) return;
  const files = readdirSync(trees)
    .filter((name) => name.endsWith(".json"))
    .map((name) => join(trees, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const file of files.slice(keep)) rmSync(file, { force: true });
  const used = new Set();
  for (const file of files.slice(0, keep)) {
    for (const run of JSON.parse(readFileSync(file, "utf8")).frames) {
      for (const frame of run.frames) if (frame.picture) used.add(`${frame.picture}.png`);
    }
  }
  const pictures = join(store, "pictures");
  if (!existsSync(pictures)) return;
  for (const folder of readdirSync(pictures)) {
    for (const name of readdirSync(join(pictures, folder))) {
      const file = join(pictures, folder, name);
      if (!used.has(name) && now - statSync(file).mtimeMs > SPARE_MS) rmSync(file, { force: true });
    }
  }
}
