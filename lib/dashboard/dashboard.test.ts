import { describe, expect, it } from "vitest";
import { isCampaignMetric, isSeriesMetric, METRIC_LINKS, agreedHref } from "./dashboard";

it("knows which metrics have a bar by campaign, and which a sparkline", () => {
  expect(isCampaignMetric("lettersSent")).toBe(true);
  expect(isCampaignMetric("eventsHeld")).toBe(false);
  expect(isSeriesMetric("eventRegistrations")).toBe(true);
  expect(isSeriesMetric("lettersSent")).toBe(false);
});

describe("agreedHref", () => {
  it("leads to the one politician who agreed, or to the list of those who did in the window", () => {
    expect(agreedHref({ agreedMp: 7, days: 7 })).toBe("/staff/politicians/7");
    expect(agreedHref({ agreedMp: null, days: 30 })).toBe("/staff/politicians?agreed=30&status=any&sort=asks");
  });
});

it("gives every tile a list for its window", () => {
  for (const { href } of Object.values(METRIC_LINKS)) expect(href(30)).toContain("30");
});
