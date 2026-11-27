import "server-only";
import { campaignNamed, campaignPath } from "@/lib/content/campaigns";
import type { MailingRecipientValues } from "@/lib/mailings/doc";
import { displayPostcode } from "@/lib/postcodes";
import { query } from "@/lib/server/db.server";
import { siteUrl } from "@/lib/site-url.server";
import { hashOf, PAGE_DAYS } from "@/lib/supporters/email-settings.server";
import { HAS_MP, MP_FIELDS, mpLinkCampaign } from "./broadcasts";

// A copy's links to write to the reader's MP in a campaign. Each carries the
// copy's own link token, as its unsubscribe link does, never their name or
// postcode, which anyone it's forwarded to could read. The token finds the
// copy, and the copy its supporter, whose name and postcode the campaign's
// form is opened with.

/** The address of a copy's link to write to their MP in campaign `slug`, by the copy's link token. */
function writeLink(token: string, slug: string): string {
  return siteUrl(`/write/${token}/${slug}`, undefined).toString();
}

/**
 * A copy's merge values with its links to write to their MP in each
 * campaign, for someone with an MP; as they are for anyone else, who's
 * never sent a field about their MP (mpFieldSeenWithoutMp).
 */
export function withWriteLinks<Merge extends MailingRecipientValues>(merge: Merge, token: string): Merge {
  if (!merge.meets.includes(HAS_MP)) return merge;
  const links = MP_FIELDS.flatMap((field) => {
    const slug = mpLinkCampaign(field);
    return slug ? [[field, writeLink(token, slug)]] : [];
  });
  return { ...merge, values: { ...merge.values, ...Object.fromEntries(links) } };
}

/** What a campaign's form is opened with, from a link to write to their MP: their name and postcode, each if known. */
export type WriteLinkFill = { name: string | null; postcode: string | null };

/**
 * Where a link to write to their MP in campaign `slug` goes: the campaign's
 * page, with the name and postcode, written as postcodes are, of the supporter whose copy has `token`
 * after its #, which browsers never send on, so they stay out of logs. With
 * nothing after it for a token no copy has, one sent more than PAGE_DAYS
 * ago, or one whose supporter was erased. For a campaign with no page now,
 * the campaigns' own page, which leads to the first.
 */
export async function writeLinkPath(token: string, slug: string): Promise<string> {
  const campaign = campaignNamed(slug);
  if (!campaign) return "/campaigns";
  const [found] = await query<WriteLinkFill>(
    `SELECT c.merge_values ->> 'name' AS name, CASE WHEN p.basis = 'postcode' THEN p.given END AS postcode
     FROM broadcast_messages c LEFT JOIN supporter_place p ON p.supporter_id = c.supporter_id
     WHERE c.link_token_hash = $1 AND c.supporter_id IS NOT NULL
       AND coalesce(c.sent_at, now()) > now() - make_interval(days => $2)`,
    [hashOf(token), PAGE_DAYS],
  );
  const fill = new URLSearchParams();
  if (found?.name) fill.set("name", found.name);
  if (found?.postcode) fill.set("postcode", displayPostcode(found.postcode));
  const after = fill.toString();
  return after ? `${campaignPath(campaign)}#${after}` : campaignPath(campaign);
}
