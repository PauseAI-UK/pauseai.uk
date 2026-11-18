import { describe, expect, it } from "vitest";
import { broadcastsCopy } from "./copy";
import { keptInWords, kindWords, messageWords, type WhatsAppMessage } from "./whatsapp-messages";

const replies = broadcastsCopy.broadcastPages.replies;

/** A message to us of `type`, with these fields. */
const message = (type: string, fields: Partial<WhatsAppMessage> = {}): WhatsAppMessage => ({
  id: "wamid.in-1",
  from: "447700900123",
  timestamp: "1793613600",
  type,
  ...fields,
});

describe("messageWords", () => {
  it("keeps words typed, or the words on what was pressed, as words alone", () => {
    expect(messageWords(message("text", { text: { body: "See you there!" } }))).toEqual({
      kind: null,
      body: "See you there!",
    });
    // Empty words are still words.
    expect(messageWords(message("text", { text: { body: "" } }))).toEqual({ kind: null, body: "" });
    expect(messageWords(message("button", { button: { text: "Count me in" } }))).toEqual({
      kind: null,
      body: "Count me in",
    });
    expect(messageWords(message("interactive", { interactive: { button_reply: { title: "Yes" } } }))).toEqual({
      kind: null,
      body: "Yes",
    });
    expect(messageWords(message("interactive", { interactive: { list_reply: { title: "Saturday" } } }))).toEqual({
      kind: null,
      body: "Saturday",
    });
    // Pressed, with no words we read: its kind alone.
    expect(messageWords(message("interactive", { interactive: {} }))).toEqual({ kind: "interactive", body: null });
  });

  it("keeps a photo or video as its caption, a document as its filename then its caption", () => {
    expect(messageWords(message("image", { image: { caption: "Our banner" } }))).toEqual({
      kind: "image",
      body: "Our banner",
    });
    expect(messageWords(message("image", { image: {} }))).toEqual({ kind: "image", body: null });
    expect(messageWords(message("video"))).toEqual({ kind: "video", body: null });
    expect(messageWords(message("video", { video: { caption: "The march" } }))).toEqual({
      kind: "video",
      body: "The march",
    });
    expect(
      messageWords(message("document", { document: { filename: "leaflet.pdf", caption: "For Saturday" } })),
    ).toEqual({ kind: "document", body: "leaflet.pdf\nFor Saturday" });
    expect(messageWords(message("document"))).toEqual({ kind: "document", body: null });
  });

  it("tells a voice note from other audio, and keeps a sticker as that", () => {
    expect(messageWords(message("audio", { audio: { voice: true } }))).toEqual({ kind: "voice", body: null });
    expect(messageWords(message("audio", { audio: { voice: false } }))).toEqual({ kind: "audio", body: null });
    expect(messageWords(message("audio"))).toEqual({ kind: "audio", body: null });
    expect(messageWords(message("sticker"))).toEqual({ kind: "sticker", body: null });
  });

  it("keeps a place as its name, address and a link to a map, whichever it has", () => {
    expect(
      messageWords(
        message("location", {
          location: { name: "Parliament Square", address: "London SW1P 3JX", latitude: 51.5007, longitude: -0.1268 },
        }),
      ),
    ).toEqual({
      kind: "location",
      body: "Parliament Square\nLondon SW1P 3JX\nhttps://www.google.com/maps/search/?api=1&query=51.5007,-0.1268",
    });
    // A pin dropped, with no name; and one missing half of where it is, or all of it.
    expect(messageWords(message("location", { location: { latitude: 0, longitude: 0 } }))).toEqual({
      kind: "location",
      body: "https://www.google.com/maps/search/?api=1&query=0,0",
    });
    expect(messageWords(message("location", { location: { name: "Home", latitude: 51.5 } }))).toEqual({
      kind: "location",
      body: "Home",
    });
    expect(messageWords(message("location", { location: { longitude: -0.1 } }))).toEqual({
      kind: "location",
      body: null,
    });
    expect(messageWords(message("location"))).toEqual({ kind: "location", body: null });
  });

  it("keeps contact cards a line each: the name, then the numbers and addresses", () => {
    expect(
      messageWords(
        message("contacts", {
          contacts: [
            {
              name: { formatted_name: "Jane Smith" },
              phones: [{ phone: "+44 7700 900001" }, { phone: "+44 7700 900002" }],
              emails: [{ email: "jane.smith@example.com" }],
            },
            { name: { formatted_name: "Sam Jones" } },
            { phones: [{}], emails: [{}] },
          ],
        }),
      ),
    ).toEqual({
      kind: "contacts",
      body: "Jane Smith, +44 7700 900001, +44 7700 900002, jane.smith@example.com\nSam Jones",
    });
    expect(messageWords(message("contacts"))).toEqual({ kind: "contacts", body: null });
  });

  it("keeps a reaction as its emoji, none for one taken back", () => {
    expect(messageWords(message("reaction", { reaction: { message_id: "wamid.out-1", emoji: "👍" } }))).toEqual({
      kind: "reaction",
      body: "👍",
    });
    expect(messageWords(message("reaction", { reaction: { message_id: "wamid.out-1" } }))).toEqual({
      kind: "reaction",
      body: null,
    });
    expect(messageWords(message("reaction"))).toEqual({ kind: "reaction", body: null });
  });

  it("keeps one WhatsApp can't pass on as the kind it says it was, and any other kind as WhatsApp names it", () => {
    expect(messageWords(message("unsupported", { unsupported: { type: "poll" } }))).toEqual({
      kind: "poll",
      body: null,
    });
    expect(messageWords(message("unsupported"))).toEqual({ kind: "unsupported", body: null });
    expect(messageWords(message("order"))).toEqual({ kind: "order", body: null });
  });
});

describe("kindWords", () => {
  it("names each kind we know, and says any other by WhatsApp's name; nothing for words alone or a reaction", () => {
    expect(kindWords(null)).toBeNull();
    expect(kindWords("reaction")).toBeNull();
    expect(kindWords("voice")).toBe(replies.kinds.voice);
    expect(kindWords("location")).toBe(replies.kinds.location);
    expect(kindWords("poll")).toBe(replies.kindOther("poll"));
  });
});

describe("keptInWords", () => {
  it("is what a message was, then its words, whichever it has", () => {
    expect(keptInWords({ kind: null, body: "See you there!" })).toBe("See you there!");
    expect(keptInWords({ kind: "image", body: "Our banner" })).toBe(`${replies.kinds.image}\nOur banner`);
    expect(keptInWords({ kind: "voice", body: null })).toBe(replies.kinds.voice);
    expect(keptInWords({ kind: "reaction", body: "👍" })).toBe(`${replies.reacted}\n👍`);
  });
});
