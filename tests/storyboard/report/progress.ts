import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FullConfig, Reporter, Suite, TestCase, TestResult } from "@playwright/test/reporter";

// How far through its flows a run of the storyboard is, for anything
// outside the run that wants to show it, such as a terminal's status line
// (docs/testing.md, "The storyboard's progress"). Every run writes one file,
// always at the same place in its checkout, when it starts, after each flow
// and when it ends: the review (`npm run storyboard`) and the gate's run
// (`npm run test:storyboard`) alike.

/** Where a checkout's run says how far it is: STORYBOARD_PROGRESS, for a test, or the checkout's own file. */
export const progressFile = () =>
  process.env.STORYBOARD_PROGRESS ?? join(process.cwd(), "test-results", "storyboard-progress.json");

/**
 * What the file holds. `pid` is the run's process, so a reader can tell a
 * run that was killed, which never says it ended, from one still going.
 * `done` counts every flow that has finished, however it went, and `failed`
 * those of them that didn't pass. The times are ISO 8601.
 */
export type Progress = {
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
