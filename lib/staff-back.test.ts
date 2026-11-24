import { describe, expect, it } from "vitest";
import { staffBack } from "./staff-back";

describe("staffBack", () => {
  it("takes only a staff page, with its query", () => {
    expect(staffBack("/staff/politicians?house=lords", "/x")).toBe("/staff/politicians?house=lords");
    expect(staffBack("/staff//evil.example", "/x")).toBe("/x");
    expect(staffBack("/staffing", "/x")).toBe("/x");
    expect(staffBack(undefined, "/x")).toBe("/x");
  });
});
