// What the press survey finds, as press_finds keeps each: found by its
// Google News link, then read, then waiting for staff or set aside.

/**
 * `unread` until its link is decoded and its page read; `known` if the
 * article is in the coverage already, or found before under another link;
 * `waiting` for staff; `not ours` if Claude or staff said so; `added` once
 * staff have put it in the coverage.
 */
export const FIND_STATES = ["unread", "known", "waiting", "not ours", "added"] as const;

/** How many times a find is tried before it's left for staff to read themselves. */
export const MOST_READS = 3;

/** What a find's last failed try at reading it kept (keptError): the outside service and how it failed, if one did. */
export type FindFailure = { service?: string; kind?: string };

/** Why a find couldn't be read, as staff are told it: from the failure's service and kind, never its own words. */
export const NOT_READ = ["noAddress", "refused", "busy", "missing", "noAnswer"] as const;
export type NotRead = (typeof NOT_READ)[number];

/**
 * Why `failure` left a find unread: Google wouldn't give its article's
 * address; the site refused us, turned us away for asking too often, or
 * hasn't the page; or it didn't answer, or something else went wrong.
 */
export function whyNotRead({ service, kind }: FindFailure): NotRead {
  if (service === "google-news") return "noAddress";
  if (kind === "unauthorised" || kind === "refused") return "refused";
  if (kind === "rate-limited") return "busy";
  if (kind === "not-found") return "missing";
  return "noAnswer";
}
