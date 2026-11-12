import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestModule, Vitest } from "vitest/node";
import { FILE_LIMIT_MS, HungFiles, hungMessage } from "./hung-files.mts";

const testFile = (file: string, project = "browser (chromium)") =>
  ({ relativeModuleId: file, project: { name: project } }) as unknown as TestModule;
const vitest = {} as Vitest;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A reporter with a limit of a minute, and what it printed and stopped. */
function watching() {
  const printed: string[] = [];
  const stopped: Vitest[] = [];
  const reporter = new HungFiles(
    60_000,
    (run) => stopped.push(run),
    (message) => printed.push(message),
  );
  reporter.onInit(vitest);
  return { reporter, printed, stopped };
}

describe("HungFiles", () => {
  it("stops the run at a file that hasn't finished within the limit, naming it", () => {
    const { reporter, printed, stopped } = watching();
    reporter.onTestModuleStart(testFile("components/Stuck.browser.test.tsx"));
    vi.advanceTimersByTime(59_000);
    expect(stopped).toEqual([]);
    vi.advanceTimersByTime(1_000);
    expect(stopped).toEqual([vitest]);
    expect(printed).toEqual([hungMessage("browser (chromium)", "components/Stuck.browser.test.tsx", 60_000)]);
    expect(printed[0]).toContain(
      "✗ components/Stuck.browser.test.tsx (browser (chromium)) hasn't finished after a minute, so the run is stopped.",
    );
  });

  it("leaves alone a file that finishes, and the files beside the one that doesn't", () => {
    const { reporter, printed, stopped } = watching();
    const quick = testFile("lib/quick.test.ts", "node");
    const stuck = testFile("lib/stuck.test.ts", "node");
    const late = testFile("lib/late.test.ts", "node");
    reporter.onTestModuleStart(quick);
    reporter.onTestModuleStart(stuck);
    vi.advanceTimersByTime(30_000);
    reporter.onTestModuleEnd(quick);
    reporter.onTestModuleStart(late);
    vi.advanceTimersByTime(5 * 60_000);
    expect(stopped).toHaveLength(1);
    expect(printed).toHaveLength(1);
    expect(printed[0]).toContain("lib/stuck.test.ts (node)");
  });

  it("stops watching when the run ends", () => {
    const { reporter, stopped } = watching();
    reporter.onTestModuleStart(testFile("lib/cancelled.test.ts", "node"));
    reporter.onTestRunEnd();
    vi.advanceTimersByTime(5 * 60_000);
    expect(stopped).toEqual([]);
  });

  it("gives a file five minutes unless told otherwise, and says so", () => {
    expect(FILE_LIMIT_MS).toBe(300_000);
    expect(hungMessage("node", "lib/a.test.ts", FILE_LIMIT_MS)).toContain("hasn't finished after 5 minutes");
  });
});
