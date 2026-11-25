import { checkMailingDoc, type MailingDoc } from "@/lib/mailings/doc";

// What a text has beside its words: its top, the place or picture its top
// shows, and its buttons; and its second version, for those who meet a
// condition, a whole text of its own. Each as a draft keeps it and the
// writer sends it, checked as it's saved. WhatsApp's limits:
// https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components

/**
 * A text's top, as its template has it: a place, a map whose place each
 * send gives; or a picture, which each send gives too. None is the card
 * WhatsApp makes of the words' first link, if they have one.
 */
export type TextHeader = "location" | "image";

/** A place a text's map shows: its name and address, under the map, and its point. */
export type TextPlace = { name: string; address: string; latitude: number; longitude: number };

/**
 * A button under a text: its words, and for a link button, the address it
 * opens. A reply button's tap sends its words back as the person's reply.
 */
export type TextButton = { text: string; url?: string };

/** The most buttons a template can have, and of them the most link buttons. */
export const MOST_BUTTONS = 10;
export const MOST_LINK_BUTTONS = 2;

/** The most characters a button's words can have. */
export const MOST_BUTTON_CHARACTERS = 25;

/** What makes a text one template: its words, its top and its buttons. Its place and picture aren't, as each send gives them. */
export type TextTemplateParts = { body: MailingDoc; header: TextHeader | null; buttons: TextButton[] };

/** A text's second version, for those who meet `condition`: its own words, template, top, place, picture and buttons. */
export type TextVersion = TextTemplateParts & {
  condition: string;
  templateId: number | null;
  place: TextPlace | null;
  pictureId: string | null;
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** A top as saved: a place, a picture, or none (null); undefined for anything else. */
export function headerFrom(value: unknown): TextHeader | null | undefined {
  return value === null || value === "location" || value === "image" ? value : undefined;
}

/** A place as saved, with words for its name and address and a point on Earth, or none (null); undefined for anything else. */
export function placeFrom(value: unknown): TextPlace | null | undefined {
  if (value === null) return null;
  if (!isObject(value)) return undefined;
  const { name, address, latitude, longitude } = value;
  const onEarth =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  if (typeof name !== "string" || typeof address !== "string" || !onEarth) return undefined;
  return { name, address, latitude, longitude };
}

/** A picture as saved, by its ID (text_pictures), or none (null); undefined for anything else. */
export function pictureFrom(value: unknown): string | null | undefined {
  return value === null || (typeof value === "string" && /^[0-9a-f-]{36}$/.test(value)) ? value : undefined;
}

/**
 * Buttons as saved: each with words, and a link button its address, up to
 * WhatsApp's most; undefined for anything else. Words too long, or none,
 * and an address that isn't one, are kept, for the writer to say so
 * (buttonsFit).
 */
export function buttonsFrom(value: unknown): TextButton[] | undefined {
  if (!Array.isArray(value) || value.length > MOST_BUTTONS) return undefined;
  const buttons = value.map((one) => {
    if (!isObject(one) || typeof one.text !== "string") return undefined;
    if (one.url === undefined) return { text: one.text };
    return typeof one.url === "string" ? { text: one.text, url: one.url } : undefined;
  });
  return buttons.every(Boolean) ? (buttons as TextButton[]) : undefined;
}

/** Whether an address is one a link button can open: a web page's, https:// or http://. */
export function isLinkAddress(url: string): boolean {
  return /^https?:\/\/[^\s/]+\.[^\s]+$/.test(url.trim());
}

/**
 * Whether a text's buttons can go to WhatsApp: each has words, none too
 * many; each link button an address; and no more link buttons than it takes.
 */
export function buttonsFit(buttons: TextButton[]): boolean {
  const worded = buttons.every((button) => button.text.trim() && button.text.trim().length <= MOST_BUTTON_CHARACTERS);
  const links = buttons.filter((button) => button.url !== undefined);
  return worded && links.every((button) => isLinkAddress(button.url!)) && links.length <= MOST_LINK_BUTTONS;
}

/**
 * Buttons as WhatsApp takes them: its reply buttons together, then its link
 * buttons, as it refuses the two kinds mixed
 * (https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components#quick-reply-buttons).
 * A text shows and sends them in this order.
 */
export function inOrder(buttons: TextButton[]): TextButton[] {
  return [...buttons.filter((button) => button.url === undefined), ...buttons.filter((button) => button.url !== undefined)];
}

/** A second version as saved, or none (null); undefined for anything else. */
export function versionFrom(value: unknown): TextVersion | null | undefined {
  if (value === null) return null;
  if (!isObject(value) || typeof value.condition !== "string" || !value.condition) return undefined;
  const body = checkMailingDoc(value.body);
  const header = headerFrom(value.header);
  const place = placeFrom(value.place);
  const pictureId = pictureFrom(value.pictureId);
  const buttons = buttonsFrom(value.buttons);
  const templateId = value.templateId;
  if (!body || header === undefined || place === undefined || pictureId === undefined || !buttons) return undefined;
  if (!(templateId === null || Number.isInteger(templateId))) return undefined;
  return {
    condition: value.condition,
    body,
    templateId: templateId as number | null,
    header,
    place,
    pictureId,
    buttons,
  };
}
