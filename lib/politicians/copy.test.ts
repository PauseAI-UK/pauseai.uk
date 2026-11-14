import { expect, it } from "vitest";
import { politiciansCopy } from "./copy";

it("puts the number in the politicians list's total", () => {
  expect(politiciansCopy.politicians.total(7)).toContain("7");
});
