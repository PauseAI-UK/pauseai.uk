import { describe, expect, it } from "vitest";
import { timeRange } from "./time-range";

describe("timeRange", () => {
  it("gives am or pm once when both ends share it", () => {
    expect(timeRange("2026-11-20T18:00:00.000Z", "2026-11-20T21:00:00.000Z")).toBe("6–9pm");
  });

  it("gives each end its own when they differ, with the minutes where there are some", () => {
    expect(timeRange("2026-11-23T09:30:00.000Z", "2026-11-23T13:30:00.000Z")).toBe("9.30am–1.30pm");
  });

  it("calls noon 12pm and midnight 12am", () => {
    expect(timeRange("2026-11-21T12:00:00.000Z", "2026-11-21T15:00:00.000Z")).toBe("12–3pm");
    expect(timeRange("2026-11-21T00:00:00.000Z", "2026-11-21T02:05:00.000Z")).toBe("12–2.05am");
  });

  it("reads the time in London, an hour ahead of UTC in summer", () => {
    expect(timeRange("2026-07-01T17:00:00.000Z", "2026-07-01T20:00:00.000Z")).toBe("6–9pm");
  });

  it("reads it in another time zone when asked", () => {
    expect(timeRange("2026-11-20T18:00:00.000Z", "2026-11-20T21:00:00.000Z", "America/New_York")).toBe("1–4pm");
  });
});
