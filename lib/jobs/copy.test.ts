import { expect, it } from "vitest";
import { jobsCopy } from "./copy";

it("counts the errors a night's tidying deleted, none for a run kept from before it did", () => {
  const counts = { importRuns: 12, auditEntries: 3, drafts: 4 };
  expect(jobsCopy.tidying.result({ ...counts, errors: 5 })).toContain("5 errors");
  expect(jobsCopy.tidying.result(counts)).toContain("0 errors");
});

it("says what a CiviCRM run sent CiviCRM, refused and left to try again", () => {
  const run = { contacts: 1, added: 0, changed: 0, gone: 0, optOuts: 0, blocked: 0 };
  expect(jobsCopy.civicrm.result({ ...run, updates: { sent: 2, refused: 0, unanswered: 0 } })).toMatch(
    /^2 opt-outs sent to CiviCRM\. /,
  );
  expect(jobsCopy.civicrm.result({ ...run, updates: { sent: 1, refused: 1, unanswered: 3 } })).toMatch(
    /^1 opt-out sent to CiviCRM, 1 refused, 3 to try again\. /,
  );
});

it("says what a sending run did with broadcasts, when it has them", () => {
  const run = { started: [], sent: 0, skipped: 0, failed: 0, left: 0, queue: { sent: 0, left: 0 } };
  expect(jobsCopy.sending.result(run)).not.toContain("Broadcasts");
  expect(
    jobsCopy.sending.result({ ...run, broadcasts: { started: [4], sent: 3, skipped: 1, failed: 0, waiting: 0 } }),
  ).toContain(" Broadcasts: started 1; copies sent 3, skipped 1, failed 0; 0 waiting for CiviCRM.");
});

it("names the account in a Gmail read's problems", () => {
  for (const words of [jobsCopy.problems.couldntRead, jobsCopy.problems.nameUnknown]) {
    expect(words("jo@pauseai.uk")).toContain("jo@pauseai.uk");
  }
});
