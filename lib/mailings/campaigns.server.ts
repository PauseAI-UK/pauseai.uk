import "server-only";
import { LETTER_STATES, letterStateSql, type CountedLetterState } from "./copy-states";
import { cache } from "react";
import { campaignBySlug } from "@/lib/email-your-mp";
import { FORM_VERSIONS, formVersionAt } from "@/lib/content/pauseai-info-form";
import { query } from "@/lib/server/db.server";

// A campaign is like a mailing, from supporters rather than PauseAI: its list
// and its page's counts, and each version of its text with how many letters
// were written from it (lib/mailings/campaign-versions.ts turns them into documents).

export type CampaignSummary = {
  slug: string;
  title: string;
  ask: string | null;
  askTitle: string | null;
  askKind: string | null;
  url: string | null;
  /** All its letters, and how many are in each state (LETTER_STATES). */
  letters: number;
  states: Record<CountedLetterState, number>;
  /** The politicians who have answered its ask. */
  answered: number;
  /** How many politicians it wrote to, and supporters wrote. */
  politicians: number;
  supporters: number;
  firstAt: Date | null;
  lastAt: Date | null;
};

/** Whether the politician of a campaign `c`'s letter `l` has answered its ask, in SQL. */
const CAMPAIGN_ANSWERED =
  "EXISTS (SELECT 1 FROM ask_statuses st WHERE st.notable_person_id = l.notable_person_id AND st.ask = c.ask)";

/** A campaign `c`'s letter `l`'s state (letterStateSql). */
export const CAMPAIGN_LETTER_STATE = letterStateSql(CAMPAIGN_ANSWERED);

const SELECT_CAMPAIGNS = `
  SELECT c.slug, c.title, c.ask, a.title AS "askTitle", a.kind AS "askKind", c.url,
    count(l.id)::int AS letters,
    json_build_object(${LETTER_STATES.map((one) => `'${one}', count(l.id) FILTER (WHERE ls.state = '${one}')`).join(", ")}) AS states,
    count(DISTINCT l.notable_person_id) FILTER (WHERE ${CAMPAIGN_ANSWERED})::int AS answered,
    count(DISTINCT l.notable_person_id)::int AS politicians,
    count(DISTINCT lower(trim(f.email)))::int AS supporters,
    min(l.created_at) AS "firstAt", max(l.created_at) AS "lastAt"
  FROM campaigns c LEFT JOIN asks a ON a.slug = c.ask LEFT JOIN letters_from_supporters s ON s.campaign = c.slug
    LEFT JOIN letters l ON l.id = s.id LEFT JOIN form_entries f ON f.id = s.entry_id
    LEFT JOIN LATERAL (SELECT ${CAMPAIGN_LETTER_STATE} AS state) ls ON true`;

/** Every campaign, the most recent letter's first, those with none last. */
export async function listCampaignSummaries(): Promise<CampaignSummary[]> {
  return query<CampaignSummary>(
    `${SELECT_CAMPAIGNS} GROUP BY c.slug, a.title, a.kind ORDER BY max(l.created_at) DESC NULLS LAST, c.slug`,
  );
}

/** One campaign's counts, or undefined for none. */
export const getCampaignSummary = cache(async function getCampaignSummary(
  slug: string,
): Promise<CampaignSummary | undefined> {
  const [campaign] = await query<CampaignSummary>(
    `${SELECT_CAMPAIGNS} WHERE c.slug = $1 GROUP BY c.slug, a.title, a.kind`,
    [slug],
  );
  return campaign;
});

/** A version of a campaign's text, with how many letters were written from it. */
export type CampaignVersion = { key: string; from: Date | null; letters: number; subject: string; text: string };

/** A campaign's versions, counted from its letters' dates, and how many of its letters changed the wording. */
export async function campaignVersions(slug: string): Promise<{ versions: CampaignVersion[]; changed: number }> {
  const rows = await query<{ at: Date; own: number | null }>(
    `SELECT l.created_at AS at, s.own_words AS own FROM letters_from_supporters s JOIN letters l USING (id) WHERE s.campaign = $1`,
    [slug],
  );
  const changed = rows.filter(({ own }) => (own ?? 0) > 0).length;
  const code = campaignBySlug(slug);
  if (code) {
    const text = code.letter({
      salutation: "{salutation}",
      constituency: "{constituency}",
      senderName: "{name}",
      statuses: {},
    });
    return { versions: [{ key: slug, from: null, letters: rows.length, subject: code.subject, text }], changed };
  }
  const counted = new Map<string, number>();
  for (const { at } of rows) {
    const { commit } = formVersionAt(at);
    counted.set(commit, (counted.get(commit) ?? 0) + 1);
  }
  const versions = FORM_VERSIONS.filter((version) => counted.has(version.commit))
    .map((version) => ({
      key: version.commit,
      from: new Date(version.committedAt),
      letters: counted.get(version.commit)!,
      subject: version.subject,
      text: version.text,
    }))
    .reverse();
  return { versions, changed };
}
