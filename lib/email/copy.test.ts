import { expect, it } from "vitest";
import { emailCopy } from "./copy";

it("words the problems sending reports", () => {
  expect(emailCopy.problems.sendFailed("mailing")).toContain("mailing");
});

it("names the account whose Gmail token couldn't be revoked", () => {
  expect(emailCopy.problems.tokenNotRevoked("jo@pauseai.uk")).toContain("jo@pauseai.uk");
});
