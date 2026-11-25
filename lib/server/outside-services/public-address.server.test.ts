import { describe, expect, it, vi } from "vitest";
import { isPublicHost, isPublicIp } from "./public-address.server";

/** What each name resolves to; a name not here doesn't resolve. */
const names: Record<string, string[]> = {
  "www.example.org": ["93.184.215.14", "2606:2800:21f:cb07:6820:80da:af6b:8b2c"],
  "localhost.example.org": ["127.0.0.1"],
  "half.example.org": ["93.184.215.14", "10.0.0.5"],
};
vi.mock("node:dns/promises", () => ({
  lookup: async (name: string) => {
    if (!names[name]) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${name}`), { code: "ENOTFOUND" });
    return names[name].map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  },
}));

describe("isPublicIp", () => {
  it("takes an address on the public internet, v4 or v6", () => {
    expect(isPublicIp("93.184.215.14")).toBe(true);
    expect(isPublicIp("2606:2800:21f:cb07:6820:80da:af6b:8b2c")).toBe(true);
  });

  it("refuses loopback, private, link-local and other internal addresses", () => {
    for (const ip of [
      "0.0.0.0",
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "224.0.0.1",
      "255.255.255.255",
      "::",
      "::1",
      "fd00::1",
      "fe80::1",
      "ff02::1",
      "64:ff9b::a00:1",
    ]) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
  });

  it("refuses an IPv4 internal address written as IPv6", () => {
    expect(isPublicIp("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicIp("::ffff:a00:1")).toBe(false);
    expect(isPublicIp("::ffff:93.184.215.14")).toBe(true);
  });
});

describe("isPublicHost", () => {
  it("takes a name whose every address is public", async () => {
    expect(await isPublicHost("www.example.org")).toBe(true);
  });

  it("refuses a name with any internal address, or none", async () => {
    expect(await isPublicHost("localhost.example.org")).toBe(false);
    expect(await isPublicHost("half.example.org")).toBe(false);
    expect(await isPublicHost("nowhere.example.org")).toBe(false);
  });

  it("reads an IP address as itself, IPv6 in a URL's brackets too", async () => {
    expect(await isPublicHost("93.184.215.14")).toBe(true);
    expect(await isPublicHost("169.254.169.254")).toBe(false);
    expect(await isPublicHost(new URL("http://[::1]/").hostname)).toBe(false);
    expect(await isPublicHost(new URL("http://2130706433/").hostname)).toBe(false);
  });
});
