import type { MailingBlock } from "@/lib/mailings/doc";

// The small card WhatsApp shows at the top of a text for the first web
// address in its words: the page's title, a line of its description, and
// its site. WhatsApp makes it from the page's Open Graph tags
// (lib/server/outside-services/link-pages.server.ts reads them), and only
// for an address starting http:// or https://
// (https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/text-messages).

/** A link's card: the page's og:title and og:description, and the site it's on, such as docs.google.com. */
export type LinkCard = { title: string; description: string; site: string };

/** A web address WhatsApp makes a card for: http(s)://, up to a space, less any punctuation ending a sentence after it. */
const CARD_URL = /\bhttps?:\/\/[^\s]*[^\s.,!?;:)'"]/;

/** Each paragraph's words, lists' and quotes' too, in order; a field or a line break apart from what's beside it. */
function lines(blocks: MailingBlock[]): string[] {
  return blocks.flatMap((block) =>
    block.type === "paragraph"
      ? [(block.content ?? []).map((node) => (node.type === "text" ? node.text : "\n")).join("")]
      : block.type === "bulletList"
        ? block.content.flatMap((item) => lines(item.content))
        : lines(block.content),
  );
}

/** The first web address in a text's words that WhatsApp would make a card for, if there is one. */
export function firstLink(blocks: MailingBlock[]): string | undefined {
  return lines(blocks).join("\n").match(CARD_URL)?.[0];
}

/**
 * Whether an address is to Google Maps: a short link (maps.app.goo.gl,
 * goo.gl/maps), maps.google.…, or google.…/maps. In a template's text,
 * WhatsApp's card for one is broken: a short link's card is Google's
 * "Invalid Dynamic Link" page, and a full address's card names only
 * google.com, though the same links get a map's card in a reply's text.
 * Our own reading of the page (linkCard) gets the map's card, so the
 * preview can't show this.
 */
export function mapsLink(address: string): boolean {
  if (!URL.canParse(address)) return false;
  const { hostname, pathname } = new URL(address);
  const host = hostname.replace(/^www\./, "");
  if (host === "maps.app.goo.gl" || /^maps\.google\./.test(host)) return true;
  if (host === "goo.gl" || /^google\.[a-z.]+$/.test(host)) return /^\/maps(\/|$)/.test(pathname);
  return false;
}
