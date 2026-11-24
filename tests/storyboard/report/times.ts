import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { flowKey } from "../../../scripts/storyboard-main.mjs";
import { RECORDING } from "../../../scripts/storyboard-reach.mjs";

// For CI, of each flow that passed, by its key: how long it took, written to
// the file STORYBOARD_TIMES names, and what it opened (tests/storyboard/
// fixtures.ts), to the file STORYBOARD_OPENED names, with the way it was
// recorded (RECORDING). Each when the run ends, and nothing when its
// variable is unset. CI keeps the times, to deal the next run's flows into
// parts that take about as long as each other, and main's record of what
// each flow opened, to run on a pull request only the flows its change can
// reach (scripts/ci-parts.mjs).
export default class Times implements Reporter {
  private times: Record<string, number> = {};
  private opened: Record<string, string[]> = {};

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status !== "passed") return;
    const viewport = test.parent.project()?.name ?? "";
    const section = basename(test.location.file).replace(/\.spec\.ts$/, "");
    const key = flowKey({ viewport, section, flow: test.title });
    this.times[key] = result.duration;
    const opened = result.attachments.find((attachment) => attachment.name === "opened")?.body;
    if (opened) this.opened[key] = JSON.parse(opened.toString("utf8"));
  }

  onEnd() {
    const times = process.env.STORYBOARD_TIMES;
    if (times) writeFileSync(times, JSON.stringify(this.times));
    const opened = process.env.STORYBOARD_OPENED;
    if (opened) writeFileSync(opened, JSON.stringify({ recording: RECORDING, flows: this.opened }));
  }
}
