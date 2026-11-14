// Lists the files that reach the most storyboard flows: a change to one
// reruns every flow that reaches it (scripts/storyboard-reach.mjs), so the
// files at the top are where a narrower import saves the most review time.
// It reads the map the storyboard keeps of what each flow opened, from the
// kept tree with the most flows that recorded it, in the main checkout's
// test-results/storyboard-frames/ (scripts/storyboard-store.mjs), and counts
// the desktop flows only, as a change reruns a phone flow with its desktop
// one. Run it after a storyboard review: with no kept flows, it says so.
//
//   npm run reach              the thirty files that reach the most flows
//   npm run reach -- 100       the hundred
//   npm run reach -- lib/email the files under lib/email/, most first
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { flowReach, reachContext } from "./storyboard-reach.mjs";
import { keptTrees, readTree, storeDir } from "./storyboard-store.mjs";

/** Whether a file is the site's code, which a flow can reach: not a test, the storyboard's own code or a script. */
export function isSiteCode(path) {
  return !/^(tests|scripts)\//.test(path) && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(path);
}

/** The desktop flows of the kept tree with the most flows that recorded what they opened, each with its key. */
export function newestRuns(store) {
  let best = [];
  for (const tree of keptTrees(store)) {
    const runs = readTree(store, tree)
      .frames.filter((run) => run.opened && (run.viewport ?? "desktop") === "desktop")
      .map((run) => ({ ...run, key: `${run.viewport ?? "desktop"}|${run.section}|${run.flow}` }));
    if (runs.length > best.length) best = runs;
  }
  return best;
}

/**
 * The site's files `runs` reach, each with how many of them reach it, most
 * first, then by path; only those under `under`, if given.
 */
export function mostReaching(runs, context, under = "") {
  const counts = new Map();
  for (const run of runs)
    for (const path of flowReach(run, context))
      if (isSiteCode(path) && path.startsWith(under)) counts.set(path, (counts.get(path) ?? 0) + 1);
  return [...counts]
    .map(([path, flows]) => ({ path, flows }))
    .sort((a, b) => b.flows - a.flows || a.path.localeCompare(b.path));
}

/** The lines to print: each file's count of flows, of how many there are, and its path. */
export function reachLines(found, total, limit) {
  const width = String(total).length;
  return found.slice(0, limit).map(({ path, flows }) => `${String(flows).padStart(width)}/${total}  ${path}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const arg = process.argv[2] ?? "";
  const limit = /^\d+$/.test(arg) ? Number(arg) : arg ? Infinity : 30;
  const under = /^\d+$/.test(arg) ? "" : arg;
  const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" });
  const runs = newestRuns(storeDir(dirname(common.trim())));
  if (runs.length === 0) {
    console.error("No kept flows say what they opened: run npm run storyboard first.");
    process.exit(1);
  }
  const lines = reachLines(mostReaching(runs, reachContext(process.cwd()), under), runs.length, limit);
  console.log(lines.join("\n"));
}
