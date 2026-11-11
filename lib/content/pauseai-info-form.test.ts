import { describe, expect, it } from "vitest";
import { FORM_VERSIONS, formVersionAt } from "./pauseai-info-form";

describe("the form's versions", () => {
  it("takes the one live then, ten minutes after its commit, or the first for one before them", () => {
    const [first, second] = FORM_VERSIONS;
    expect(formVersionAt(new Date("2020-01-01T00:00:00Z"))).toBe(first);
    const committed = new Date(second.committedAt).getTime();
    expect(formVersionAt(new Date(committed + 9 * 60_000))).toBe(first);
    expect(formVersionAt(new Date(committed + 10 * 60_000))).toBe(second);
  });

  it("has no version with the words and subject of the one before, which would show as the same letter twice", () => {
    FORM_VERSIONS.forEach((version, i) => {
      const before = FORM_VERSIONS[i - 1];
      if (before) expect([version.subject, version.text]).not.toEqual([before.subject, before.text]);
    });
  });
});
