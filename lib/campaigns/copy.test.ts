import { expect, it } from "vitest";
import { campaignsCopy } from "./copy";

it("names the ask being edited", () => {
  expect(campaignsCopy.asks.editTitle("Winter reception")).toContain("Winter reception");
});
