import { broadcastsCopy } from "./copy";

// What a message someone sent our WhatsApp number says, for what's kept of it
// as a reply (broadcast_replies): its kind, where it's more than words, and
// whatever words it came with. Its files aren't fetched, so a photo is kept
// as its caption, a voice note as nothing but that it was one.
// https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages

/** A message to us in WhatsApp's webhook, as far as we read it: its `type` says which of the rest it has. */
export type WhatsAppMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  /** A button pressed on a template that has one, such as one made in WhatsApp Manager. */
  button?: { text?: string };
  /** A button or a row of a list pressed on a message of ours that offered them. */
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
  audio?: { voice?: boolean };
  location?: { name?: string; address?: string; latitude?: number; longitude?: number };
  contacts?: { name?: { formatted_name?: string }; phones?: { phone?: string }[]; emails?: { email?: string }[] }[];
  /** The message of ours reacted to, and the emoji; no emoji when the reaction is taken back. */
  reaction?: { message_id?: string; emoji?: string };
  unsupported?: { type?: string };
  /** The message this one quotes. */
  context?: { id?: string };
};

/**
 * What's kept of a message: its kind, none for words alone, else WhatsApp's
 * name for it, or "voice" for a voice note; and its words, none if it came
 * with none.
 */
export type KeptWords = { kind: string | null; body: string | null };

/** Lines of text, those there are, one under another; null for none. */
const lines = (...parts: (string | undefined)[]): string | null => parts.filter(Boolean).join("\n") || null;

/** Where a place is on a map, for a link that opens it. */
const mapLink = (latitude: number, longitude: number) =>
  `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

/**
 * What a message says (KeptWords). A reply button tapped on one of our
 * templates is a button, with its words. Words typed, or the words on a
 * button or list row pressed on a message of ours that offered them, are
 * words alone. A photo, video or document has its
 * caption, a document its filename first; a place its name, address and a
 * link to a map; contact cards a line each, of the name, numbers and
 * addresses; a reaction its emoji. A kind WhatsApp can't pass on is kept as
 * the kind it says it was, if it does.
 */
export function messageWords(message: WhatsAppMessage): KeptWords {
  if (message.button?.text !== undefined) return { kind: "button", body: message.button.text };
  const pressed = message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title;
  const words = message.text?.body ?? pressed;
  if (words !== undefined) return { kind: null, body: words };
  switch (message.type) {
    case "image":
    case "video":
      return { kind: message.type, body: lines(message[message.type]?.caption) };
    case "document":
      return { kind: "document", body: lines(message.document?.filename, message.document?.caption) };
    case "audio":
      return { kind: message.audio?.voice ? "voice" : "audio", body: null };
    case "location": {
      const { name, address, latitude, longitude } = message.location ?? {};
      const map = latitude === undefined || longitude === undefined ? undefined : mapLink(latitude, longitude);
      return { kind: "location", body: lines(name, address, map) };
    }
    case "contacts": {
      const cards = (message.contacts ?? []).map((card) =>
        [
          card.name?.formatted_name,
          ...(card.phones ?? []).map((p) => p.phone),
          ...(card.emails ?? []).map((e) => e.email),
        ]
          .filter(Boolean)
          .join(", "),
      );
      return { kind: "contacts", body: lines(...cards) };
    }
    case "reaction":
      return { kind: "reaction", body: lines(message.reaction?.emoji) };
    case "unsupported":
      return { kind: message.unsupported?.type ?? "unsupported", body: null };
    default:
      return { kind: message.type, body: null };
  }
}

/**
 * What a kept message was, in words, for a reply's bubble to say over
 * whatever words it has: nothing for words alone or a reaction, which shows
 * its emoji; else its kind, by name where we know it.
 */
export function kindWords(kind: string | null): string | null {
  if (kind === null || kind === "reaction") return null;
  const replies = broadcastsCopy.broadcastPages.replies;
  return replies.kinds[kind] ?? replies.kindOther(kind);
}

/** A kept message as plain words, for an email to staff: what it was, then its words. */
export function keptInWords({ kind, body }: KeptWords): string {
  const replies = broadcastsCopy.broadcastPages.replies;
  const what = kind === "reaction" ? replies.reacted : kindWords(kind);
  return [what, body].filter(Boolean).join("\n");
}
