import { afterEach, describe, expect, it, vi } from "vitest";
import { leavePage, reloadPage } from "./leave-page.client";

afterEach(() => vi.unstubAllGlobals());

describe("leavePage", () => {
  it("goes to the page in the browser", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    leavePage("/staff/asks/new");
    expect(assign).toHaveBeenCalledWith("/staff/asks/new");
  });
});

describe("reloadPage", () => {
  it("loads the page afresh in the browser", () => {
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    reloadPage();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
