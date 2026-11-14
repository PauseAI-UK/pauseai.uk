import { expect, it } from "vitest";
import { serverCopy } from "./copy";

it("words the problems", () => {
  const { anywhere, logs } = serverCopy.problems;
  expect(logs.badBody("Postmark")).toContain("Postmark");
  expect(anywhere.charsetUnknown("x-mac")).toContain("x-mac");
});
