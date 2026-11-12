import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Flow, Frame, Storyboard } from "../tests/storyboard/report/frames.ts";
import { changedFrames, describeChanged, runDirOf } from "./storyboard-changed.mjs";

const frame = (extra: Partial<Frame>): Frame => ({
  section: "letters",
  flow: "The letter bounces",
  viewport: "desktop",
  index: 1,
  caption: "The letter's page",
  changed: false,
  status: "passed",
  ...extra,
});

const flow = (extra: Partial<Flow>): Flow => ({
  section: "letters",
  flow: "The letter bounces",
  viewport: "desktop",
  status: "passed",
  mainStatus: "passed",
  frames: 1,
  changed: 0,
  ...extra,
});

const board = (frames: Frame[], flows: Flow[] = [flow({})], withMain = true): Storyboard => ({
  generatedAt: "2026-11-09T10:00:00.000Z",
  withMain,
  summary: { flows: flows.length, failed: 0, frames: frames.length, changed: 0, mainFailed: 0 },
  flows,
  frames,
});

const differs = frame({
  caption: "The email staff get",
  branch: "branch/frames/a/frame-1.png",
  main: "main/frames/a/frame-1.png",
  diff: "diff/a-1.png",
  mismatch: 0.1234,
  changed: true,
});
const added = frame({ index: 2, caption: "Her copy", branch: "branch/frames/a/frame-2.png", changed: true });
const gone = frame({ index: 3, caption: "The old notice", main: "main/frames/a/frame-3.png", changed: true });
const same = frame({ index: 4, branch: "branch/x.png", main: "main/x.png", mismatch: 0 });
const noise = frame({ index: 5, branch: "branch/y.png", main: "main/y.png", mismatch: 0.0001, noise: true });

describe("changedFrames", () => {
  it("lists the changed frames in order, each as differs, new or gone, and counts those only noise moved", () => {
    const changed = changedFrames(board([differs, same, added, noise, gone]));
    expect(changed.frames.map((f) => [f.kind, f.frame.caption])).toEqual([
      ["differs", "The email staff get"],
      ["new", "Her copy"],
      ["gone", "The old notice"],
    ]);
    expect(changed.noise).toBe(1);
    expect(changed.failed).toEqual([]);
    expect(changed.missing).toEqual([]);
  });

  it("lists a flow main is missing apart, with every frame it shot, and names the flows that failed", () => {
    const onPhone = { ...differs, viewport: "phone" };
    const goneOnPhone = { ...gone, viewport: "phone" };
    const failedOnMain = flow({ viewport: "phone", mainStatus: "failed", mainMissing: "failed" });
    const failed = flow({ flow: "Automatic replies", status: "timedOut", mainStatus: undefined });
    const changed = changedFrames(board([differs, onPhone, goneOnPhone], [flow({}), failedOnMain, failed]));
    expect(changed.frames.map((f) => f.frame.viewport)).toEqual(["desktop"]);
    expect(changed.missing).toEqual([{ flow: failedOnMain, frames: [onPhone] }]);
    expect(changed.failed).toEqual([failed]);
  });
});

describe("describeChanged", () => {
  it("prints a line for the run, then each frame with its pictures' paths, from the run's folder", () => {
    expect(describeChanged(board([differs, added, gone, same]), "/runs/2026-11-09T10-00-00")).toEqual([
      "Storyboard 2026-11-09T10-00-00: 3 changed frames of 4: 1 differs from main, 1 new, 1 gone.",
      "",
      "differs: desktop › letters › The letter bounces › 1. The email staff get (12.3% of pixels)",
      "  branch: /runs/2026-11-09T10-00-00/branch/frames/a/frame-1.png",
      "  main:   /runs/2026-11-09T10-00-00/main/frames/a/frame-1.png",
      "  diff:   /runs/2026-11-09T10-00-00/diff/a-1.png",
      "",
      "new: desktop › letters › The letter bounces › 2. Her copy",
      "  branch: /runs/2026-11-09T10-00-00/branch/frames/a/frame-2.png",
      "",
      "gone: desktop › letters › The letter bounces › 3. The old notice",
      "  main:   /runs/2026-11-09T10-00-00/main/frames/a/frame-3.png",
    ]);
  });

  it("says how many differ only by noise, which flows failed, and lists each flow main is missing, and why", () => {
    const flows = [
      flow({ status: "failed", error: "Timed out waiting for the list" }),
      flow({ flow: "Automatic replies", status: "interrupted" }),
      flow({ flow: "Her answer", mainStatus: "failed", mainMissing: "failed" }),
      flow({ flow: "His answer", mainStatus: undefined, mainMissing: "not-run" }),
    ];
    const hers = frame({ flow: "Her answer", caption: "Her page", branch: "branch/h-1.png", changed: true });
    const his = frame({ flow: "His answer", caption: "His page", branch: "branch/m-1.png", changed: true });
    expect(describeChanged(board([added, noise, hers, his], flows), "/runs/r")).toEqual([
      "Storyboard r: 1 changed frame of 4: 0 differ from main, 1 new, 0 gone; 1 more differs only by noise; 2 flows with main missing, every frame listed after.",
      "Failed: desktop › letters › The letter bounces: Timed out waiting for the list",
      "Failed: desktop › letters › Automatic replies",
      "",
      "new: desktop › letters › The letter bounces › 2. Her copy",
      "  branch: /runs/r/branch/frames/a/frame-2.png",
      "",
      "Main missing (main failed): desktop › letters › Her answer",
      "  1. Her page: /runs/r/branch/h-1.png",
      "",
      "Main missing (main hasn't run it): desktop › letters › His answer",
      "  1. His page: /runs/r/branch/m-1.png",
    ]);
    expect(describeChanged(board([noise, noise]), "/runs/r")[0]).toBe(
      "Storyboard r: 0 changed frames of 2: 0 differ from main, 0 new, 0 gone; 2 more differ only by noise.",
    );
  });

  it("says there's nothing to compare without a run of main", () => {
    expect(describeChanged(board([added], [flow({})], false), "/runs/r")).toEqual([
      "Storyboard r: no run of main to compare with, so nothing changed. --paths lists every frame.",
    ]);
  });
});

describe("runDirOf", () => {
  let dir: string;
  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "storyboard-changed-")));
    for (const run of ["first", "second"]) {
      mkdirSync(join(dir, "runs", run), { recursive: true });
      writeFileSync(join(dir, "runs", run, "storyboard.json"), JSON.stringify(board([added])));
    }
    symlinkSync(join("runs", "second"), join(dir, "latest"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("is the latest run's real folder by default, a run's by its name, or a folder's", () => {
    expect(runDirOf(undefined, dir)).toBe(join(dir, "runs", "second"));
    expect(runDirOf("first", dir)).toBe(join(dir, "runs", "first"));
    expect(runDirOf(join(dir, "runs", "first"), dir)).toBe(join(dir, "runs", "first"));
  });

  it("is undefined where there's no storyboard.json", () => {
    expect(runDirOf("third", dir)).toBeUndefined();
    expect(runDirOf(undefined, join(dir, "runs"))).toBeUndefined();
  });

  it("prints a run's changed frames from the command line, or fails when there's no run", () => {
    const script = join(__dirname, "storyboard-changed.mjs");
    const printed = spawnSync("node", [script, join(dir, "runs", "first")], { encoding: "utf8" });
    expect(printed.status).toBe(0);
    expect(printed.stdout).toContain(`new: desktop › letters › The letter bounces › 2. Her copy\n`);
    const missing = spawnSync("node", [script, join(dir, "runs", "third")], { encoding: "utf8" });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("No storyboard.json in");
  });
});
