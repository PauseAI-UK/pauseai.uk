import { describe, expect, it } from "vitest";
import { noFake } from "./none";

describe("noFake", () => {
  it("answers nothing, so a fixture build's call gets the fetch's 404", () => {
    expect(noFake(new URL("https://example.com/.netlify/functions/x"), undefined, undefined)).toBeUndefined();
  });
});
