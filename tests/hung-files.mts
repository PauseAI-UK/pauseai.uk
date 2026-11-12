// Stops a Vitest run when a test file hasn't finished within a limit, naming
// the file. A test's own time limit runs inside the page or worker the test
// runs in, so it never fires once that's stuck: a component whose effect
// sets state on every render freezes a browser test's page, and the run then
// prints nothing more and never ends. This runs in Vitest's own process, as
// a reporter (vitest.config.mts), so it still can.
import type { Reporter, TestModule, Vitest } from "vitest/node";

/**
 * How long a test file may take. The slowest take seconds, and a test's own
 * limit is a minute (vitest.config.mts), so only a file that's stuck, or
 * whose every test is timing out, gets here.
 */
export const FILE_LIMIT_MS = 5 * 60_000;

/** How long Vitest gets to close down before the process is ended under it. */
const CLOSE_LIMIT_MS = 10_000;

/** What the run prints for a file that hasn't finished. */
export function hungMessage(project: string, file: string, limitMs: number): string {
  const minutes = limitMs / 60_000;
  return [
    "",
    `✗ ${file} (${project}) hasn't finished after ${minutes === 1 ? "a minute" : `${minutes} minutes`}, so the run is stopped.`,
    "  It's stuck where its tests' own time limit can't fire, such as a component that renders in an endless loop",
    "  (an effect that sets state each time it runs). Run the file on its own to find the test.",
    "",
  ].join("\n");
}

/** Ends the run as failed: Vitest is asked to cancel and close, and the process exits whether or not it manages to. */
async function endRun(vitest: Vitest): Promise<never> {
  const closed = vitest.cancelCurrentRun("test-failure").then(() => vitest.close());
  const gaveUp = new Promise((resolve) => setTimeout(resolve, CLOSE_LIMIT_MS).unref());
  await Promise.race([closed, gaveUp]).catch(() => {});
  process.exit(1);
}

export class HungFiles implements Reporter {
  private vitest: Vitest | undefined;
  private readonly running = new Map<TestModule, ReturnType<typeof setTimeout>>();
  private readonly limitMs: number;
  private readonly stop: (vitest: Vitest) => unknown;
  private readonly print: (message: string) => void;

  constructor(
    limitMs = FILE_LIMIT_MS,
    stop: (vitest: Vitest) => unknown = endRun,
    print: (message: string) => void = (message) => process.stderr.write(`${message}\n`),
  ) {
    this.limitMs = limitMs;
    this.stop = stop;
    this.print = print;
  }

  onInit(vitest: Vitest): void {
    this.vitest = vitest;
  }

  onTestModuleStart(module: TestModule): void {
    const timer = setTimeout(() => {
      this.print(hungMessage(module.project.name, module.relativeModuleId, this.limitMs));
      this.clear();
      this.stop(this.vitest!);
    }, this.limitMs);
    // The timer alone doesn't keep the process going once the run is over.
    timer.unref();
    this.running.set(module, timer);
  }

  onTestModuleEnd(module: TestModule): void {
    clearTimeout(this.running.get(module));
    this.running.delete(module);
  }

  onTestRunEnd(): void {
    this.clear();
  }

  private clear(): void {
    for (const timer of this.running.values()) clearTimeout(timer);
    this.running.clear();
  }
}
