import { expect, it } from "vitest";
import { oversightCopy } from "./copy";

it("puts the number in the audit log's total", () => {
  expect(oversightCopy.changes.total(7)).toContain("7");
});

it("names what each change counts", () => {
  for (const [key, say] of Object.entries(oversightCopy.changes.counts)) expect(say(2), key).not.toBe("");
});
