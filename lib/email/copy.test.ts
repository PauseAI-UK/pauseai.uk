import { expect, it } from "vitest";
import { emailCopy } from "./copy";

it("words the problems sending reports", () => {
  expect(emailCopy.problems.sendFailed("mailing")).toContain("mailing");
});
