import { CAMPAIGN_NAMES } from "@/lib/content/campaigns";

// The slug of a campaign staff make, from its title: what its page's
// address ends with, and its letters are kept by.

/** The longest a slug from a title gets, before the number that makes it unique. */
const LONGEST = 60;

/**
 * The other pages in the code beside a campaign's, on the site under
 * /campaigns/ and on the staff site under /staff/campaigns/
 * (app/(site)/campaigns/pages.test.ts).
 */
export const OTHER_CAMPAIGN_PAGES = ["briefings", "dear-sir-demis-2025", "new"];

/** The names a page in the code has, which a campaign staff make never takes. */
export const CODE_PAGES: readonly string[] = [
  ...CAMPAIGN_NAMES.map((campaign) => campaign.slug),
  ...OTHER_CAMPAIGN_PAGES,
];

/**
 * A title's letters and numbers, accents taken off, in lower case with a
 * hyphen between each run of them, as the campaigns table's slugs are;
 * "campaign" for a title with none.
 */
export function slugFrom(title: string): string {
  const plain = title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const slug = (plain.match(/[a-z0-9]+/g) ?? []).join("-").slice(0, LONGEST).replace(/-$/, "");
  return slug || "campaign";
}

/** The first of `base`, `base-2`, `base-3` and on that isn't `taken`. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}
