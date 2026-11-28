import { describe, expect, it } from "vitest";
import { CODE_PAGES, slugFrom, uniqueSlug } from "./campaign-slug";

describe("a campaign's slug from its title", () => {
  it("is its letters and numbers in lower case, accents off, a hyphen between each run", () => {
    expect(slugFrom("Stop the Race!")).toBe("stop-the-race");
    expect(slugFrom("  Café, AI & the 2027 Bill  ")).toBe("cafe-ai-the-2027-bill");
  });

  it("is cut short of a long title, with no hyphen left at its end; 'campaign' for a title with no letters", () => {
    expect(slugFrom(`${"a".repeat(59)} b`)).toBe("a".repeat(59));
    expect(slugFrom("a".repeat(70))).toHaveLength(60);
    expect(slugFrom("?!")).toBe("campaign");
  });

  it("takes the first number that makes it unique, never a page's in the code", () => {
    expect(uniqueSlug("stop", new Set())).toBe("stop");
    expect(uniqueSlug("stop", new Set(["stop", "stop-2"]))).toBe("stop-3");
    expect(CODE_PAGES).toEqual(expect.arrayContaining(["regulate-letter-pm", "briefings", "new"]));
  });
});
