import type { WrittenBroadcast } from "./drafts.server";
import { inOrder } from "./text-parts";
import { TEMPLATE_FOOTER } from "./whatsapp-template";
import type { MailingBlock } from "@/lib/mailings/doc";

/**
 * Where a picture kept for a text is served, for the site's pages to show
 * it; an example's, given whole as a data: address, is its own
 * (BroadcastWriter.examples.ts).
 */
export const pictureSource = (id: string) => (id.startsWith("data:") ? id : `/api/text-pictures/${id}`);

/** What a WhatsApp broadcast says: its default variant's parts, and its conditional variant's, each with the variant. */
export type WrittenText = Pick<
  WrittenBroadcast,
  "body" | "header" | "place" | "pictureId" | "buttons" | "variant" | "textVersion"
>;

/**
 * What a text shows someone: its own words, top and buttons, or its second
 * version's, for someone who meets its condition (`met`); with the footer
 * its template went to WhatsApp with, and its buttons in WhatsApp's order.
 */
export function textShown(written: WrittenText, met: boolean) {
  const one = met && written.textVersion ? written.textVersion : written;
  return {
    blocks: one.body.content.filter((block): block is MailingBlock => block.type !== "onlyFor"),
    footer: one.variant?.footer ?? TEMPLATE_FOOTER,
    place: one.header === "location" ? one.place : null,
    picture: one.header === "image" && one.pictureId ? pictureSource(one.pictureId) : null,
    buttons: inOrder(one.buttons).map((button) => button.text),
  };
}
