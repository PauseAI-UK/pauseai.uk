import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FullConfig, Reporter, Suite, TestCase, TestResult } from "@playwright/test/reporter";

// How far through its flows a run of the storyboard is, for anything
// outside the run that wants to show it, such as a terminal's status line
// (docs/testing.md, "The storyboard's progress"). Every run writes one file,
// always at the same place in its checkout, when it starts, after each flow
// and when it ends: the review (`npm run storyboard`) and the gate's run
// (`npm run test:storyboard`) alike. A review that has to run main's flows
// first, in main's own checkout, points that run at the file of the
// checkout it's reviewing (STORYBOARD_PROGRESS, scripts/storyboard.mjs), so
// one place says how far the review is, whichever side it's on.

/** Where a run says how far it is: the checkout's own file, or the one it's pointed at (STORYBOARD_PROGRESS). */
export const progressFile = () =>
  process.env.STORYBOARD_PROGRESS ?? join(process.cwd(), "test-results", "storyboard-progress.json");

/**
 * What the file holds. `kind` is which run it is: "review", with pictures
 * on both viewports (STORYBOARD_SHOTS), or "flows", the gate's lighter run
 * that only checks they work. `side` is which side of the review the run makes:
 * "main" for the one whose frames this branch's are set beside
 * (STORYBOARD_SIDE "main-run"), and "branch" for any other run. `pid` is
 * the run's process, so a reader can tell a run that was killed, which
 * never says it ended, from one still going. `done` counts every flow that
 * has finished, however it went, and `failed` those of them that didn't
 * pass. The times are ISO 8601.
 */
export type Progress = {
  kind: "review" | "flows";
  side: "branch" | "main";
  pid: number;
  startedAt: string;
  updatedAt: string;
  total: number;
  done: number;
  failed: number;
  ended: boolean;
};

export default class ProgressReporter implements Reporter {
  private file = progressFile();
  private progress: Progress = {
    kind: process.env.STORYBOARD_SHOTS === "1" ? "review" : "flows",
    side: process.env.STORYBOARD_SIDE === "main-run" ? "main" : "branch",
    pid: process.pid,
    startedAt: "",
    updatedAt: "",
    total: 0,
    done: 0,
    failed: 0,
    ended: false,
  };

  /** Written beside the file and moved over it, so a reader never sees half of one. */
  private write() {
    this.progress.updatedAt = new Date().toISOString();
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(`${this.file}.${process.pid}`, `${JSON.stringify(this.progress)}\n`);
    renameSync(`${this.file}.${process.pid}`, this.file);
  }

  onBegin(_config: FullConfig, suite: Suite) {
    this.progress.startedAt = new Date().toISOString();
    this.progress.total = suite.allTests().length;
    this.write();
  }

  // A flow ends once, as none is retried (playwright.config.ts).
  onTestEnd(_test: TestCase, result: TestResult) {
    this.progress.done += 1;
    if (result.status !== "passed" && result.status !== "skipped") this.progress.failed += 1;
    this.write();
  }

  onEnd() {
    this.progress.ended = true;
    this.write();
  }
}
