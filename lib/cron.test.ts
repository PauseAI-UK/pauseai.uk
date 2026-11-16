import { describe, expect, it } from "vitest";
import { nextCronRun } from "./cron";

const next = (cron: string, after: string) => nextCronRun(cron, new Date(after)).toISOString();

describe("nextCronRun", () => {
  it("finds the next minute a cron runs at, never the minute it's given", () => {
    expect(next("*/5 * * * *", "2026-11-16T10:00:00Z")).toBe("2026-11-16T10:05:00.000Z");
    expect(next("*/5 * * * *", "2026-11-16T10:03:30Z")).toBe("2026-11-16T10:05:00.000Z");
    expect(next("2-59/5 * * * *", "2026-11-16T10:58:00Z")).toBe("2026-11-16T11:02:00.000Z");
    expect(next("3,18,33,48 * * * *", "2026-11-16T10:20:00Z")).toBe("2026-11-16T10:33:00.000Z");
    expect(next("49 * * * *", "2026-11-16T10:49:00Z")).toBe("2026-11-16T11:49:00.000Z");
  });

  it("goes on to the next day, month and year", () => {
    expect(next("21 6 * * *", "2026-11-16T07:00:00Z")).toBe("2026-11-17T06:21:00.000Z");
    expect(next("21 6 * * *", "2026-11-30T07:00:00Z")).toBe("2026-12-01T06:21:00.000Z");
    expect(next("0 0 1 1 *", "2026-11-16T07:00:00Z")).toBe("2027-01-01T00:00:00.000Z");
  });

  it("keeps to a day of the week, a range and a number stepped", () => {
    // 16 November 2026 is a Monday.
    expect(next("0 6 * * 1", "2026-11-16T07:00:00Z")).toBe("2026-11-23T06:00:00.000Z");
    expect(next("0 9-17 * * *", "2026-11-16T17:30:00Z")).toBe("2026-11-17T09:00:00.000Z");
    expect(next("5/15 * * * *", "2026-11-16T10:06:00Z")).toBe("2026-11-16T10:20:00.000Z");
  });

  it("throws for a cron that isn't one, or never runs", () => {
    expect(() => next("* * * *", "2026-11-16T10:00:00Z")).toThrow("Not a cron: * * * *");
    expect(() => next("0 0 31 2 *", "2026-11-16T10:00:00Z")).toThrow("Never runs: 0 0 31 2 *");
  });
});
