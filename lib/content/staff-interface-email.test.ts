import { expect, it } from "vitest";
import { supportersCopy } from "@/lib/supporters/copy";

it("says where no bulk email, or no email, came from but CiviCRM", () => {
  const { reasons } = supportersCopy.supporters.detail.permissions;
  expect(reasons["no-bulk-email"]("2 Nov", "CiviCRM")).toBe("“No bulk emails” in CiviCRM, 2 Nov");
  expect(reasons["no-bulk-email"]("2 Nov", "their contact preferences")).toBe(
    "No bulk email, via their contact preferences, 2 Nov",
  );
  expect(reasons["do-not-email"]("2 Nov", "CiviCRM")).toBe("“Do not email” in CiviCRM, 2 Nov");
  expect(reasons["do-not-email"]("2 Nov", "PauseAI Global's records")).toBe(
    "No email at all, via PauseAI Global's records, 2 Nov",
  );
});
