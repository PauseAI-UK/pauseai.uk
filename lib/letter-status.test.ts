import { describe, expect, it } from "vitest";
import { ARRIVED, isIn, LETTER_STATUSES, MAILED, NEVER_WENT, statusIn } from "./letter-status";

describe("letter statuses", () => {
  it("tells whether a status is one of a set", () => {
    expect(isIn("sent", ARRIVED)).toBe(true);
    expect(isIn("bounced", ARRIVED)).toBe(false);
  });

  it("writes a set as SQL", () => {
    expect(statusIn("l.status", ARRIVED)).toBe("l.status IN ('sent', 'spam_complaint')");
  });

  it("counts every status as one that never went or one that went or is going", () => {
    const either = LETTER_STATUSES.filter((status) => isIn(status, NEVER_WENT) || isIn(status, MAILED));
    expect(either).toEqual(LETTER_STATUSES);
  });
});
