// What Claude is asked of each news site the press survey hasn't met: what
// kind of source it is, from which its tier follows (KINDS), and which
// outlet already on /press it is, if one is. Claude is asked for the kind,
// not the tier, as its kinds come out the same from one asking to the next,
// where its tiers swayed with the wording. Asked once a site, and kept in press_sources
// (sources.server.ts). Nothing here asks: these are the request's words and
// the check of its answer, which run in tests on stored answers.

/** A site the survey has met: its host, without "www.", and its name as Google News gives it. */
export type Source = { site: string; name: string };

/** Claude's answer for a site: its kind and tier, none if it didn't know the site; the outlet it is, by name; and why. */
export type SourceJudgement = {
  site: string;
  kind: SourceKind | null;
  tier: Tier | null;
  sameAs: string | null;
  reason: string;
};

/** Tiers, from the most worth to us to the least. A site with none is taken as TIER_UNKNOWN. */
export const TIERS = [1, 2, 3, 4] as const;
export type Tier = (typeof TIERS)[number];
export const TIER_UNKNOWN: Tier = 3;

/**
 * Each kind of source, and its tier: 1, UK national news; 2, major news
 * elsewhere and the news agencies, whoever owns them; 3, other real
 * journalism; 4, what isn't independent journalism, whose finds are removed.
 */
export const KINDS = {
  "uk-national": 1,
  international: 2,
  "news-agency": 2,
  "uk-regional": 3,
  "local-elsewhere": 3,
  specialist: 3,
  student: 3,
  "state-media": 4,
  "press-release": 4,
  "content-farm": 4,
  aggregator: 4,
  "finance-crypto": 4,
  "photo-agency": 4,
} as const satisfies Record<string, Tier>;
export type SourceKind = keyof typeof KINDS;
export const SOURCE_KINDS = Object.keys(KINDS) as SourceKind[];

export const SOURCES_SYSTEM = `You sort news sources for PauseAI UK, a campaign group whose staff record the press coverage it gets. Two questions for each source.

1. What kind of source it is, one of:
- "uk-national": a UK national broadcaster (BBC, ITV, Channel 4, Sky, GB News, TalkTV), a UK national paper or its website, or a UK national weekly magazine of news and politics.
- "international": a major news outlet outside the UK, with a national or international audience: national papers, broadcasters and news magazines, big city papers such as the Boston Globe, and big online news such as Axios, Vox, Business Insider, Politico and Wired.
- "news-agency": a news agency whose stories other outlets run, whoever owns it: Reuters, AP, AFP, EFE, Anadolu, Xinhua.
- "uk-regional": a UK regional or local paper, broadcaster or news site.
- "local-elsewhere": a local or regional paper, broadcaster or news site outside the UK.
- "specialist": smaller trade, technology, science, culture or politics press, or a small independent news site, that does its own journalism.
- "student": a student paper.
- "state-media": a paper or broadcaster that exists to put a government's message out, rather than to report: RT, CGTN, Global Times, Turkey's pro-government papers such as Yeni Şafak, A News and Daily Sabah. A news agency is "news-agency", whoever owns it. A paper a government owns that reports the news is "international".
- "press-release": a site that publishes press releases.
- "content-farm": a site of SEO, sponsored or machine-written articles.
- "aggregator": a site that republishes others' stories: Yahoo, MSN, AOL, or a site copying an agency's.
- "finance-crypto": a crypto, trading or stock-tips site.
- "photo-agency": a photo agency's or distributor's pages of pictures for sale, such as Reuters Connect or Imago.
- "unknown": you don't know the source and can't tell from its name and site. Never guess.

2. Whether it's one of the outlets already on the list, under another name: the same publication, as "BBC News" is "BBC" and "time.com" is "TIME". A different publication with a similar name isn't: "The Times" isn't "TIME", the Irish "Independent.ie" isn't the British "The Independent", and an edition in another country ("Wired Italia") isn't the main one. A photo agency's or distributor's page of another outlet's pictures isn't that outlet: "Reuters Connect (Anadolu Agency)" isn't Anadolu. Give the listed name exactly, or null.`;

export const SOURCES_SCHEMA = {
  type: "object",
  properties: {
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          kind: { type: "string", enum: [...SOURCE_KINDS, "unknown"] },
          sameAs: { anyOf: [{ type: "string" }, { type: "null" }] },
          why: { type: "string" },
        },
        required: ["id", "kind", "sameAs", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["sources"],
  additionalProperties: false,
} as const;

/** The request about `sources`, each by its place in the list, beside the outlets on /press. */
export function sourcesPrompt(sources: Source[], outlets: string[]): string {
  const listed = sources.map((source, i) => ({ id: String(i), name: source.name, site: source.site }));
  return `The outlets already on the list:\n<outlets>${JSON.stringify(outlets)}</outlets>\n\nThe sources:\n<sources>${JSON.stringify(listed)}</sources>`;
}

/**
 * Claude's answer about `sources`, checked: a judgement for each source it
 * answered for, by its place in the list. A kind that isn't one of KINDS,
 * or an outlet that isn't one of `outlets`, is taken as none, and an answer
 * it gave twice as its first.
 */
export function readSources(answer: unknown, sources: Source[], outlets: string[]): SourceJudgement[] {
  const listed = (answer as { sources?: unknown })?.sources;
  if (!Array.isArray(listed)) return [];
  const judged = new Map<number, SourceJudgement>();
  for (const item of listed as { id?: unknown; kind?: unknown; sameAs?: unknown; why?: unknown }[]) {
    const source = sources[Number(item?.id)];
    if (!source || judged.has(Number(item.id))) continue;
    const kind = SOURCE_KINDS.find((k) => k === item.kind) ?? null;
    const sameAs = typeof item.sameAs === "string" && outlets.includes(item.sameAs) ? item.sameAs : null;
    judged.set(Number(item.id), {
      site: source.site,
      kind,
      tier: kind && KINDS[kind],
      sameAs,
      reason: String(item.why ?? "").slice(0, 300),
    });
  }
  return [...judged.values()];
}

/**
 * Whether a headline names us, rather than using the phrase: "PauseAI", or
 * "Pause AI" in capitals but not after "to" ("calls to pause AI", "Calls To
 * Pause AI"), or one of our people by name.
 */
export function namesUs(headline: string, people: readonly string[]): boolean {
  if (/\bPauseAI\b/.test(headline) || /(?<!\b[Tt]o )\bPause AI\b/.test(headline)) return true;
  return people.some((person) => headline.toLowerCase().includes(person.toLowerCase()));
}
