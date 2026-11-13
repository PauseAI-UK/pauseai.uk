#!/usr/bin/env node
// The frames of a storyboard review a person should look at: those that
// differ from main's, those new on this branch, and those gone from it, each
// with its viewport, section, flow, caption and the paths of its pictures,
// to open one by one. The same frames as the page's Changed, and its count;
// then, as the page's Main missing, every frame of each flow main has
// nothing fair to compare with: a flow new here, or one whose run on main failed.
//
//   npm run storyboard:changed                 # the latest run, without running anything
//   npm run storyboard:changed -- <run>        # another: its folder, or its name under runs/
//   npm run storyboard -- --changed            # runs the review, then prints its changed frames
//
// A frame that differs only by noise isn't listed. The flows that failed
// here are named first.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = "test-results/storyboard";

/**
 * The frames of a storyboard (storyboard.json) to look at, in its order,
 * each with how it changed: "differs" from main's, "new" on this branch, or
 * "gone" from it. Then each flow main is missing, with its frames this
 * branch shot. Also the flows that failed here, and how many frames differ
 * only by noise.
 */
export function changedFrames(storyboard) {
  const flowKey = (f) => `${f.viewport}\u0000${f.section}\u0000${f.flow}`;
  const missingFlows = storyboard.flows.filter((f) => f.mainMissing);
  const skipped = new Set(missingFlows.map(flowKey));
  const frames = storyboard.frames
    .filter((frame) => frame.changed && !skipped.has(flowKey(frame)))
    .map((frame) => ({ kind: frame.branch && frame.main ? "differs" : frame.branch ? "new" : "gone", frame }));
  const missing = missingFlows.map((flow) => ({
    flow,
    frames: storyboard.frames.filter((frame) => frame.branch && flowKey(frame) === flowKey(flow)),
  }));
  return {
    frames,
    missing,
    failed: storyboard.flows.filter((f) => f.status !== "passed"),
    noise: storyboard.frames.filter((frame) => frame.noise).length,
  };
}

const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const where = (f) => `${f.viewport} › ${f.section} › ${f.flow}`;

/** The changed frames of the storyboard in `runDir`, as lines to print, with absolute paths to the pictures. */
export function describeChanged(storyboard, runDir) {
  const run = basename(runDir);
  if (!storyboard.withMain)
    return [`Storyboard ${run}: no run of main to compare with, so nothing changed. --paths lists every frame.`];
  const { frames, missing, failed, noise } = changedFrames(storyboard);
  const kinds = ["differs", "new", "gone"].map((kind) => frames.filter((f) => f.kind === kind).length);
  const lines = [
    `Storyboard ${run}: ${count(frames.length, "changed frame")} of ${storyboard.summary.frames}: ` +
      `${count(kinds[0], "differs", "differ")} from main, ${kinds[1]} new, ${kinds[2]} gone` +
      `${noise ? `; ${count(noise, "more differs", "more differ")} only by noise` : ""}` +
      `${missing.length ? `; ${count(missing.length, "flow")} with main missing, every frame listed after` : ""}.`,
  ];
  for (const flow of failed) lines.push(`Failed: ${where(flow)}${flow.error ? `: ${flow.error}` : ""}`);
  const path = (png) => resolve(runDir, png);
  for (const { kind, frame } of frames) {
    const mismatch = frame.mismatch ? ` (${(frame.mismatch * 100).toFixed(1)}% of pixels)` : "";
    lines.push("", `${kind}: ${where(frame)} › ${frame.index}. ${frame.caption}${mismatch}`);
    if (frame.branch) lines.push(`  branch: ${path(frame.branch)}`);
    if (frame.main) lines.push(`  main:   ${path(frame.main)}`);
    if (frame.diff) lines.push(`  diff:   ${path(frame.diff)}`);
  }
  for (const { flow, frames: shot } of missing) {
    const why = flow.mainMissing === "failed" ? `main ${flow.mainStatus}` : "main hasn't run it";
    lines.push("", `Main missing (${why}): ${where(flow)}`);
    for (const frame of shot) lines.push(`  ${frame.index}. ${frame.caption}: ${path(frame.branch)}`);
  }
  return lines;
}

/**
 * The folder of the run `name` names: a folder, a run's name under
 * runs/, or by default the latest. Its real path, so the paths printed stay
 * right after a later run moves `latest`.
 */
export function runDirOf(name, dir = DIR) {
  const candidates = name ? [name, join(dir, "runs", name)] : [join(dir, "latest")];
  const found = candidates.find((path) => existsSync(join(path, "storyboard.json")));
  return found && realpathSync(found);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const runDir = runDirOf(process.argv[2]);
  if (!runDir) {
    console.error(`No storyboard.json in ${process.argv[2] ?? join(DIR, "latest")}: run npm run storyboard first.`);
    process.exit(1);
  }
  console.log(describeChanged(JSON.parse(readFileSync(join(runDir, "storyboard.json"), "utf8")), runDir).join("\n"));
}
