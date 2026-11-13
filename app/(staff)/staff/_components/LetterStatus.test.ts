import { describe, expect, it } from "vitest";
import { staffCopy } from "@/lib/content/staff-interface";
import { statusOf } from "./LetterStatus";

describe("statusOf", () => {
  it("says a status in words, or one nobody knows as it's stored", () => {
    expect(statusOf("replied")).toBe(staffCopy.letters.status.replied);
    expect(statusOf("mislaid")).toBe("mislaid");
  });
});
