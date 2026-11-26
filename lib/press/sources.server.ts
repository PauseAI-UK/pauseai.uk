import "server-only";
import { query } from "@/lib/server/db.server";
import { askClaude, CAREFUL_MODEL } from "@/lib/server/outside-services/anthropic.server";
import { orFallback } from "@/lib/server/outside-services/fallback.server";
import { pressProblems } from "./copy";
import { readSources, SOURCES_SCHEMA, SOURCES_SYSTEM, sourcesPrompt, type Source, type Tier } from "./sources";

// The news sites the press survey meets (press_sources): each asked of
// Claude once, the first time it turns up, for its kind, and so its tier, and the outlet on
// /press it is (sources.ts), and kept.

/** A site's tier, none if Claude didn't know it, and the outlet on /press it is, if one is. */
export type SourceOf = { tier: Tier | null; outletId: number | null };

/**
 * Asks Claude about each of `sources` the survey hasn't met before, in one
 * request, and keeps what it says. If Claude can't be asked, or doesn't
 * answer for a site, the site is asked about again the next time it's met.
 */
export async function judgeSources(sources: Source[]): Promise<void> {
  const bySite = new Map(sources.map((source) => [source.site, source]));
  const met = await query<{ site: string }>("SELECT site FROM press_sources WHERE site = ANY($1::text[])", [
    [...bySite.keys()],
  ]);
  for (const { site } of met) bySite.delete(site);
  const asked = [...bySite.values()];
  if (asked.length === 0) return;
  const outlets = (await query<{ name: string }>("SELECT name FROM press_outlets ORDER BY name COLLATE english")).map(
    (o) => o.name,
  );
  const judged = await orFallback(pressProblems.sourcesNotJudged({ sites: asked.length }), [], async () =>
    readSources(
      await askClaude({
        system: SOURCES_SYSTEM,
        prompt: sourcesPrompt(asked, outlets),
        schema: SOURCES_SCHEMA,
        model: CAREFUL_MODEL,
      }),
      asked,
      outlets,
    ),
  );
  for (const judgement of judged) {
    await query(
      `INSERT INTO press_sources (site, name, kind, tier, outlet_id, reason)
       VALUES ($1, $2, $3, $4, (SELECT id FROM press_outlets WHERE name = $5), $6) ON CONFLICT (site) DO NOTHING`,
      [
        judgement.site,
        bySite.get(judgement.site)!.name,
        judgement.kind,
        judgement.tier,
        judgement.sameAs,
        judgement.reason,
      ],
    );
  }
}

/** What's kept of each of `sites` the survey has met. */
export async function sourcesOf(sites: string[]): Promise<Map<string, SourceOf>> {
  const rows = await query<SourceOf & { site: string }>(
    `SELECT site, tier, outlet_id::int AS "outletId" FROM press_sources WHERE site = ANY($1::text[])`,
    [sites],
  );
  return new Map(rows.map(({ site, ...source }) => [site, source]));
}
