import { describe, expect, it } from "vitest";
import { NAV_FOLD_KEY, navFoldCookie, navFoldOf } from "./staff-nav";

describe("the sidebar's fold", () => {
  it("is folded only by its cookie saying so", () => {
    expect(navFoldOf({ value: "folded" })).toBe("folded");
    expect(navFoldOf({ value: "open" })).toBe("open");
    expect(navFoldOf(undefined)).toBe("open");
  });

  it("is remembered for the staff pages for a year, and forgotten when unfolded", () => {
    expect(navFoldCookie(true)).toBe(`${NAV_FOLD_KEY}=folded; path=/staff; max-age=31536000; samesite=lax`);
    expect(navFoldCookie(false)).toBe(`${NAV_FOLD_KEY}=folded; path=/staff; max-age=0; samesite=lax`);
  });
});
