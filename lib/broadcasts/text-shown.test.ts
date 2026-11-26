import { describe, expect, it } from "vitest";
import type { MailingDoc } from "@/lib/mailings/doc";
import { cardLinks, pictureSource, textShown, type WrittenText } from "./text-shown";
import type { WhatsAppVariant } from "./drafts.server";
import { TEMPLATE_FOOTER } from "./whatsapp-template";

const PICTURE = "00000000-0000-4000-8000-000000000001";
const PLACE = { name: "Parliament Square", address: "Westminster, London SW1P 3BD", latitude: 51.5, longitude: -0.13 };
const words = (text: string): MailingDoc => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const variant = (footer: string | null) => ({ footer }) as WhatsAppVariant;

/** A text with a map, a link button before a reply button, and words only for some among its own. */
const written: WrittenText = {
  body: {
    type: "doc",
    content: [
      ...words("Everyone").content,
      {
        type: "onlyFor",
        attrs: { condition: "wrote:regulate-ai" },
        content: [{ type: "paragraph", content: [{ type: "text", text: "Only some" }] }],
      },
    ],
  },
  header: "location",
  place: PLACE,
  pictureId: null,
  buttons: [{ text: "Details", url: "https://pauseai.uk/march" }, { text: "I'm coming" }],
  variant: null,
  textVersion: null,
};

describe("pictureSource", () => {
  it("serves a kept picture from the site, and gives an example's data: address as it is", () => {
    expect(pictureSource(PICTURE)).toBe(`/api/text-pictures/${PICTURE}`);
    expect(pictureSource("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });
});

describe("textShown", () => {
  it("shows its own parts: its words but those only for some, its map, the site's footer, reply buttons first", () => {
    expect(textShown(written, false)).toEqual({
      blocks: words("Everyone").content,
      footer: TEMPLATE_FOOTER,
      place: PLACE,
      picture: null,
      buttons: [{ text: "I'm coming" }, { text: "Details", url: "https://pauseai.uk/march" }],
      link: "https://pauseai.uk/march",
    });
  });

  it("has its card for the first address in its words, or else its link button's", () => {
    const linked = { ...written, body: words("See https://example.org/page") };
    expect(textShown(linked, false).link).toBe("https://example.org/page");
    expect(textShown({ ...written, buttons: [{ text: "I'm coming" }] }, false).link).toBeUndefined();
  });

  it("shows its own parts to one who meets a condition when it has no second version", () => {
    expect(textShown(written, true).blocks).toEqual(words("Everyone").content);
  });

  it("gives the footer its variant went with", () => {
    expect(textShown({ ...written, variant: variant("Reply STOP to stop") }, false).footer).toBe("Reply STOP to stop");
  });

  it("shows a map only for a place's top, and a picture only for a picture's top with a picture", () => {
    // A place kept from before its top became a picture shows no map.
    expect(textShown({ ...written, header: "image", pictureId: PICTURE }, false)).toMatchObject({
      place: null,
      picture: `/api/text-pictures/${PICTURE}`,
    });
    expect(textShown({ ...written, header: "image" }, false)).toMatchObject({ place: null, picture: null });
    expect(textShown({ ...written, header: null, pictureId: PICTURE }, false)).toMatchObject({
      place: null,
      picture: null,
    });
    expect(textShown({ ...written, header: "image", pictureId: "data:image/png;base64,AAAA" }, false).picture).toBe(
      "data:image/png;base64,AAAA",
    );
  });

  it("shows its second version to one who meets its condition, and its own to everyone else", () => {
    const both: WrittenText = {
      ...written,
      textVersion: {
        condition: "wrote:regulate-ai",
        body: words("You wrote"),
        header: "image",
        place: null,
        pictureId: PICTURE,
        buttons: [{ text: "Thanks" }],
        variant: variant(null),
      },
    };
    expect(textShown(both, true)).toEqual({
      blocks: words("You wrote").content,
      footer: TEMPLATE_FOOTER,
      place: null,
      picture: `/api/text-pictures/${PICTURE}`,
      buttons: [{ text: "Thanks" }],
      link: undefined,
    });
    expect(textShown(both, false).blocks).toEqual(words("Everyone").content);
  });
});

describe("cardLinks", () => {
  it("has each version's link, once, and none for a version without one", () => {
    expect(cardLinks(written)).toEqual(["https://pauseai.uk/march"]);
    const version = {
      condition: "wrote:regulate-ai",
      header: null,
      place: null,
      pictureId: null,
      variant: variant(null),
    };
    const other = { ...version, body: words("See https://example.org/page"), buttons: [] };
    expect(cardLinks({ ...written, textVersion: other })).toEqual([
      "https://pauseai.uk/march",
      "https://example.org/page",
    ]);
    expect(cardLinks({ ...written, textVersion: { ...other, body: words("Same https://pauseai.uk/march") } })).toEqual([
      "https://pauseai.uk/march",
    ]);
    expect(cardLinks({ ...written, buttons: [] })).toEqual([]);
  });
});
