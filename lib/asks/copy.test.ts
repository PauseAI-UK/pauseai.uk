import { expect, it } from "vitest";
import { asksCopy } from "./copy";

it("names the ask being edited", () => {
  expect(asksCopy.asks.editTitle("Winter reception")).toContain("Winter reception");
});
