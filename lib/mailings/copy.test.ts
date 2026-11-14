import { expect, it } from "vitest";
import { mailingsCopy } from "./copy";

it("says who the mailing leaves out, and why", () => {
  const { leftOut } = mailingsCopy.mailingPages;
  expect(leftOut(3, 1, 0)).toContain("filter");
  expect(leftOut(3, 0, 2, true)).not.toContain("filter");
});
