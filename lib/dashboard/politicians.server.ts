import "server-only";
import { AGREED_STATUSES } from "@/lib/asks/asks";
import { campaignForAsk } from "@/lib/email-your-mp";
import { query } from "@/lib/server/db.server";
import { BY_CAMPAIGN, type CampaignMetric, type PoliticiansTiles, type SectionMetric, type Span } from "./dashboard";
import { windowCounts, type MetricSource } from "./counts.server";

// The politicians' tiles: supporters' letters sent and answered, and the
// politicians who agreed to an ask, each by campaign where it has a bar,
// leaving test MPs out.

/** Letters, statuses and their politician, so test MPs can be left out. */
const LETTERS = "letters l JOIN politicians p ON p.id = l.notable_person_id";
const STATUSES = "ask_statuses s JOIN politicians p ON p.id = s.notable_person_id";
/** The answers that agree to an ask, as SQL. */
const AGREED = AGREED_STATUSES.map((status) => `'${status}'`).join(", ");

const SOURCES: Record<SectionMetric<"politicians">, MetricSource> = {
  lettersSent: {
    from: `${LETTERS} WHERE l.kind = 'supporter' AND l.sent_at IS NOT NULL AND NOT p.is_test`,
    at: "l.sent_at",
  },
  lettersReplied: { from: `${LETTERS} WHERE l.replied_at IS NOT NULL AND NOT p.is_test`, at: "l.replied_at" },
  // Not Airtable's: it records answers from before the site, with no date.
  politiciansAgreed: {
    from: `${STATUSES} WHERE s.status IN (${AGREED}) AND s.updated_by <> 'airtable' AND NOT p.is_test`,
    at: "s.updated_at",
    count: "DISTINCT p.id",
  },
};

/** A breakdown by campaign: the rows, and the column to group by: a supporter's letter's campaign, an answer's ask. */
const CAMPAIGN_SOURCES: Record<CampaignMetric, { from: string; at: string; column: string }> = {
  lettersSent: {
    from: `${LETTERS} JOIN letters_from_supporters sl ON sl.id = l.id WHERE l.sent_at IS NOT NULL AND NOT p.is_test`,
    at: "l.sent_at",
    column: "sl.campaign",
  },
  politiciansAgreed: { from: SOURCES.politiciansAgreed.from, at: SOURCES.politiciansAgreed.at, column: "s.ask" },
};

/** The window's count by campaign, as a map. */
async function byCampaign(metric: CampaignMetric, { since, until }: Span): Promise<Record<string, number>> {
  const { from, at, column } = CAMPAIGN_SOURCES[metric];
  const rows = await query<{ campaign: string; count: number }>(
    `SELECT ${column} AS campaign, count(*)::int AS count FROM ${from} AND ${at} >= $1 AND ${at} <= $2
     GROUP BY ${column} ORDER BY ${column}`,
    [since, until],
  );
  // An answer is counted under the campaign that made its ask.
  const key = (value: string) => (metric === "politiciansAgreed" ? (campaignForAsk(value)?.slug ?? value) : value);
  return Object.fromEntries(rows.map((row) => [key(row.campaign), row.count]));
}

/** The politician who agreed in the window, if only one did. */
async function agreedMp({ since, until }: Span): Promise<number | null> {
  const { from, at } = SOURCES.politiciansAgreed;
  const rows = await query<{ id: number }>(
    `SELECT DISTINCT p.id::int AS id FROM ${from} AND ${at} >= $1 AND ${at} <= $2 LIMIT 2`,
    [since, until],
  );
  return rows.length === 1 ? rows[0].id : null;
}

/** The politicians' tiles over `span`. */
export async function politiciansTiles(span: Span): Promise<PoliticiansTiles> {
  const [counts, [letterCampaigns, signedCampaigns], signer] = await Promise.all([
    windowCounts(SOURCES, span),
    Promise.all(BY_CAMPAIGN.map((metric) => byCampaign(metric, span))),
    agreedMp(span),
  ]);
  return { counts, byCampaign: { lettersSent: letterCampaigns, politiciansAgreed: signedCampaigns }, agreedMp: signer };
}
