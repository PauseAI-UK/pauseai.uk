import { describe, expect, it } from "vitest";
import { checkoutPorts } from "@/tests/checkout.mjs";
import { portLines, worktreePath, worktreePaths } from "./worktree.mjs";

describe("worktreePath", () => {
  it("puts the branch under the main checkout's tmp/worktrees", () => {
    expect(worktreePath("/home/jane/pauseai.uk", "fix-footer")).toBe("/home/jane/pauseai.uk/tmp/worktrees/fix-footer");
  });
});

describe("worktreePaths", () => {
  it("lists every worktree but the review's copies of main", () => {
    const porcelain = [
      "worktree /home/jane/pauseai.uk",
      "HEAD 06de77ad",
      "branch refs/heads/main",
      "",
      "worktree /home/jane/pauseai.uk/tmp/worktrees/fix-footer",
      "HEAD 8e93fa88",
      "branch refs/heads/fix-footer",
      "",
      "worktree /tmp/pauseai-storyboard-main-2a79f7ce",
      "HEAD 4d66cacd",
      "detached",
      "",
    ].join("\n");
    expect(worktreePaths(porcelain)).toEqual([
      "/home/jane/pauseai.uk",
      "/home/jane/pauseai.uk/tmp/worktrees/fix-footer",
    ]);
  });
});

describe("portLines", () => {
  const dir = "/home/jane/pauseai.uk/tmp/worktrees/fix-footer";
  const { local, main } = checkoutPorts(dir);
  // Another checkout's path whose ports are the same as dir's, found by trying names.
  const twin = Array.from({ length: 5000 }, (_, i) => `/home/jane/other-${i}`).find(
    (path) => checkoutPorts(path).local === local,
  )!;

  it("says which ports the storyboard serves the checkout and main on", () => {
    expect(portLines(dir, [dir])).toEqual([
      `Its storyboard serves this branch on http://localhost:${local}, and main beside it on http://localhost:${main}.`,
    ]);
  });

  it("warns of another checkout with the same ports, but not of itself", () => {
    expect(twin).toBeDefined();
    expect(portLines(dir, [dir, twin])).toEqual([
      `Its storyboard serves this branch on http://localhost:${local}, and main beside it on http://localhost:${main}.`,
      `Warning: ${twin} has the same ports, so one's storyboard refuses the other's server while it runs.`,
    ]);
  });
});
