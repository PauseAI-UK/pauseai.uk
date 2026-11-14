import { expect, it } from "vitest";
import { mailingsCopy } from "./copy";

it("puts the number in the mailings list's total", () => {
  expect(mailingsCopy.mailings.total(7)).toContain("7");
});
