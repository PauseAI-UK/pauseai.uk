import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPAIGN_NAMES } from "@/lib/content/campaigns";
import { OTHER_CAMPAIGN_PAGES } from "@/lib/mailings/campaign-slug";
import { campaigns } from "@/lib/content/email-your-mp";

// A campaign's page can move on to another's, and goes on to writing the
// letter, its preview and then "sent", so each campaign must have all four.
describe("campaign pages", () => {
  it("exist for every campaign, with its preview and sent pages", () => {
    for (const { slug } of campaigns) {
      for (const page of ["page.tsx", "write/page.tsx", "preview/page.tsx", "sent/page.tsx"])
        expect(existsSync(join(import.meta.dirname, slug, page)), `${slug}/${page}`).toBe(true);
    }
  });

  // A campaign staff make takes its page from app/(site)/campaigns/[slug], and its staff pages from
  // /staff/campaigns/[slug], so never a name a page in the code has beside them (lib/mailings/campaign-slug.ts).
  it("name every page beside a campaign's, so a campaign staff make doesn't take its name", () => {
    const staff = join(import.meta.dirname, "..", "..", "(staff)", "staff", "(signed-in)", "campaigns");
    const beside = [import.meta.dirname, staff].flatMap((dir) =>
      readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !/^[_[(]/.test(entry.name))
        .map((entry) => entry.name),
    );
    const named = new Set<string>([...CAMPAIGN_NAMES.map((campaign) => campaign.slug), ...OTHER_CAMPAIGN_PAGES]);
    expect(beside.filter((name) => !named.has(name))).toEqual([]);
    expect(OTHER_CAMPAIGN_PAGES.filter((name) => !beside.includes(name))).toEqual([]);
  });
});
