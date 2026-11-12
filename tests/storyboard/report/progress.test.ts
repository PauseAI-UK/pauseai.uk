import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FullConfig, Suite, TestCase, TestResult } from "@playwright/test/reporter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProgressReporter, { progressFile, type Progress } from "./progress.ts";

describe("the storyboard's progress", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "storyboard-progress-"));
    // A folder that isn't there yet, as test-results isn't in a fresh checkout.
    vi.stubEnv("STORYBOARD_PROGRESS", join(dir, "test-results", "storyboard-progress.json"));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-12T10:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  const said = (): Progress => JSON.parse(readFileSync(progressFile(), "utf8"));
  const config = {} as FullConfig;
  const suite = (flows: number) => ({ allTests: () => Array.from({ length: flows }) }) as unknown as Suite;
  const flow = {} as TestCase;
  const ended = (status: TestResult["status"]) => ({ status }) as TestResult;

  it("is in the checkout's test-results, the same place every run", () => {
    vi.unstubAllEnvs();
    expect(progressFile()).toBe(join(process.cwd(), "test-results", "storyboard-progress.json"));
  });

  it("says how many flows there are when the run starts, and whose run it is", () => {
    new ProgressReporter().onBegin(config, suite(3));
    expect(said()).toEqual({
      pid: process.pid,
      startedAt: "2026-11-12T10:00:00.000Z",
      updatedAt: "2026-11-12T10:00:00.000Z",
      total: 3,
      done: 0,
      failed: 0,
      ended: false,
    });
  });

  it("counts each flow as it finishes, those that didn't pass apart, and says when the run has ended", () => {
    const reporter = new ProgressReporter();
    reporter.onBegin(config, suite(5));
    vi.setSystemTime(new Date("2026-11-12T10:01:00Z"));
    reporter.onTestEnd(flow, ended("passed"));
    expect(said()).toMatchObject({ done: 1, failed: 0, ended: false, updatedAt: "2026-11-12T10:01:00.000Z" });
    // One skipped is done, and hasn't failed.
    reporter.onTestEnd(flow, ended("skipped"));
    expect(said()).toMatchObject({ done: 2, failed: 0 });
    reporter.onTestEnd(flow, ended("failed"));
    reporter.onTestEnd(flow, ended("timedOut"));
    reporter.onTestEnd(flow, ended("interrupted"));
    expect(said()).toMatchObject({ done: 5, failed: 3, total: 5, ended: false });
    vi.setSystemTime(new Date("2026-11-12T10:02:00Z"));
    reporter.onEnd();
    expect(said()).toMatchObject({
      done: 5,
      ended: true,
      startedAt: "2026-11-12T10:00:00.000Z",
      updatedAt: "2026-11-12T10:02:00.000Z",
    });
    // Each write is moved into place, and leaves nothing beside the file.
    expect(readdirSync(join(dir, "test-results"))).toEqual(["storyboard-progress.json"]);
  });
});
