// The Email your MP campaigns' names, in priority order. The staff pages
// list and filter by them, and next.config.ts's redirect of plain
// /campaigns takes the first. A file of their own, with no imports, so
// neither imports each campaign's ask, letter and the form's words
// (./email-your-mp.ts).

/**
 * Each campaign's slug, which its page's address ends with
 * (app/(site)/campaigns/<slug>/page.tsx), and its name in the staff
 * interface.
 */
export const CAMPAIGN_NAMES = [
  { slug: "regulate-letter-pm", title: "Regulate AI developers now" },
  { slug: "support-sobel-bill", title: "Support the Artificial Superintelligence Bill" },
] as const;

/**
 * The other pages in the code beside a campaign's, on the site under
 * /campaigns/ and on the staff site under /staff/campaigns/, whose names a
 * campaign staff make can't take (app/(site)/campaigns/pages.test.ts).
 */
export const OTHER_CAMPAIGN_PAGES = ["briefings", "dear-sir-demis-2025", "new"];

/** The first campaign in priority order, where plain /campaigns goes. */
export const FIRST_CAMPAIGN_SLUG = CAMPAIGN_NAMES[0].slug;

/** The campaign whose slug this is, by its name, if there is one. */
export function campaignNamed(slug: string): (typeof CAMPAIGN_NAMES)[number] | undefined {
  return CAMPAIGN_NAMES.find((campaign) => campaign.slug === slug);
}

/** A campaign's page. */
export function campaignPath(campaign: { slug: string }): string {
  return `/campaigns/${campaign.slug}`;
}
