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

/** The card a page's HTML makes for a link to `url`: its first og:title and og:description, and the link's site; none without both. */
export function cardFrom(html: string, url: URL): LinkCard | null {
  const tags: Record<string, string> = {};
  for (const [tag] of html.slice(0, HEAD_LENGTH).matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(tag);
    const key = (attrs.property ?? attrs.name)?.toLowerCase();
    if (key && attrs.content !== undefined) tags[key] ??= decode(attrs.content).trim();
  }
  const title = tags["og:title"];
  const description = tags["og:description"];
  return title && description ? { title, description, site: url.hostname } : null;
}

/** The card WhatsApp would show for a link to `address`; none if it isn't a web address, or its page doesn't answer or has no card's tags. */
export async function linkCard(address: string): Promise<LinkCard | null> {
  if (!URL.canParse(address)) return null;
  const url = new URL(address);
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  try {
    const res = await outsideFetch(LINK_PAGE, url.href, {
      headers: { "User-Agent": WHATSAPP_AGENT },
      signal: AbortSignal.timeout(WAIT_MS),
      cache: "no-store",
    });
    return res.ok ? cardFrom(await res.text(), url) : null;
  } catch {
    // A page that can't be reached gets no card, in WhatsApp as here.
    return null;
  }
}
