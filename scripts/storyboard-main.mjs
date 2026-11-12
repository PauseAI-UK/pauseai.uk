// What the storyboard review (scripts/storyboard.mjs) works out about a
// run's flows: which the suite has, which a partial run carries from the
// last one, and which took pictures. The frames kept between runs are in
// scripts/storyboard-store.mjs.
//
// Plain JavaScript, as scripts/storyboard.mjs imports it with Node.
import { basename } from "node:path";

/** A flow's identity across runs: its viewport, section and title. */
export function flowKey({ viewport, section, flow }) {
  return `${viewport}|${section}|${flow}`;
}

/**
 * The flows `playwright test --list --reporter=json` would run, by key, each
 * with its line for a file that `playwright test --test-list` reads. Keys
 * have the test's own title, as the reporter records it; the line, its
 * describe path too.
 */
export function listedFlows(list) {
  const flows = new Map();
  const visit = (suite, describes) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        const section = basename(spec.file).replace(/\.spec\.ts$/, "");
        const line = [`[${test.projectName}]`, spec.file, ...describes, spec.title].join(" › ");
        flows.set(flowKey({ viewport: test.projectName, section, flow: spec.title }), line);
      }
    }
    for (const child of suite.suites ?? []) visit(child, [...describes, child.title]);
  };
  // The top level is the files, whose titles aren't in the path.
  for (const suite of list.suites ?? []) visit(suite, []);
  return flows;
}

/**
 * The flows of `wanted` (keys) that this branch's run pictured: with
 * `--this-suite-on-main`, main is run only for those, as a flow with no
 * frames has nothing to compare.
 */
export function picturedFlows(branch, wanted) {
  const pictured = new Set(branch.frames.filter((run) => run.frames.some((f) => f.png)).map(flowKey));
  return new Set([...wanted].filter((key) => pictured.has(key)));
}

/** Only the flows this run selected, so a partial run doesn't show the rest as gone from the branch. */
export function selectFlows(manifest, wanted) {
  return { frames: manifest.frames.filter((run) => wanted.has(flowKey(run))) };
}

/** A partial run's flows on top of the last run's, each replacing its namesake. */
export function carryFlows(previous, fresh) {
  const ran = new Set(fresh.frames.map(flowKey));
  return { frames: [...previous.frames.filter((run) => !ran.has(flowKey(run))), ...fresh.frames] };
}

/**
 * A carried manifest, less what the run can't trust: flows the suite no
 * longer has (renamed or deleted), and, when `foreign` is given, flows whose
 * pictures are under it (a run's with `--this-suite-on-main`, which aren't
 * main's own).
 */
export function carryable(manifest, suite, foreign) {
  return {
    frames: manifest.frames.filter(
      (run) => suite.has(flowKey(run)) && !(foreign && run.frames.some((f) => f.png?.startsWith(foreign))),
    ),
  };
}

/** A run's folder name, from when it started: sortable, and safe in a path. */
export function runFolder(startedAt) {
  return startedAt.replace(/\.\d+Z$/, "").replace(/:/g, "-");
}
