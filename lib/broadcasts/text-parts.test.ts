import { describe, expect, it } from "vitest";
import { type MailingDoc } from "@/lib/mailings/doc";
import {
  BUTTON_PROBLEMS,
  buttonProblems,
  buttonsFrom,
  headerFrom,
  inOrder,
  isLinkAddress,
  MOST_BUTTON_CHARACTERS,
  MOST_BUTTONS,
  MOST_LINK_BUTTONS,
  MOST_TEXT_BUTTONS,
  pictureFrom,
  placeFrom,
  versionFrom,
} from "./text-parts";

const WORDS: MailingDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };
const PICTURE = "00000000-0000-4000-8000-000000000001";
const PLACE = { name: "Padella", address: "6 Southwark St, London SE1 1TQ", latitude: 51.5053, longitude: -0.0903 };

describe("headerFrom", () => {
  it("takes a place, a picture or none, and nothing else", () => {
    expect(headerFrom("location")).toBe("location");
    expect(headerFrom("image")).toBe("image");
    expect(headerFrom(null)).toBeNull();
    expect(headerFrom("video")).toBeUndefined();
    expect(headerFrom(undefined)).toBeUndefined();
  });
});

describe("pictureFrom", () => {
  it("takes a picture's ID or none", () => {
    expect(pictureFrom(PICTURE)).toBe(PICTURE);
    expect(pictureFrom(null)).toBeNull();
  });

  it("takes nothing that isn't an ID", () => {
    expect(pictureFrom(undefined)).toBeUndefined();
    expect(pictureFrom(1)).toBeUndefined();
    expect(pictureFrom("../etc/passwd")).toBeUndefined();
    expect(pictureFrom(`${PICTURE}0`)).toBeUndefined();
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
    expect(buttonsFrom(Array.from({ length: MOST_BUTTONS }, () => ({ text: "Yes" })))).toHaveLength(MOST_BUTTONS);
  });

  it("takes a link button's address, and keeps one that isn't a web page's for the writer to say so", () => {
    expect(
      buttonsFrom([
        { text: "Read", url: "https://pauseai.uk", extra: 1 },
        { text: "Go", url: "" },
      ]),
    ).toEqual([
      { text: "Read", url: "https://pauseai.uk" },
      { text: "Go", url: "" },
    ]);
  });

  it("takes nothing that isn't a list of buttons, or more than WhatsApp allows", () => {
    expect(buttonsFrom([{ text: "Read", url: 1 }])).toBeUndefined();
    expect(buttonsFrom([{ text: "Read", url: null }])).toBeUndefined();
    expect(buttonsFrom(null)).toBeUndefined();
    expect(buttonsFrom({ text: "Yes" })).toBeUndefined();
    expect(buttonsFrom([{ text: "Yes" }, "No"])).toBeUndefined();
    expect(buttonsFrom([{ text: 1 }])).toBeUndefined();
    expect(buttonsFrom(Array.from({ length: MOST_BUTTONS + 1 }, () => ({ text: "Yes" })))).toBeUndefined();
  });
});

describe("buttonProblems", () => {
  const link = { text: "Read", url: " https://pauseai.uk/news " };

  it("has none when each button has words, none too many, ignoring space at the ends", () => {
    expect(buttonProblems([])).toEqual([]);
    expect(buttonProblems([{ text: "Yes" }, { text: ` ${"x".repeat(MOST_BUTTON_CHARACTERS)} ` }])).toEqual([]);
  });

  it("has none with link buttons that open web pages, as many as a text has", () => {
    expect(buttonProblems(Array.from({ length: MOST_LINK_BUTTONS }, () => link))).toEqual([]);
  });

  it("has none with as many reply buttons as a text has", () => {
    expect(buttonProblems(Array.from({ length: MOST_TEXT_BUTTONS }, () => ({ text: "Yes" })))).toEqual([]);
  });

  it("says a button has no words, or too many", () => {
    expect(buttonProblems([{ text: "Yes" }, { text: "  " }])).toEqual(["button-no-words"]);
    expect(buttonProblems([{ text: "x".repeat(MOST_BUTTON_CHARACTERS + 1) }])).toEqual(["button-too-long"]);
    expect(buttonProblems([{ ...link, text: "  " }])).toEqual(["button-no-words"]);
  });

  it("says a link button has no address, or one that isn't a web page's", () => {
    expect(buttonProblems([{ ...link, url: " " }])).toEqual(["link-no-address"]);
    expect(buttonProblems([{ ...link, url: "pauseai.uk" }])).toEqual(["link-not-address"]);
  });

  it("says there are more link buttons, or buttons, than a text has", () => {
    expect(buttonProblems(Array.from({ length: MOST_LINK_BUTTONS + 1 }, () => link))).toEqual(["too-many-links"]);
    expect(buttonProblems(Array.from({ length: MOST_TEXT_BUTTONS + 1 }, () => ({ text: "Yes" })))).toEqual([
      "too-many-buttons",
    ]);
  });

  it("says reply and link buttons are together", () => {
    expect(buttonProblems([{ text: "Yes" }, link])).toEqual(["buttons-mixed"]);
    expect(buttonProblems([link, { text: "Yes" }])).toEqual(["buttons-mixed"]);
  });

  it("says every problem there is, in the order of BUTTON_PROBLEMS", () => {
    const all = [{ text: "" }, { text: "x".repeat(26) }, { ...link, url: "" }, { ...link, url: "nope" }, link];
    expect(buttonProblems(all)).toEqual(BUTTON_PROBLEMS);
  });
});

describe("isLinkAddress", () => {
  it("is so for a web page's address, with space at its ends", () => {
    expect(isLinkAddress("https://pauseai.uk/join")).toBe(true);
    expect(isLinkAddress(" http://example.com ")).toBe(true);
  });

  it("isn't so for an address with no host, another scheme, or spaces in it", () => {
    expect(isLinkAddress("https://localhost")).toBe(false);
    expect(isLinkAddress("mailto:jane.smith@example.com")).toBe(false);
    expect(isLinkAddress("https://pauseai.uk/a page")).toBe(false);
    expect(isLinkAddress("")).toBe(false);
  });
});

describe("inOrder", () => {
  it("puts reply buttons first, then link buttons, each kind in its own order", () => {
    const buttons = [
      { text: "Read", url: "https://pauseai.uk" },
      { text: "Yes" },
      { text: "Join", url: "https://pauseai.uk/join" },
      { text: "No" },
    ];
    expect(inOrder(buttons)).toEqual([buttons[1], buttons[3], buttons[0], buttons[2]]);
  });
});

describe("versionFrom", () => {
  const version = {
    condition: "event:42",
    body: WORDS,
    templateId: null,
    header: "location",
    place: PLACE,
    pictureId: null,
    buttons: [{ text: "Coming" }],
  };

  it("takes a second version with a condition, words, a template or none, a top, a place, a picture and buttons", () => {
    expect(versionFrom(version)).toEqual(version);
    expect(versionFrom({ ...version, templateId: 7, header: null, place: null, buttons: [] })).toEqual({
      ...version,
      templateId: 7,
      header: null,
      place: null,
      buttons: [],
    });
    expect(versionFrom({ ...version, header: "image", place: null, pictureId: PICTURE })).toEqual({
      ...version,
      header: "image",
      place: null,
      pictureId: PICTURE,
    });
    expect(versionFrom(null)).toBeNull();
  });

  it("takes nothing that isn't a version, or has any part that isn't one", () => {
    expect(versionFrom("event:42")).toBeUndefined();
    expect(versionFrom({ ...version, condition: 42 })).toBeUndefined();
    expect(versionFrom({ ...version, condition: "" })).toBeUndefined();
    expect(versionFrom({ ...version, body: "Hello" })).toBeUndefined();
    expect(versionFrom({ ...version, header: "video" })).toBeUndefined();
    expect(versionFrom({ ...version, pictureId: "picture" })).toBeUndefined();
    expect(versionFrom({ ...version, pictureId: undefined })).toBeUndefined();
    expect(versionFrom({ ...version, place: "Padella" })).toBeUndefined();
    expect(versionFrom({ ...version, buttons: "Coming" })).toBeUndefined();
    expect(versionFrom({ ...version, templateId: 1.5 })).toBeUndefined();
    expect(versionFrom({ ...version, templateId: "7" })).toBeUndefined();
  });
});
