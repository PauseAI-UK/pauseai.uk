import type { MailingBlock, OnlyForNode } from "@/lib/mailings/doc";
import { isLinkAddress, type TextButton } from "./text-parts";

// The card WhatsApp shows for a text's link: the first web address in its
// words, or with none there, its first link button's. WhatsApp makes it
// from the page's Open Graph tags (lib/server/outside-services/link-pages.server.ts
// reads them), and only for an address starting http:// or https://
// (https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/text-messages).
// With no header, it's the whole card at the text's top: the page's title,
// a line of its description, and its site. Under a picture, it's a small
// one: the site's name and its address, as an Android phone showed for a
// link button. Meta's docs say neither; that a link in the words makes the
// small card too, and that a link button makes the whole one, are taken to
// be so till a send shows otherwise. A map has its place under it, and no card.

/**
 * A link's card: the page's og:title and og:description; the site's name,
 * its og:site_name, or the title where it has none; and the site it's on,
 * such as docs.google.com.
 */
export type LinkCard = { title: string; description: string; name: string; site: string };

/** A web address WhatsApp makes a card for: http(s)://, up to a space, less any punctuation ending a sentence after it. */
const CARD_URL = /\bhttps?:\/\/[^\s]*[^\s.,!?;:)'"]/;

/**
 * Each paragraph's words, lists', quotes' and conditional parts' too, in
 * order; a field or a line break apart from what's beside it.
 */
function lines(blocks: (MailingBlock | OnlyForNode)[]): string[] {
  return blocks.flatMap((block) =>
    block.type === "paragraph"
      ? [(block.content ?? []).map((node) => (node.type === "text" ? node.text : "\n")).join("")]
      : block.type === "bulletList"
        ? block.content.flatMap((item) => lines(item.content))
        : lines(block.content),
  );
}

/** The first web address in a text's words that WhatsApp would make a card for, if there is one. */
export function firstLink(blocks: (MailingBlock | OnlyForNode)[]): string | undefined {
  return lines(blocks).join("\n").match(CARD_URL)?.[0];
}

/**
 * The address a text's card is for: the first in its words, or else its
 * first link button's that's a web page's, as one being typed may not be
 * yet; none for neither.
 */
export function cardLink(blocks: (MailingBlock | OnlyForNode)[], buttons: TextButton[]): string | undefined {
  const button = buttons.find((one) => one.url !== undefined && isLinkAddress(one.url));
  return firstLink(blocks) ?? button?.url!.trim();
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
