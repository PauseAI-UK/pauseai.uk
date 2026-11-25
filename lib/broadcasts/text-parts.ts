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

/**
 * The most buttons a text has, all replies or all links, as WhatsApp on a
 * computer shows no more, nor the two kinds together: it tells people to
 * open the text on their phone instead.
 */
export const MOST_TEXT_BUTTONS = 3;

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

/**
 * Whether a place has the words WhatsApp shows under its map, a name and an
 * address: its docs don't say a send can leave either out, so neither may.
 */
export function placeWords(place: TextPlace): boolean {
  return Boolean(place.name.trim() && place.address.trim());
}

/** A picture as saved, by its ID (text_pictures), or none (null); undefined for anything else. */
export function pictureFrom(value: unknown): string | null | undefined {
  return value === null || (typeof value === "string" && /^[0-9a-f-]{36}$/.test(value)) ? value : undefined;
}

/**
 * Buttons as saved: each with words, and a link button its address, up to
 * WhatsApp's most; undefined for anything else. Words too long, or none,
 * and an address that isn't one, are kept, for the writer to say so
 * (buttonProblems).
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

/** What can be wrong with a text's buttons, each its own problem for the writer to say. */
export const BUTTON_PROBLEMS = [
  "button-no-words",
  "button-too-long",
  "link-no-address",
  "link-not-address",
  "too-many-links",
  "too-many-buttons",
  "buttons-mixed",
] as const;
export type ButtonProblem = (typeof BUTTON_PROBLEMS)[number];

/**
 * What stops a text's buttons going to WhatsApp, none if nothing does: a
 * button with no words, or too many; a link button with no address, or one
 * that isn't a web page's; more link buttons, or buttons, than a text has;
 * and reply and link buttons together.
 */
export function buttonProblems(buttons: TextButton[]): ButtonProblem[] {
  const words = buttons.map((button) => button.text.trim());
  const addresses = buttons.flatMap((button) => (button.url === undefined ? [] : [button.url.trim()]));
  const checks: [ButtonProblem, boolean][] = [
    ["button-no-words", words.some((one) => !one)],
    ["button-too-long", words.some((one) => one.length > MOST_BUTTON_CHARACTERS)],
    ["link-no-address", addresses.some((one) => !one)],
    ["link-not-address", addresses.some((one) => one && !isLinkAddress(one))],
    ["too-many-links", addresses.length > MOST_LINK_BUTTONS],
    ["too-many-buttons", buttons.length > MOST_TEXT_BUTTONS],
    ["buttons-mixed", addresses.length > 0 && addresses.length < buttons.length],
  ];
  return checks.filter(([, wrong]) => wrong).map(([problem]) => problem);
}

/**
 * Buttons as WhatsApp takes them: its reply buttons together, then its link
 * buttons, as it refuses the two kinds mixed
 * (https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components#quick-reply-buttons).
 * A text shows and sends them in this order.
 */
export function inOrder(buttons: TextButton[]): TextButton[] {
  return [
    ...buttons.filter((button) => button.url === undefined),
    ...buttons.filter((button) => button.url !== undefined),
  ];
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
