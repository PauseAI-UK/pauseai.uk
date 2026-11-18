import { describe, expect, it } from "vitest";
import { monthsAndYears } from "./dated-groups";

describe("monthsAndYears", () => {
  it("puts things newest first under their month for the last twelve months, and their year before that", () => {
    const at = [
      "2026-10-02T10:00:00Z",
      "2025-12-01T00:00:00Z",
      "2026-10-20T10:00:00Z",
      "2025-11-30T23:59:00Z",
      "2024-05-01T00:00:00Z",
    ];
    expect(monthsAndYears(at, (when) => when, new Date("2026-11-02T12:00:00Z"))).toEqual([
      { key: "2026-10", heading: "October 2026", items: ["2026-10-20T10:00:00Z", "2026-10-02T10:00:00Z"] },
      { key: "2025-12", heading: "December 2025", items: ["2025-12-01T00:00:00Z"] },
      { key: "2025", heading: "2025", items: ["2025-11-30T23:59:00Z"] },
      { key: "2024", heading: "2024", items: ["2024-05-01T00:00:00Z"] },
    ]);
    expect(monthsAndYears([], (when: string) => when, new Date())).toEqual([]);
  });

  it("reads months in London: past midnight in summer time is the next month's, a day alone is its own", () => {
    const at = ["2026-06-30T23:30:00Z", "2026-06-30", "2025-07-31T23:30:00Z"];
    // In London it's 1 July 2026 already, so July 2025 is the first month of twelve.
    expect(monthsAndYears(at, (when) => when, new Date("2026-06-30T23:30:00Z"))).toEqual([
      { key: "2026-07", heading: "July 2026", items: ["2026-06-30T23:30:00Z"] },
      { key: "2026-06", heading: "June 2026", items: ["2026-06-30"] },
      { key: "2025-08", heading: "August 2025", items: ["2025-07-31T23:30:00Z"] },
    ]);
    // On 31 May the twelve months start in June 2025, and 23:30 UTC on 31 May 2025 was 1 June in London.
    expect(monthsAndYears(["2025-05-31T23:30:00Z"], (when) => when, new Date("2026-05-31T12:00:00Z"))).toEqual([
      { key: "2025-06", heading: "June 2025", items: ["2025-05-31T23:30:00Z"] },
    ]);
  });
});
