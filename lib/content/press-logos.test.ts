import { describe, expect, it } from "vitest";
import { outletAnchor, tileToMinLength } from "./press-logos";

describe("outletAnchor", () => {
  it("is the outlet's name in lower case, its accents dropped and anything else between words a hyphen", () => {
    expect(outletAnchor("The Guardian")).toBe("the-guardian");
    expect(outletAnchor("Le Monde diplomatique")).toBe("le-monde-diplomatique");
    expect(outletAnchor("Süddeutsche Zeitung")).toBe("suddeutsche-zeitung");
    expect(outletAnchor(" (BBC) News! ")).toBe("bbc-news");
  });
});

describe("tileToMinLength", () => {
  it("repeats a short row whole until it is long enough", () => {
    expect(tileToMinLength([1, 2, 3], 7)).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3]);
    expect(tileToMinLength([1, 2], 2)).toEqual([1, 2]);
  });

  it("leaves an empty row empty", () => {
    expect(tileToMinLength([], 10)).toEqual([]);
  });
});
