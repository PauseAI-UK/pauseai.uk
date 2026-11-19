import { describe, expect, it } from "vitest";
import { isBeacon, keptName } from "./measure-replay.mjs";

describe("isBeacon", () => {
  it("lets through a GET for a file from a site that doesn't count visits", () => {
    expect(isBeacon("GET", "https://www.googletagmanager.com/gtm.js?id=GTM-ABC")).toBe(false);
    expect(isBeacon("GET", "https://pauseai.info/embed/onboarding-form/?country=United+Kingdom")).toBe(false);
    expect(isBeacon("GET", "https://pauseai.info/_app/immutable/entry/start.js")).toBe(false);
  });

  it("stops anything sent rather than fetched, and anything to a host that counts visits", () => {
    expect(isBeacon("POST", "https://pauseai.info/api/signup")).toBe(true);
    expect(isBeacon("GET", "https://region1.analytics.google.com/g/collect?v=2")).toBe(true);
    expect(isBeacon("GET", "https://www.google-analytics.com/analytics.js")).toBe(true);
    expect(isBeacon("GET", "https://googleads.g.doubleclick.net/pagead/viewthroughconversion/1/")).toBe(true);
    expect(isBeacon("GET", "https://www.google.co.uk/ads/ga-audiences?v=1")).toBe(true);
    expect(isBeacon("GET", "https://o1.ingest.de.sentry.io/api/1/envelope/")).toBe(true);
    expect(isBeacon("GET", "https://example.org/g/collect?v=2")).toBe(true);
  });
});

describe("keptName", () => {
  it("names a file by its whole address", () => {
    const name = keptName("https://example.org/a.js?v=1");
    expect(name).toMatch(/^[0-9a-f]{32}$/);
    expect(keptName("https://example.org/a.js?v=1")).toBe(name);
    expect(keptName("https://example.org/a.js?v=2")).not.toBe(name);
  });
});
