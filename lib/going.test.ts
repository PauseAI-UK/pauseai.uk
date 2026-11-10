import { describe, expect, it } from "vitest";
import { goingCopy } from "@/lib/content/going";
import { goingNames } from "./going";

const guest = (name: string) => ({ name, avatar: null });

describe("goingNames", () => {
  it("names the first two guests and how many others", () => {
    expect(goingNames({ count: 1113, guests: [guest("Jane"), guest("Sam"), guest("Alex")] })).toBe(
      `Jane, Sam and ${goingCopy.others("1,111", false)}`,
    );
  });

  it("says one other in the singular", () => {
    expect(goingNames({ count: 2, guests: [guest("Jane")] })).toBe(`Jane and ${goingCopy.others("1", true)}`);
  });

  it("names everyone when Luma features everyone going", () => {
    expect(goingNames({ count: 2, guests: [guest("Jane"), guest("Sam")] })).toBe("Jane and Sam");
  });
});

describe("goingCopy", () => {
  it("puts the count in each", () => {
    expect(goingCopy.count("3")).toContain("3");
    expect(goingCopy.others("1", true)).toContain("1");
    expect(goingCopy.others("2", false)).toContain("2");
  });
});
