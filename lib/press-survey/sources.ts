// The two places the survey looks for coverage, both free and keyless:
//
// - GDELT's DOC 2.0 API (https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/),
//   a full-text search of news it has seen, which gives each article's own
//   URL. It allows one request every five seconds, and answers 429 with a
//   line of text rather than JSON when asked faster, or when the address
//   it's asked from is busy.
// - Google News's RSS search, whose links are news.google.com redirects to
//   a page that resolves them in script, so the article's text can't be
//   read from them. Its items name their outlet, which GDELT's don't.
//
// Each gives the same `Lead`. Nothing here fetches: these build the request
// URLs and read the answers, so the tests run on stored answers.

import { cleanUrl, hostOf } from "./urls.ts";

export type Lead = {
  title: string;
  /** The article, or for Google News a redirect to it (`direct` false). */
  url: string;
  direct: boolean;
  domain: string;
  /** The outlet's name, where the source gives one. */
  outlet?: string;
  /** YYYY-MM-DD: when GDELT first saw it, or Google News's publish date. */
  date?: string;
  /** GDELT's country for the outlet, e.g. "United Kingdom". */
  country?: string;
  source: "GDELT" | "Google News";
};

/** A search's answer: its leads, or why it gave none. */
export type SourceAnswer = { leads: Lead[]; error?: string };

const GDELT = "https://api.gdeltproject.org/api/v2/doc/doc";

/** GDELT's search for `query` over the last `timespan` (e.g. "7d"), up to its maximum of 250 articles. */
export function gdeltUrl(query: string, timespan = "7d"): string {
  const params = new URLSearchParams({ query, mode: "artlist", format: "json", maxrecords: "250", timespan });
  return `${GDELT}?${params}`;
}

type GdeltArticle = { url: string; title: string; seendate: string; domain: string; sourcecountry?: string };

/** GDELT's answer, which is JSON with `articles`, `{}` for none, or a line of text saying what's wrong. */
export function readGdelt(body: string): SourceAnswer {
  const text = body.trim();
  if (!text.startsWith("{")) return { leads: [], error: text.split(/(?<=\.)\s/)[0].slice(0, 200) || "an empty answer" };
  const { articles = [] } = JSON.parse(text) as { articles?: GdeltArticle[] };
  const leads = articles.flatMap((article): Lead[] => {
    const url = cleanUrl(article.url);
    if (!url) return [];
    const day = /^(\d{4})(\d{2})(\d{2})/.exec(article.seendate);
    return [
      {
        title: article.title.replace(/\s+/g, " ").trim(),
        url,
        direct: true,
        domain: article.domain.toLowerCase().replace(/^www\./, ""),
        date: day ? `${day[1]}-${day[2]}-${day[3]}` : undefined,
        country: article.sourcecountry || undefined,
        source: "GDELT",
      },
    ];
  });
  return { leads };
}

/** Google News's RSS search for `query`, in British English. Add `when:7d` to the query for the last week. */
export function googleNewsUrl(query: string): string {
  const params = new URLSearchParams({ q: query, hl: "en-GB", gl: "GB", ceid: "GB:en" });
  return `https://news.google.com/rss/search?${params}`;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

/** `text` with XML and HTML character references replaced by the characters they stand for. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return String.fromCodePoint(code);
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

function element(xml: string, name: string): { text?: string; attributes: string } {
  const match = new RegExp(`<${name}(\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  if (!match) return { attributes: "" };
  const text = match[2].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1");
  return { text: decodeEntities(text).trim(), attributes: match[1] ?? "" };
}

/** Google News's RSS answer. Each item's title ends " - <outlet>", which is taken off. */
export function readGoogleNews(xml: string): SourceAnswer {
  if (!xml.includes("<rss")) return { leads: [], error: xml.trim().slice(0, 200) || "an empty answer" };
  const leads = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(([, item]): Lead[] => {
    const link = element(item, "link").text;
    const url = link && cleanUrl(link);
    if (!url) return [];
    const source = element(item, "source");
    const outlet = source.text || undefined;
    const sourceUrl = /url="([^"]+)"/.exec(source.attributes)?.[1];
    const title = element(item, "title").text ?? "";
    const published = element(item, "pubDate").text;
    const time = published ? Date.parse(published) : NaN;
    return [
      {
        title: outlet && title.endsWith(` - ${outlet}`) ? title.slice(0, -` - ${outlet}`.length) : title,
        url,
        direct: false,
        domain: sourceUrl && URL.canParse(sourceUrl) ? hostOf(sourceUrl) : hostOf(url),
        outlet,
        date: Number.isNaN(time) ? undefined : new Date(time).toISOString().slice(0, 10),
        source: "Google News",
      },
    ];
  });
  return { leads };
}
