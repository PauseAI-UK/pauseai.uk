import { describe, expect, it } from "vitest";
import { staffCopy } from "./staff-interface";

describe("staff interface copy", () => {
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

it("words the problems", () => {
  const { anywhere, logs } = staffCopy.problems;
  expect(anywhere.sendFailed("mailing")).toContain("mailing");
  expect(logs.badBody("Postmark")).toContain("Postmark");
  expect(anywhere.charsetUnknown("x-mac")).toContain("x-mac");
});
