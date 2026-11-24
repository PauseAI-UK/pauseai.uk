import { describe, expect, it } from "vitest";
import { displayPostcode, normalisePostcode } from "./postcodes";

describe("postcodes", () => {
  it("compares postcodes without spaces or case", () => {
    expect(normalisePostcode(" sw1a  1aa ")).toBe("SW1A1AA");
    expect(displayPostcode(" sw1a  1aa ")).toBe("SW1A 1AA");
    expect(displayPostcode("M11AE")).toBe("M1 1AE");
    expect(displayPostcode("ab1")).toBe("AB1");
  });
});
