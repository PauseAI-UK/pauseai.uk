import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { BLOCKED_PORTS, checkoutPorts, foreignServer } from "./checkout.mjs";

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

  it("passes over a pair with a port that fetch refuses", () => {
    // Paths whose hash lands on each blocked port's pair.
    const landing = (port: number) => {
      for (let i = 0; ; i++) {
        const dir = `/home/jane/blocked-${i}`;
        const hash = parseInt(createHash("sha256").update(dir).digest("hex").slice(0, 8), 16);
        if (3100 + 2 * (hash % 950) === port - (port % 2)) return dir;
      }
    };
    for (const port of BLOCKED_PORTS) {
      const { local, main } = checkoutPorts(landing(port));
      expect([local, main]).not.toContain(port);
      expect(local).toBe(port - (port % 2) + 2);
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
