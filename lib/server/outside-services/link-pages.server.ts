import "server-only";
import type { LinkCard } from "@/lib/broadcasts/link-card";
import { linkPagesFake } from "@/lib/server/fixtures/fakes/link-pages";
import { outsideFetch, type Outside } from "./outside-fetch.server";

const LINK_PAGE: Outside = { service: "link-page", fake: linkPagesFake };

// Any web page a text links to, read as WhatsApp reads it to make the
// link's card: the Open Graph tags in its head, which WhatsApp looks for in
// the first 300 KB, asking with a User-Agent like WhatsApp's, so a site that
// answers WhatsApp its own way answers us the same
// (https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews).
// A card needs og:title and og:description: Meta says neither may be
// empty, and a page with no og:description got no card in a test send.

/** How much of a page WhatsApp reads for its head: 300 KB, taken as characters. */
const HEAD_LENGTH = 300 * 1024;

/** WhatsApp's User-Agent on Android, in the form Meta gives. */
const WHATSAPP_AGENT = "WhatsApp/2.24.1.1 A";

/** How long a page has to answer before there's no card. */
const WAIT_MS = 5000;

/** How many redirects a link may take to reach its page. */
const MAX_REDIRECTS = 5;

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** An attribute's value with its character references as the characters: &amp; as &, &#39; as '. */
function decode(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, name: string) =>
    name[0] !== "#"
      ? (NAMED[name.toLowerCase()] ?? whole)
      : String.fromCodePoint(name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1))),
  );
}

/** A tag's attributes, by lower-case name: quoted either way, or bare. */
function attributes(tag: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [, name, double, single, bare] of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    found[name.toLowerCase()] = double ?? single ?? bare;
  }
  return found;
}

/**
 * The card a page's HTML makes for a link to `url`: its first og:title and
 * og:description, its og:site_name or else the title, and the link's site;
 * none without a title and a description.
 */
export function cardFrom(html: string, url: URL): LinkCard | null {
  const tags: Record<string, string> = {};
  for (const [tag] of html.slice(0, HEAD_LENGTH).matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(tag);
    const key = (attrs.property ?? attrs.name)?.toLowerCase();
    if (key && attrs.content !== undefined) tags[key] ??= decode(attrs.content).trim();
  }
  const title = tags["og:title"];
  const description = tags["og:description"];
  if (!title || !description) return null;
  return { title, description, name: tags["og:site_name"] || title, site: url.hostname };
}

/**
 * The card WhatsApp would show for a link to `address`; none if it isn't a
 * web address, if it or a redirect from it is on an internal address, or if
 * its page doesn't answer or has no card's tags.
 */
export async function linkCard(address: string): Promise<LinkCard | null> {
  if (!URL.canParse(address)) return null;
  const link = new URL(address);
  const signal = AbortSignal.timeout(WAIT_MS);
  let url = link;
  try {
    // Each redirect is followed here, so that where it leads is checked as the link is: a web page, on the public internet.
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      const res = await outsideFetch(LINK_PAGE, url.href, {
        headers: { "User-Agent": WHATSAPP_AGENT },
        signal,
        cache: "no-store",
        redirect: "manual",
        publicOnly: true,
      });
      const location = res.headers.get("location");
      if (res.status < 300 || res.status > 399 || location === null) {
        return res.ok ? cardFrom(await res.text(), link) : null;
      }
      url = new URL(location, url);
    }
    return null;
  } catch {
    // A page that can't be reached, or is on an internal address, gets no card.
    return null;
  }
}
