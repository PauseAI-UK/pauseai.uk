import { describe, expect, it } from "vitest";
import { type MailingDoc } from "@/lib/mailings/doc";
import {
  buttonsFit,
  buttonsFrom,
  headerFrom,
  MOST_BUTTON_CHARACTERS,
  MOST_REPLY_BUTTONS,
  placeFrom,
  versionFrom,
} from "./text-parts";

const WORDS: MailingDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };
const PLACE = { name: "Padella", address: "6 Southwark St, London SE1 1TQ", latitude: 51.5053, longitude: -0.0903 };

describe("headerFrom", () => {
  it("takes a place or none, and nothing else", () => {
    expect(headerFrom("location")).toBe("location");
    expect(headerFrom(null)).toBeNull();
    expect(headerFrom("image")).toBeUndefined();
    expect(headerFrom(undefined)).toBeUndefined();
  });
});

describe("placeFrom", () => {
  it("takes a place with a name, an address and a point on Earth, or none", () => {
    expect(placeFrom(PLACE)).toEqual(PLACE);
    expect(placeFrom({ ...PLACE, extra: "dropped" })).toEqual(PLACE);
    expect(placeFrom({ ...PLACE, latitude: -90, longitude: 180 })).toEqual({ ...PLACE, latitude: -90, longitude: 180 });
    expect(placeFrom(null)).toBeNull();
  });

  it("takes nothing that isn't a place: not an object, without words, or off the Earth", () => {
    expect(placeFrom("Padella")).toBeUndefined();
    expect(placeFrom(undefined)).toBeUndefined();
    expect(placeFrom({ ...PLACE, name: 1 })).toBeUndefined();
    expect(placeFrom({ ...PLACE, address: null })).toBeUndefined();
    expect(placeFrom({ ...PLACE, latitude: "51.5" })).toBeUndefined();
    expect(placeFrom({ ...PLACE, longitude: "-0.09" })).toBeUndefined();
    expect(placeFrom({ ...PLACE, latitude: 90.1 })).toBeUndefined();
    expect(placeFrom({ ...PLACE, longitude: -180.1 })).toBeUndefined();
  });
});

describe("buttonsFrom", () => {
  it("takes buttons with words, keeping only their words, and keeps words too long or blank for the writer to say so", () => {
    expect(buttonsFrom([])).toEqual([]);
    expect(buttonsFrom([{ text: "Yes", extra: 1 }, { text: "" }, { text: "x".repeat(40) }])).toEqual([
      { text: "Yes" },
      { text: "" },
      { text: "x".repeat(40) },
    ]);
    expect(buttonsFrom(Array.from({ length: MOST_REPLY_BUTTONS }, () => ({ text: "Yes" })))).toHaveLength(
      MOST_REPLY_BUTTONS,
    );
  });

  it("takes nothing that isn't a list of buttons, or more than WhatsApp allows", () => {
    expect(buttonsFrom(null)).toBeUndefined();
    expect(buttonsFrom({ text: "Yes" })).toBeUndefined();
    expect(buttonsFrom([{ text: "Yes" }, "No"])).toBeUndefined();
    expect(buttonsFrom([{ text: 1 }])).toBeUndefined();
    expect(buttonsFrom(Array.from({ length: MOST_REPLY_BUTTONS + 1 }, () => ({ text: "Yes" })))).toBeUndefined();
  });
});

describe("buttonsFit", () => {
  it("is so when each button has words, none too many, ignoring space at the ends", () => {
    expect(buttonsFit([])).toBe(true);
    expect(buttonsFit([{ text: "Yes" }, { text: ` ${"x".repeat(MOST_BUTTON_CHARACTERS)} ` }])).toBe(true);
  });

  it("isn't so with a button with no words, or too many", () => {
    expect(buttonsFit([{ text: "Yes" }, { text: "  " }])).toBe(false);
    expect(buttonsFit([{ text: "x".repeat(MOST_BUTTON_CHARACTERS + 1) }])).toBe(false);
  });
});

describe("versionFrom", () => {
  const version = {
    condition: "event:42",
    body: WORDS,
    templateId: null,
    header: "location",
    place: PLACE,
    buttons: [{ text: "Coming" }],
  };

  it("takes a second version with a condition, words, a template or none, a top, a place and buttons", () => {
    expect(versionFrom(version)).toEqual(version);
    expect(versionFrom({ ...version, templateId: 7, header: null, place: null, buttons: [] })).toEqual({
      ...version,
      templateId: 7,
      header: null,
      place: null,
      buttons: [],
    });
    expect(versionFrom(null)).toBeNull();
  });

  it("takes nothing that isn't a version, or has any part that isn't one", () => {
    expect(versionFrom("event:42")).toBeUndefined();
    expect(versionFrom({ ...version, condition: 42 })).toBeUndefined();
    expect(versionFrom({ ...version, condition: "" })).toBeUndefined();
    expect(versionFrom({ ...version, body: "Hello" })).toBeUndefined();
    expect(versionFrom({ ...version, header: "image" })).toBeUndefined();
    expect(versionFrom({ ...version, place: "Padella" })).toBeUndefined();
    expect(versionFrom({ ...version, buttons: "Coming" })).toBeUndefined();
    expect(versionFrom({ ...version, templateId: 1.5 })).toBeUndefined();
    expect(versionFrom({ ...version, templateId: "7" })).toBeUndefined();
  });
});
