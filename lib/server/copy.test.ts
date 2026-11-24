import { expect, it } from "vitest";
import { publicText } from "@/lib/problems";
import { serverProblems } from "./copy";

it("words the problems", () => {
  expect(serverProblems.badBody({ from: "Postmark" }).what).toContain("Postmark");
  expect(serverProblems.charsetUnknown({ charset: publicText("x-mac") }).what).toContain("x-mac");
});
