import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { flowKey } from "../../../scripts/storyboard-main.mjs";

// How long each flow that passed took, by its key, written to the file
// STORYBOARD_TIMES names when the run ends, and nothing when it's unset. CI
// keeps them, to deal the next run's flows into parts that take about as
// long as each other (scripts/ci-parts.mjs).
export default class Times implements Reporter {
  private times: Record<string, number> = {};

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status !== "passed") return;
    const viewport = test.parent.project()?.name ?? "";
    const section = basename(test.location.file).replace(/\.spec\.ts$/, "");
    this.times[flowKey({ viewport, section, flow: test.title })] = result.duration;
  }

  onEnd() {
    const file = process.env.STORYBOARD_TIMES;
    if (file) writeFileSync(file, JSON.stringify(this.times));
  }
}
