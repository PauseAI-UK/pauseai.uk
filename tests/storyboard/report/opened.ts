import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { flowKey } from "../../../scripts/storyboard-main.mjs";
import { RECORDING } from "../../../scripts/storyboard-reach.mjs";

// What each flow that passed opened (tests/storyboard/fixtures.ts), by its
// key, with the way it was recorded (RECORDING), written to the file
// STORYBOARD_OPENED names when the run ends, and nothing when it's unset.
// Main's CI keeps it, so CI on a pull request runs only the flows its change
// can reach (scripts/ci-parts.mjs).
export default class Opened implements Reporter {
  private opened: Record<string, string[]> = {};

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status !== "passed") return;
    const body = result.attachments.find((attachment) => attachment.name === "opened")?.body;
    if (!body) return;
    const viewport = test.parent.project()?.name ?? "";
    const section = basename(test.location.file).replace(/\.spec\.ts$/, "");
    this.opened[flowKey({ viewport, section, flow: test.title })] = JSON.parse(body.toString("utf8"));
  }

  onEnd() {
    const file = process.env.STORYBOARD_OPENED;
    if (file) writeFileSync(file, JSON.stringify({ recording: RECORDING, flows: this.opened }));
  }
}
