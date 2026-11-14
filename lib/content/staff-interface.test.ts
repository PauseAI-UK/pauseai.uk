import { describe, expect, it } from "vitest";
import { staffCopy } from "./staff-interface";

describe("staff interface copy", () => {
  it("counts the errors a night's tidying deleted, none for a run kept from before it did", () => {
    const counts = { importRuns: 12, auditEntries: 3, drafts: 4 };
    expect(staffCopy.tidying.result({ ...counts, errors: 5 })).toContain("5 errors");
    expect(staffCopy.tidying.result(counts)).toContain("0 errors");
  });

  it("puts the number in the changes list's total", () => {
    expect(staffCopy.changes.total(7)).toContain("7");
  });

  it("names what each change counts", () => {
    for (const [key, say] of Object.entries(staffCopy.changes.counts)) expect(say(2), key).not.toBe("");
  });

  it("ends the bounce's reason with one full stop, whether Postmark's has one or not", () => {
    for (const reason of ["Mailbox not found.", "Mailbox not found"]) {
      expect(staffCopy.alert.body("Testy MP", "testy@example.org", reason, "https://example.org")).toContain(
        "The mail server said: “Mailbox not found.”",
      );
    }
  });
});

it("words the runs' times, problems and results", () => {
  const { runs } = staffCopy;
  expect(runs.range("09:00", "09:00")).toBe("09:00");
  expect(runs.range("09:00", "09:05")).toBe("09:00–09:05");
  const { job, anywhere, logs } = staffCopy.problems;
  for (const words of [job.couldntRead, job.nameUnknown]) {
    expect(words("jo@pauseai.uk")).toContain("jo@pauseai.uk");
  }
  expect(anywhere.sendFailed("mailing")).toContain("mailing");
  expect(logs.badBody("Postmark")).toContain("Postmark");
  expect(anywhere.charsetUnknown("x-mac")).toContain("x-mac");
});
