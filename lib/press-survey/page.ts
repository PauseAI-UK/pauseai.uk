// What the survey reads from an article's page: its own title, outlet and
// date where the page gives them, the captions of its pictures (some
// coverage names us only under a photo of our protest), and its text. The
// page is untrusted and may be anything, so this reads it with patterns,
// not a parser that runs it, and keeps only short excerpts.

import { decodeEntities } from "./sources.ts";

export type Page = {
  title?: string;
  siteName?: string;
  /** YYYY-MM-DD, from the page's own published date. */
  published?: string;
  /** Picture captions and alt text. */
  captions: string[];
  /** The page's visible text, as one line. */
  text: string;
};

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function attributes(tag: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, name, , double, single] of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    found.set(name.toLowerCase(), decodeEntities(double ?? single).trim());
  }
  return found;
}

/** The YYYY-MM-DD at the start of a date the page gives, if it has one. */
function day(value: string | undefined): string | undefined {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
}

/** What `html` says about itself. */
export function readPage(html: string): Page {
  const meta = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(tag);
    const name = attrs.get("property") ?? attrs.get("name") ?? attrs.get("itemprop");
    const content = attrs.get("content");
    if (name && content && !meta.has(name.toLowerCase())) meta.set(name.toLowerCase(), content);
  }

  const captions = [
    ...[...html.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi)].map(([, inner]) => textOf(inner)),
    ...[...html.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => attributes(tag).get("alt") ?? ""),
    meta.get("og:image:alt") ?? "",
  ].filter((caption, i, all) => caption.length > 0 && all.indexOf(caption) === i);

  const body = html
    .replace(/<head\b[\s\S]*?<\/head>/gi, " ")
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const title = meta.get("og:title") ?? /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];

  return {
    title: title ? textOf(title) : undefined,
    siteName: meta.get("og:site_name"),
    published:
      day(meta.get("article:published_time")) ??
      day(meta.get("datepublished")) ??
      day(/"datePublished"\s*:\s*"([^"]+)"/.exec(html)?.[1]),
    captions,
    text: textOf(body),
  };
}

/**
 * The passages of `text` around each match of `pattern` (which must be
 * global), `width` characters either side, overlapping ones joined, at most
 * `most` of them.
 */
export function excerpts(text: string, pattern: RegExp, width = 250, most = 4): string[] {
  const spans: [number, number][] = [];
  for (const match of text.matchAll(pattern)) {
    const start = Math.max(0, match.index - width);
    const end = Math.min(text.length, match.index + match[0].length + width);
    const last = spans.at(-1);
    if (last && start <= last[1]) last[1] = end;
    else spans.push([start, end]);
  }
  return spans.slice(0, most).map(([start, end]) => text.slice(start, end).trim());
}
