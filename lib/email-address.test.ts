import { describe, expect, it } from "vitest";
import { looksLikeEmail } from "./email-address";

describe("looksLikeEmail", () => {
  it("catches emails that are obviously wrong", () => {
    expect(looksLikeEmail("jane@example.com")).toBe(true);
    expect(looksLikeEmail("jane@example")).toBe(false);
    expect(looksLikeEmail("jane example.com")).toBe(false);
  });
});
