import { describe, expect, it } from "vitest";
import { chosenValues } from "./filter-choices";

const every = ["a", "b", "c"];

describe("chosenValues", () => {
  it("puts what's chosen in place of what the lozenge had, keeping the other's, unless a record has one", () => {
    const change = { all: ["a", "!b"], was: ["a"], chosen: ["c"], not: false, every };
    expect(chosenValues({ ...change, oneEach: false })).toEqual(["!b", "c"]);
    expect(chosenValues({ ...change, oneEach: true })).toEqual(["c"]);
  });

  it("marks those left out", () => {
    expect(chosenValues({ all: ["!a"], was: ["!a"], chosen: ["a", "b"], not: true, oneEach: true, every })).toEqual([
      "!a",
      "!b",
    ]);
  });

  it("with nothing chosen takes off only this lozenge", () => {
    expect(chosenValues({ all: ["a", "!b"], was: ["a"], chosen: [], not: false, oneEach: true, every })).toEqual([
      "!b",
    ]);
  });

  it("leaving out every choice takes off the filter, and finding every one doesn't", () => {
    const chosen = ["a", "b", "c"];
    expect(chosenValues({ all: ["!a", "x"], was: ["!a"], chosen, not: true, oneEach: false, every })).toEqual([]);
    expect(chosenValues({ all: ["a"], was: ["a"], chosen, not: false, oneEach: false, every })).toEqual(chosen);
    // With what's left out already, this makes all of them.
    expect(
      chosenValues({ all: ["!a", "b"], was: ["b"], chosen: ["b", "c"], not: true, oneEach: false, every }),
    ).toEqual([]);
    expect(chosenValues({ all: ["!a", "b"], was: ["b"], chosen: ["b", "c"], not: true, oneEach: true, every })).toEqual(
      ["!b", "!c"],
    );
    expect(chosenValues({ all: ["!x"], was: ["!x"], chosen: ["x"], not: true, oneEach: false, every: [] })).toEqual([
      "!x",
    ]);
  });
});
