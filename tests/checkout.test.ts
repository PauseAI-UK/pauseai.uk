import { describe, expect, it } from "vitest";
import { checkoutPorts, foreignServer } from "./checkout.mjs";

describe("checkoutPorts", () => {
  it("gives each checkout the same pair every time, its own build's then main's, clear of the dev server's 3000", () => {
    const ports = checkoutPorts("/home/jane/pauseai.uk/tmp/worktrees/fix-footer");
    expect(checkoutPorts("/home/jane/pauseai.uk/tmp/worktrees/fix-footer")).toEqual(ports);
    expect(ports.main).toBe(ports.local + 1);
    for (let i = 0; i < 200; i++) {
      const { local } = checkoutPorts(`/home/jane/pauseai.uk/tmp/worktrees/branch-${i}`);
      expect(local).toBeGreaterThanOrEqual(3100);
      expect(local + 1).toBeLessThanOrEqual(4999);
      expect(local % 2).toBe(0);
    }
  });

  it("gives other checkouts other ports", () => {
    const ports = new Set(["a", "b", "c", "d"].map((name) => checkoutPorts(`/home/jane/${name}`).local));
    expect(ports.size).toBeGreaterThan(1);
  });
});

describe("foreignServer", () => {
  const url = "http://localhost:3456";

  it("accepts a build of this checkout", () => {
    expect(foreignServer("/home/jane/pauseai.uk", "/home/jane/pauseai.uk", url)).toBeUndefined();
  });

  it("names the checkout another build is from", () => {
    expect(foreignServer("/home/jane/pauseai.uk/tmp/worktrees/other", "/home/jane/pauseai.uk", url)).toBe(
      "http://localhost:3456 is serving a fixture build of /home/jane/pauseai.uk/tmp/worktrees/other, not this checkout's (/home/jane/pauseai.uk). Stop that server and run again.",
    );
  });

  it("says when a server names no checkout", () => {
    expect(foreignServer(null, "/home/jane/pauseai.uk", url)).toContain("no X-Fixture-Checkout header");
  });

  it("checks this checkout's own port by default", () => {
    expect(foreignServer(process.cwd())).toBeUndefined();
  });
});
