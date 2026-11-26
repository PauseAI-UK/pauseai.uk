// What the survey reads from an article's page: its own title, outlet and
// date where the page gives them, the captions of its pictures (some
// coverage names us only under a photo of our protest), and its text.
//
// The text and captions are the article's own, as Mozilla's Readability
// finds it (https://github.com/mozilla/readability, Firefox's reader view):
// without the page's menus, tickers, sidebars and lists of other stories,
// which on some sites name us in every page's header. A page Readability
// doesn't take for an article, such as a photo agency's, is read whole.
// The page is untrusted and may be anything: linkedom parses it without
// running its scripts or loading what it links to, and only short
// excerpts are kept.
//
// linkedom rather than jsdom: it is ES modules throughout, so it's bundled
// with the server's code. jsdom is kept out of the bundle and loaded by
// Node, and part of it is an ES module loaded with require(), which AWS
// Lambda's Node refuses, so it can't load on Netlify
// (tests/checks/lambda-require.test.ts).

import { isProbablyReaderable, Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { decodeEntities } from "./search.ts";

/** Past this many elements a page is an application, not an article, and Readability would refuse it. */
const MOST_ELEMENTS = 30_000;

/**
 * Less than this is a headline, not an article's text: Readability takes
 * the wrong part of some pages (Anadolu's, which then give it only the
 * headline), and those are read whole.
 */
export const LEAST_ARTICLE = 500;

export type Page = {
  title?: string;
  siteName?: string;
  /** Its og:type, such as "article" or "video.other". */
  type?: string;
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

/**
 * The article's own HTML and text in `html`, as Readability reads it; none if it isn't an article, or it found only a
 * headline. Its `</body>` and `</html>` are taken out first: some pages close them early, ahead of the article, and a
 * browser reads on regardless, but linkedom ends the document there and leaves the rest outside its body, where
 * Readability fails. Both tags are optional in HTML, so the page means the same without them.
 */
function articleIn(html: string): { content: string; text: string } | undefined {
  const { document } = parseHTML(html.replace(/<\/(?:body|html)\s*>/gi, ""));
  // Counted with querySelectorAll, as linkedom's getElementsByTagName("*") finds none.
  if (document.querySelectorAll("*").length > MOST_ELEMENTS || !isProbablyReaderable(document)) return undefined;
  const article = new Readability(document, { maxElemsToParse: MOST_ELEMENTS }).parse();
  // From its HTML, a space for each tag, as Readability's own text runs one paragraph's end into the next's start.
  const content = article?.content ?? "";
  const text = textOf(content);
  return text.length >= LEAST_ARTICLE ? { content, text } : undefined;
}

/** What `html` says about itself: its article's text and captions, else the whole page's. */
export function readPage(html: string): Page {
  const meta = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(tag);
    const name = attrs.get("property") ?? attrs.get("name") ?? attrs.get("itemprop");
    const content = attrs.get("content");
    if (name && content && !meta.has(name.toLowerCase())) meta.set(name.toLowerCase(), content);
  }

  const article = articleIn(html);
  const pictures = article?.content ?? html;
  const captions = [
    ...[...pictures.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi)].map(([, inner]) => textOf(inner)),
    ...[...pictures.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => attributes(tag).get("alt") ?? ""),
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
    type: meta.get("og:type"),
    published:
      day(meta.get("article:published_time")) ??
      day(meta.get("datepublished")) ??
      day(/"datePublished"\s*:\s*"([^"]+)"/.exec(html)?.[1]),
    captions,
    text: article ? article.text : textOf(body),
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
  // A span cut through a word loses the part of it that it has.
  return spans.slice(0, most).map(([start, end]) => {
    let piece = text.slice(start, end);
    if (start > 0 && /\S/.test(text[start - 1])) piece = piece.replace(/^\S*/, "");
    if (end < text.length && /\S/.test(text[end])) piece = piece.replace(/\S*$/, "");
    return piece.trim();
  });
}
