import { expect, it } from "vitest";
import { staffAccount } from "@/lib/problems";
import { emailProblems } from "./copy";

it("words the problems sending reports, naming Gmail's account when it went by one", () => {
  expect(emailProblems.sendFailed({ purpose: "mailing" }).what).toContain("mailing");
  const byGmail = emailProblems.sendFailedByGmail({ purpose: "mailing", account: staffAccount("jo@pauseai.uk") });
  expect(byGmail.what).toContain("mailing, by Gmail as jo@pauseai.uk");
  expect(emailProblems.sentUnrecorded({ purpose: "letter" }).what).toContain("An email of type 'letter' was sent");
});

it("names the account whose Gmail token couldn't be revoked", () => {
  expect(emailProblems.tokenNotRevoked({ account: staffAccount("jo@pauseai.uk") }).what).toContain("jo@pauseai.uk");
});
