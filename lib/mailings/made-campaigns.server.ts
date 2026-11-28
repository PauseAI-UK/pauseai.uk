import "server-only";
import { cache } from "react";
import type { Campaign } from "@/lib/content/email-your-mp";
import { campaignBySlug } from "@/lib/email-your-mp";
import { query, transaction } from "@/lib/server/db.server";
import { CODE_PAGES, slugFrom, uniqueSlug } from "./campaign-slug";
import type { MailingDoc } from "./doc";

// The campaigns staff make on the staff site, with no code (`created_by` in
// campaigns): each its title over the form at /campaigns/<slug>, with no
// words or attachments of its own, and its letter in campaign_letters. Never
// in the order the site moves people on in, which is the code's.

/** A campaign staff made, as the site's pages and the form take it; undefined for any other. Once a request. */
export const madeCampaign = cache(async function madeCampaign(slug: string): Promise<Campaign | undefined> {
  const [row] = await query<{ slug: string; title: string; ask: string | null }>(
    "SELECT slug, title, ask FROM campaigns WHERE slug = $1 AND created_by IS NOT NULL",
    [slug],
  );
  return row && { slug: row.slug, title: row.title, ...(row.ask && { ask: row.ask }), attachments: [] };
});

/**
 * A campaign with a page on the site, whose letter staff write: one in the
 * code, or one they made; undefined for pauseai.info's old ones, and any
 * other slug.
 */
export async function siteCampaign(slug: string): Promise<Campaign | undefined> {
  return campaignBySlug(slug) ?? (await madeCampaign(slug));
}

/** What New campaign makes: the campaign, and its letter's first draft. */
export type NewCampaign = { title: string; ask: string | null; subject: string; body: MailingDoc };

/**
 * Makes a campaign by `by`, with its slug from its title, one no campaign
 * or page in the code has, and its letter's draft; says the slug.
 */
export async function createCampaign(made: NewCampaign, by: string): Promise<string> {
  return transaction(async (db) => {
    // Two made at once with one title wait for each other, so they take two slugs.
    await query("LOCK TABLE campaigns IN SHARE ROW EXCLUSIVE MODE", [], db);
    const rows = await query<{ slug: string }>("SELECT slug FROM campaigns", [], db);
    const slug = uniqueSlug(slugFrom(made.title), new Set([...CODE_PAGES, ...rows.map((row) => row.slug)]));
    await query(
      "INSERT INTO campaigns (slug, title, ask, created_by, created_at) VALUES ($1, $2, $3, $4, now())",
      [slug, made.title, made.ask, by],
      db,
    );
    await query(
      "INSERT INTO campaign_letters (campaign, subject, body, updated_by) VALUES ($1, $2, $3, $4)",
      [slug, made.subject, JSON.stringify(made.body), by],
      db,
    );
    return slug;
  });
}
