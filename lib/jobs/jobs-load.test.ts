import { expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";

// The press survey reads pages with packages of its own, which a server can
// fail to load: the other jobs, and the pages that list them, must not load
// them. They're loaded when the press survey runs.
vi.mock("@/lib/press/survey.server", () => {
  throw new Error("The press survey's module was loaded");
});

describeWithDatabase("loading the jobs", () => {
  useTestDatabase();

  it("loads the press survey only when it runs, so a module it can't load fails that job alone", async () => {
    const { runJob } = await import("./jobs.server");
    // Vitest says so in its own words, with the module's error as the cause.
    const failed = await runJob("import-press", "nightly", undefined).catch((error: unknown) => error);
    expect(String((failed as Error).cause)).toMatch(/press survey's module was loaded/);
  });
});
