// What makes two happenings the same error (lib/server/errors-seen.ts): where
// it was, its class, and its words with what varies taken out, so "No
// politician 4127" and "No politician 4128" are one. Coarse on purpose: two
// bugs counted as one are found a day apart, but one bug counted afresh each
// time fills the list and the inbox.

/** An error from the browser: a page that fell over, shown by an error page; or anything else it threw. */
const BROWSER_KINDS = ["browser-page", "browser-other"] as const;
export type BrowserKind = (typeof BROWSER_KINDS)[number];

/**
 * Every kind of error kept, as errors_seen's CHECK lists them: what was
 * running when the server threw, as Next names them; a problem reported
 * outside a run; and the browser's.
 */
export const ERROR_KINDS = ["render", "route", "action", "proxy", "problem", ...BROWSER_KINDS] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

export function isBrowserKind(kind: unknown): kind is BrowserKind {
  return BROWSER_KINDS.some((known) => known === kind);
}

/** How much of an error's steady words, and of a route, are kept. */
const WORDS_KEPT = 300;
const ROUTE_KEPT = 200;

/**
 * What varies from one happening to the next, each with what stands for
 * it, in the order they're taken out: an address before the quotes and
 * numbers in it. An apostrophe inside a word isn't a quote.
 */
const VARYING: [RegExp, string][] = [
  [/\bhttps?:\/\/[^\s"'<>)]+/gi, "<url>"],
  [/[^\s"'<>()]+@[^\s"'<>()]+\.[a-z]{2,}/gi, "<email>"],
  [/"[^"\n]*"|“[^”\n]*”|`[^`\n]*`|(?<![a-z])'[^'\n]*'/gi, "<text>"],
  [/\b[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, "<id>"],
  [/\b(?=[a-f]*\d)[0-9a-f]{8,}\b/gi, "<id>"],
  [/\d+/g, "<n>"],
];

/** An error's words with what varies taken out: URLs, addresses, anything quoted, IDs and numbers. */
export function steadyWords(words: string): string {
  const steady = VARYING.reduce((text, [varying, stand]) => text.replace(varying, stand), words);
  return steady.replace(/\s+/g, " ").trim().slice(0, WORDS_KEPT);
}

/** A page's path as the browser has it, without its query, and each part that's an ID or a number stood for. */
export function steadyPath(path: string): string {
  const parts = path.split(/[?#]/)[0].split("/");
  const steady = parts.map((part) => {
    if (/^\d+$/.test(part)) return "<n>";
    return /\d|%/.test(part) || part.length > 40 ? "<id>" : part;
  });
  return steady.join("/").slice(0, ROUTE_KEPT);
}
