import { describe, expect, it } from "vitest";
import { isHouse, isPersonStatus } from "./politician-filters";

describe("isHouse", () => {
  it("knows the houses", () => {
    expect(isHouse("senedd")).toBe(true);
    expect(isHouse("hogwarts")).toBe(false);
  });
});

describe("isPersonStatus", () => {
  it("knows whether someone is in office", () => {
    expect(isPersonStatus("retired")).toBe(true);
    expect(isPersonStatus("sitting")).toBe(false);
  });
});
