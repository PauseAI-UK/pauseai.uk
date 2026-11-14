import { describe, expect, it } from "vitest";
import { statusOf } from "./LetterStatus";
import { lettersCopy } from "./copy";

describe("statusOf", () => {
  it("says a status in words, or one nobody knows as it's stored", () => {
    expect(statusOf("replied")).toBe(lettersCopy.letters.status.replied);
    expect(statusOf("mislaid")).toBe("mislaid");
  });
});
