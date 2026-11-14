import { describe, expect, it, vi } from "vitest";
import { dashboardWindow, listWindow, windowStart, WINDOW_OPTIONS } from "./time-windows";

describe("dashboardWindow", () => {
  it("is the window the URL asks for, or the default", () => {
    expect(dashboardWindow("30")).toBe(30);
    expect(dashboardWindow("90")).toBe(90);
    expect(dashboardWindow("7")).toBe(7);
    expect(dashboardWindow(undefined)).toBe(7);
    expect(dashboardWindow("14")).toBe(7);
  });
});

describe("a list's date filter", () => {
  it("takes the windows, and nothing else", () => {
    expect(listWindow("30")).toBe(30);
    expect(listWindow("31")).toBeUndefined();
    expect(listWindow("")).toBeUndefined();
  });

  it("starts that many days before now", () => {
    vi.stubEnv("FIXTURE_NOW", "2026-10-21T12:00:00.000Z");
    expect(windowStart(7)).toEqual(new Date("2026-10-14T12:00:00.000Z"));
    vi.unstubAllEnvs();
  });

  it("offers each window", () => {
    expect(WINDOW_OPTIONS.map((option) => option.value)).toEqual(["7", "30", "90"]);
  });
});
