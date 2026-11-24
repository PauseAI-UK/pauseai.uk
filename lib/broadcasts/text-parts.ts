import { checkMailingDoc, type MailingDoc } from "@/lib/mailings/doc";

// What a text has beside its words: its top, the place its top's map shows,
// and its reply buttons; and its second version, for those who meet a
// condition, a whole text of its own. Each as a draft keeps it and the
// writer sends it, checked as it's saved. WhatsApp's limits:
// https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components

/**
 * A text's top, as its template has it: a place, a map whose place each
 * send gives. None is the card WhatsApp makes of the words' first link, if
 * they have one.
 */
export type TextHeader = "location";

/** A place a text's map shows: its name and address, under the map, and its point. */
export type TextPlace = { name: string; address: string; latitude: number; longitude: number };

/** A reply button: its words, which a tap sends back as the person's reply. */
export type ReplyButton = { text: string };

/** The most reply buttons a template can have. */
export const MOST_REPLY_BUTTONS = 10;

/** The most characters a button's words can have. */
export const MOST_BUTTON_CHARACTERS = 25;

/** What makes a text one template: its words, its top and its buttons. Its place isn't, as each send gives it. */
export type TextTemplateParts = { body: MailingDoc; header: TextHeader | null; buttons: ReplyButton[] };

/** A text's second version, for those who meet `condition`: its own words, template, top, place and buttons. */
export type TextVersion = TextTemplateParts & {
  condition: string;
  templateId: number | null;
  place: TextPlace | null;
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** A top as saved: a place, or none (null); undefined for anything else. */
export function headerFrom(value: unknown): TextHeader | null | undefined {
  return value === null || value === "location" ? value : undefined;
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
 * Reply buttons as saved: each with words, up to WhatsApp's most; undefined
 * for anything else. Words too long, or none, are kept, for the writer to
 * say so (buttonProblems).
 */
export function buttonsFrom(value: unknown): ReplyButton[] | undefined {
  if (!Array.isArray(value) || value.length > MOST_REPLY_BUTTONS) return undefined;
  const buttons = value.map((one) => (isObject(one) && typeof one.text === "string" ? { text: one.text } : undefined));
  return buttons.every(Boolean) ? (buttons as ReplyButton[]) : undefined;
}

/** Whether a text's buttons can go to WhatsApp: each has words, none too many. */
export function buttonsFit(buttons: ReplyButton[]): boolean {
  return buttons.every((button) => button.text.trim() && button.text.trim().length <= MOST_BUTTON_CHARACTERS);
}

/** A second version as saved, or none (null); undefined for anything else. */
export function versionFrom(value: unknown): TextVersion | null | undefined {
  if (value === null) return null;
  if (!isObject(value) || typeof value.condition !== "string" || !value.condition) return undefined;
  const body = checkMailingDoc(value.body);
  const header = headerFrom(value.header);
  const place = placeFrom(value.place);
  const buttons = buttonsFrom(value.buttons);
  const templateId = value.templateId;
  if (!body || header === undefined || place === undefined || !buttons) return undefined;
  if (!(templateId === null || Number.isInteger(templateId))) return undefined;
  return { condition: value.condition, body, templateId: templateId as number | null, header, place, buttons };
}
