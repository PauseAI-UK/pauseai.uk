// What the press survey searches Google News for, a week at a time, and
// the finds it reads from Google's answer. Nothing here fetches: Google
// News's binding does (lib/server/outside-services/google-news.server.ts),
// so these run in tests on stored answers.

import { cleanUrl, hostOf } from "./urls.ts";

/** Google News searches: our name, our name with UK, and our director, as the coverage quotes him. */
export const QUERIES = ['"PauseAI" OR "Pause AI"', '"PauseAI UK" OR "Pause AI UK"', '"Joseph Miller" AI'];

/** A piece Google News found. */
export type Found = {
  title: string;
  /** Google's link to it, which the survey decodes to the article's own address. */
  googleLink: string;
  /** The outlet's name, as Google gives it. */
  outlet?: string;
  /** The outlet's site, from Google's source address, else the link's. */
  domain: string;
  /** YYYY-MM-DD, Google's publish date. */
  date?: string;
};

/** What a search answered: its finds, or why it gave none. */
export type SearchAnswer = { found: Found[]; error?: string };

/** A search's window: after `after` and before `before`, both YYYY-MM-DD, as Google's operators take them. */
export type Window = { after: string; before: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The windows to search, a week each, from the day after `searchedTo` to
 * `today`, both YYYY-MM-DD. Each starts the day before, as Google counts
 * `after:` from the end of that day, and each runs to the day after it ends,
 * as `before:` is up to its start; the overlap is found once, by its link.
 */
export function windows(searchedTo: string, today: string, days = 7): Window[] {
  const found: Window[] = [];
  const end = Date.parse(`${today}T00:00:00Z`);
  for (let start = Date.parse(`${searchedTo}T00:00:00Z`); start < end; start += days * DAY_MS) {
    const stop = Math.min(start + days * DAY_MS, end);
    found.push({ after: day(new Date(start)), before: day(new Date(stop + DAY_MS)) });
  }
  return found;
}

/** `query` within `window`, as Google News's search takes it. */
export function inWindow(query: string, { after, before }: Window): string {
  return `${query} after:${after} before:${before}`;
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
export function readGoogleNews(xml: string): SearchAnswer {
  if (!xml.includes("<rss")) return { found: [], error: xml.trim().slice(0, 200) || "an empty answer" };
  const found = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(([, item]): Found[] => {
    const link = element(item, "link").text;
    const googleLink = link && cleanUrl(link);
    if (!googleLink) return [];
    const source = element(item, "source");
    const outlet = source.text || undefined;
    const sourceUrl = /url="([^"]+)"/.exec(source.attributes)?.[1];
    const title = element(item, "title").text ?? "";
    const published = element(item, "pubDate").text;
    const time = published ? Date.parse(published) : NaN;
    return [
      {
        title: outlet && title.endsWith(` - ${outlet}`) ? title.slice(0, -` - ${outlet}`.length) : title,
        googleLink,
        outlet,
        domain: sourceUrl && URL.canParse(sourceUrl) ? hostOf(sourceUrl) : hostOf(googleLink),
        date: Number.isNaN(time) ? undefined : new Date(time).toISOString().slice(0, 10),
      },
    ];
  });
  return { found };
}
