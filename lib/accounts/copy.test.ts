import { expect, it } from "vitest";
import { accountsCopy } from "./copy";

it("names the account whose Gmail token couldn't be revoked", () => {
  expect(accountsCopy.problems.tokenNotRevoked("jo@pauseai.uk")).toContain("jo@pauseai.uk");
});
