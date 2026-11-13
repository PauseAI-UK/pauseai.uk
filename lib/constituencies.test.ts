import { describe, expect, it } from "vitest";
import { constituencyCountry, constituencyName, isOfficialName } from "./constituencies";
import constituencies from "./constituencies.json";

describe("the official constituencies", () => {
  it("lists all 650, by code", () => {
    expect(Object.keys(constituencies)).toHaveLength(650);
    expect(new Set(Object.values(constituencies)).size).toBe(650);
  });

  it("names a constituency from its code, and nothing else", () => {
    expect(constituencyName("W07000102")).toBe("Montgomeryshire and Glyndŵr");
    expect(constituencyName("E14001172")).toBe("Cities of London and Westminster");
    expect(constituencyName("E14999999")).toBeUndefined();
    expect(constituencyName("toString")).toBeUndefined();
  });

  it("knows an official name exactly", () => {
    expect(isOfficialName("Ynys Môn")).toBe(true);
    expect(isOfficialName("Ynys Mon")).toBe(false);
    expect(isOfficialName("Montgomeryshire and Glyndwr")).toBe(false);
  });

  it("knows each constituency's nation by its code, and every code is one of the four", () => {
    expect(constituencyCountry("Cities of London and Westminster")).toBe("england");
    expect(constituencyCountry("Ynys Môn")).toBe("wales");
    expect(constituencyCountry("Glasgow North")).toBe("scotland");
    expect(constituencyCountry("Foyle")).toBe("northern-ireland");
    expect(constituencyCountry("Nowhere")).toBeUndefined();
    expect(Object.values(constituencies).every((name) => constituencyCountry(name))).toBe(true);
  });
});
