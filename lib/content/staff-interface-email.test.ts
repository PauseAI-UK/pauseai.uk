import { expect, it } from "vitest";
import { staffCopy } from "./staff-interface";

it("says what a CiviCRM run sent CiviCRM, refused and left to try again", () => {
  const run = { contacts: 1, added: 0, changed: 0, gone: 0, optOuts: 0, blocked: 0 };
  expect(staffCopy.civicrm.result({ ...run, updates: { sent: 2, refused: 0, unanswered: 0 } })).toMatch(
    /^2 opt-outs sent to CiviCRM\. /,
  );
  expect(staffCopy.civicrm.result({ ...run, updates: { sent: 1, refused: 1, unanswered: 3 } })).toMatch(
    /^1 opt-out sent to CiviCRM, 1 refused, 3 to try again\. /,
  );
});

it("says where no bulk email, or no email, came from but CiviCRM", () => {
  const { reasons } = staffCopy.supporters.detail.permissions;
  expect(reasons["no-bulk-email"]("2 Nov", "CiviCRM")).toBe("“No bulk emails” in CiviCRM, 2 Nov");
  expect(reasons["no-bulk-email"]("2 Nov", "their contact preferences")).toBe(
    "No bulk email, via their contact preferences, 2 Nov",
  );
  expect(reasons["do-not-email"]("2 Nov", "CiviCRM")).toBe("“Do not email” in CiviCRM, 2 Nov");
  expect(reasons["do-not-email"]("2 Nov", "PauseAI Global's records")).toBe(
    "No email at all, via PauseAI Global's records, 2 Nov",
  );
});

it("says what a sending run did with broadcasts, when it has them, and why one waits", () => {
  const run = { started: [], sent: 0, skipped: 0, failed: 0, left: 0, queue: { sent: 0, left: 0 } };
  expect(staffCopy.sending.result(run)).not.toContain("Broadcasts");
  expect(
    staffCopy.sending.result({ ...run, broadcasts: { started: [4], sent: 3, skipped: 1, failed: 0, waiting: 0 } }),
  ).toContain(" Broadcasts: started 1; copies sent 3, skipped 1, failed 0; 0 waiting for CiviCRM.");
  const waiting = staffCopy.notifications.broadcastWaiting;
  expect(waiting.body("Hi", "civicrm", "3 Nov", "link")).toContain("CiviCRM isn't answering");
  expect(waiting.body("Hi", "pull", "3 Nov", "link")).toContain("our import from CiviCRM hasn't worked");
  expect(staffCopy.broadcastPages.waiting("2 Nov", "civicrm", "5 Nov")).toContain("CiviCRM didn't answer");
});
