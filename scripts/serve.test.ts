import { describe, expect, it } from "vitest";
import { checkoutPorts } from "@/tests/checkout.mjs";
import { networkAddress, parseArgs, servePorts, towardsNext, withoutSecure, worktreeOf } from "./serve.mjs";

describe("servePorts", () => {
  it("serves 2000 above the checkout's storyboard, next dev on the port after the proxy's", () => {
    const dir = "/home/jane/pauseai.uk/tmp/worktrees/fix-footer";
    const { proxy, next } = servePorts(dir);
    expect(proxy).toBeGreaterThanOrEqual(checkoutPorts(dir).local + 2000);
    expect(next).toBe(proxy + 1);
  });

  it("passes over a port browsers refuse", () => {
    // Paths whose storyboard pair is 4000 or 4664, so the proxy would be 6000 or 6664 and next dev 6665.
    const blocked = Array.from({ length: 20_000 }, (_, i) => `/w/${i}`).filter((dir) =>
      [4000, 4664].includes(checkoutPorts(dir).local),
    );
    expect(blocked.length).toBeGreaterThan(0);
    for (const dir of blocked) {
      const { proxy, next } = servePorts(dir);
      expect([6000, 6664, 6665, 6666, 6667, 6668, 6669]).not.toContain(proxy);
      expect([6000, 6665, 6666, 6667, 6668, 6669]).not.toContain(next);
    }
  });
});

describe("parseArgs", () => {
  it("reads a branch, a PR's number, or neither, and --stop", () => {
    expect(parseArgs([])).toEqual({ stop: false });
    expect(parseArgs(["fix-footer"])).toEqual({ branch: "fix-footer", stop: false });
    expect(parseArgs(["273", "--stop"])).toEqual({ pr: 273, stop: true });
    expect(parseArgs(["--stop"])).toEqual({ stop: true });
  });

  it("refuses anything else", () => {
    expect(parseArgs(["a", "b"])).toBeUndefined();
    expect(parseArgs(["--port", "5000"])).toBeUndefined();
  });
});

describe("worktreeOf", () => {
  const porcelain = [
    "worktree /home/jane/pauseai.uk",
    "HEAD 06de77ad",
    "branch refs/heads/main",
    "",
    "worktree /home/jane/pauseai.uk/tmp/worktrees/footer",
    "HEAD 8e93fa88",
    "branch refs/heads/fix-footer",
    "",
  ].join("\n");

  it("finds the worktree with the branch checked out, whatever its folder's called", () => {
    expect(worktreeOf(porcelain, "fix-footer")).toBe("/home/jane/pauseai.uk/tmp/worktrees/footer");
  });

  it("finds none for a branch no worktree has", () => {
    expect(worktreeOf(porcelain, "footer")).toBeUndefined();
  });
});

describe("networkAddress", () => {
  it("is the first IPv4 address that isn't loopback", () => {
    const v4 = (address: string, internal: boolean) =>
      ({ address, family: "IPv4", internal, netmask: "", mac: "", cidr: null }) as const;
    const v6 = {
      address: "fe80::1",
      family: "IPv6",
      internal: false,
      netmask: "",
      mac: "",
      cidr: null,
      scopeid: 0,
    } as const;
    expect(
      networkAddress({
        lo: [v4("127.0.0.1", true)],
        eth0: [v6, v4("192.168.215.3", false)],
      }),
    ).toBe("192.168.215.3");
  });

  it("is localhost when there's no other", () => {
    expect(networkAddress({ lo: [], eth1: undefined })).toBe("localhost");
  });
});

describe("towardsNext", () => {
  it("says the request came to next dev on localhost, from it", () => {
    expect(
      towardsNext(
        {
          host: "192.168.215.3:5200",
          origin: "http://192.168.215.3:5200",
          referer: "http://192.168.215.3:5200/staff?x=1",
          accept: "text/html",
        },
        "localhost:5201",
      ),
    ).toEqual({
      host: "localhost:5201",
      origin: "http://localhost:5201",
      referer: "http://localhost:5201/staff?x=1",
      accept: "text/html",
    });
  });

  it("adds no Origin or Referer a request didn't have", () => {
    expect(towardsNext({ host: "192.168.215.3:5200" }, "localhost:5201")).toEqual({ host: "localhost:5201" });
  });
});

describe("withoutSecure", () => {
  it("takes Secure from each cookie, wherever it is", () => {
    expect(
      withoutSecure([
        "staff_session=abc; Path=/staff; HttpOnly; Secure; SameSite=lax",
        "login_browser=def; Path=/; secure",
        "plain=1; Path=/",
      ]),
    ).toEqual([
      "staff_session=abc; Path=/staff; HttpOnly; SameSite=lax",
      "login_browser=def; Path=/",
      "plain=1; Path=/",
    ]);
  });

  it("leaves a response with no cookies without", () => {
    expect(withoutSecure(undefined)).toBeUndefined();
  });
});
