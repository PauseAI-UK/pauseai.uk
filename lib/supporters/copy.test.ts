import { expect, it } from "vitest";
import { supportersCopy } from "./copy";

it("puts the number in the supporters list's total", () => {
  expect(supportersCopy.supporters.total(7)).toContain("7");
});
