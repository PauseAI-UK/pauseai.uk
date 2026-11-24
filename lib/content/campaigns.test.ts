import { describe, expect, it } from "vitest";
import { campaignNamed, campaignPath } from "./campaigns";

describe("campaignNamed", () => {
  it("finds a campaign by its slug, and nothing for another", () => {
    expect(campaignNamed("support-sobel-bill")?.title).toBe("Support the Artificial Superintelligence Bill");
    expect(campaignNamed("no-such-campaign")).toBeUndefined();
  });
});

describe("campaignPath", () => {
  it("is the campaign's page", () => {
    expect(campaignPath({ slug: "support-sobel-bill" })).toBe("/campaigns/support-sobel-bill");
  });
});
