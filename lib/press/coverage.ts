// PauseAI UK's press coverage as /press shows it: each piece with its
// outlet's name, read from press_coverage and press_outlets
// (coverage.server.ts). Pure, so the page's tests and the gallery pass
// their own.

export const MEDIA = ["Article", "Video", "Photos"] as const;
export type Medium = (typeof MEDIA)[number];

/** An outlet's political lean, from AllSides, Ad Fontes and Media Bias/Fact Check where they rate it. */
export const LEANS = ["Left", "Lean Left", "Center", "Lean Right", "Right"] as const;

/** Shown on /press, or taken off it by staff. */
export const COVERAGE_STATES = ["shown", "removed"] as const;

/** One piece of coverage, as /press's table lists it. */
export type CoverageItem = {
  id: number;
  outlet: string;
  title: string;
  medium: Medium;
  /** A piece in one place. A piece cross-posted across platforms has `links` instead. */
  url?: string;
  links?: { label: string; url: string }[];
  /** YYYY-MM-DD; undated pieces sort last. */
  date?: string;
};

/**
 * Each outlet's first piece in `items`, by id: on /press, newest first, the
 * row that carries the outlet's anchor (outletAnchor in
 * lib/content/press-logos.ts), so its homepage logo lands on its newest.
 */
export function firstOfEachOutlet(items: CoverageItem[]): Set<number> {
  const seen = new Set<string>();
  const first = new Set<number>();
  for (const item of items) {
    if (seen.has(item.outlet)) continue;
    seen.add(item.outlet);
    first.add(item.id);
  }
  return first;
}

/** "3 Mar 2026" for a piece's date, or a dash when it has none. */
export function formatCoverageDate(date?: string) {
  return date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "—";
}
