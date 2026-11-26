import { describe, expect, it } from "vitest";
import { asLink, isShortMapsLink, readMapsLink } from "./places";

/** A full link as Google Maps' Share button leads to: a name in its path, the map's view after @, and the pin in its data. */
const FULL =
  "https://www.google.com/maps/place/Padella+Borough/@51.5054,-0.0904,17z/data=!3m1!4b1!4m6!3m5!1s0x487605!8m2!3d51.5053!4d-0.0903!16s%2Fg%2F11c";

describe("readMapsLink", () => {
  it("takes the name from the path and the point from the pin in the data, not the map's view", () => {
    expect(readMapsLink(FULL)).toEqual({ name: "Padella Borough", point: { latitude: 51.5053, longitude: -0.0903 } });
  });

  it("takes the point from the pin even where it comes before the view", () => {
    expect(readMapsLink("https://www.google.com/maps/place/X/data=!3d51.5!4d-0.1")).toEqual({
      name: "X",
      point: { latitude: 51.5, longitude: -0.1 },
    });
  });

  it("gives no point for a pin that isn't on earth", () => {
    expect(readMapsLink("https://www.google.com/maps/place/X/@51.5,-0.1,17z/data=!3d99.5!4d-0.1")).toEqual({
      name: "X",
    });
  });

  it("falls back to the point the map opens on", () => {
    expect(readMapsLink("https://www.google.com/maps/place/Koya+Soho/@51.5136,-0.1335,17z")).toEqual({
      name: "Koya Soho",
      point: { latitude: 51.5136, longitude: -0.1335 },
    });
    expect(readMapsLink("https://www.google.com/maps/@40.7,-74.0,15z")).toEqual({
      point: { latitude: 40.7, longitude: -74 },
    });
  });

  it("reads a place written as a point rather than a name, after /place/ or /search/", () => {
    expect(readMapsLink("https://www.google.com/maps/place/51.5,-0.09")).toEqual({
      point: { latitude: 51.5, longitude: -0.09 },
    });
    expect(readMapsLink("https://www.google.com/maps/search/48.85,+2.35")).toEqual({
      point: { latitude: 48.85, longitude: 2.35 },
    });
  });

  it("keeps an ampersand or a plus in a name, written out or escaped", () => {
    expect(readMapsLink("https://www.google.com/maps/place/Fish+&+Chips")).toEqual({ name: "Fish & Chips" });
    expect(readMapsLink("https://www.google.com/maps/place/Fish+%26+Chips+%2B")).toEqual({ name: "Fish & Chips +" });
  });

  it("reads a search's words as the place's name", () => {
    expect(readMapsLink("https://www.google.com/maps/search/Parliament+Square")).toEqual({ name: "Parliament Square" });
  });

  it("reads q=, query= and daddr=, as a name or a point", () => {
    expect(readMapsLink("https://maps.google.co.uk/?q=Bao+Borough")).toEqual({ name: "Bao Borough" });
    expect(readMapsLink("https://maps.google.com/?q=loc:51.5,-0.09")).toEqual({
      point: { latitude: 51.5, longitude: -0.09 },
    });
    expect(readMapsLink("https://www.google.com/maps/dir/?api=1&daddr=51.5,-0.09")).toEqual({
      point: { latitude: 51.5, longitude: -0.09 },
    });
  });

  it("reads ll=, center= and sll= as a point, before q='s, and a name from query= beside one", () => {
    expect(readMapsLink("https://www.google.com/maps/search/?api=1&query=Nopi&ll=51.51,-0.13")).toEqual({
      name: "Nopi",
      point: { latitude: 51.51, longitude: -0.13 },
    });
    expect(readMapsLink("https://maps.google.com/?center=51.5,-0.09&q=52,-1")).toEqual({
      point: { latitude: 51.5, longitude: -0.09 },
    });
    expect(readMapsLink("https://maps.google.com/?sll=51.5,-0.09")).toEqual({
      point: { latitude: 51.5, longitude: -0.09 },
    });
  });

  it("takes the view's point over a q= that's a name", () => {
    expect(readMapsLink("https://www.google.com/maps/@51.5,-0.09,15z?q=Nopi")).toEqual({
      name: "Nopi",
      point: { latitude: 51.5, longitude: -0.09 },
    });
  });

  it("refuses numbers that aren't a point on earth, keeping them as a name", () => {
    expect(readMapsLink("https://maps.google.com/?q=95.2,-0.09")).toEqual({ name: "95.2,-0.09" });
    expect(readMapsLink("https://maps.google.com/?q=51.5,-200.4")).toEqual({ name: "51.5,-200.4" });
  });

  it("passes over a parameter that's there but blank", () => {
    expect(readMapsLink("https://maps.google.com/?q=&ll=51.5,-0.09")).toEqual({
      point: { latitude: 51.5, longitude: -0.09 },
    });
  });

  it("reads Google on any of its country domains", () => {
    expect(readMapsLink("https://www.google.co.uk/maps/place/Nopi")).toEqual({ name: "Nopi" });
    expect(readMapsLink("https://google.de/maps/place/Nopi")).toEqual({ name: "Nopi" });
  });

  it("says nothing of a link that isn't Google Maps', or words that aren't a link", () => {
    expect(readMapsLink("https://example.com/maps/place/Padella")).toBeNull();
    expect(readMapsLink("https://www.google.example.com/maps/place/Padella")).toBeNull();
    expect(readMapsLink("not a link at all")).toBeNull();
  });

  it("carries nothing out of a short link till it's followed", () => {
    expect(readMapsLink("https://maps.app.goo.gl/G5TcwgTuzbJg7i2v5")).toEqual({});
    expect(readMapsLink("https://goo.gl/maps/abc")).toEqual({});
  });

  it("gives no name for a path it can't decode, nor for an empty one", () => {
    expect(readMapsLink("https://www.google.com/maps/place/%E0%A4%A/@51.5,-0.09,17z")).toEqual({
      point: { latitude: 51.5, longitude: -0.09 },
    });
    expect(readMapsLink("https://www.google.com/maps/place//@51.5,-0.09,17z")).toEqual({
      point: { latitude: 51.5, longitude: -0.09 },
    });
    expect(readMapsLink("https://www.google.com/maps/place/%20/")).toEqual({});
  });
});

describe("isShortMapsLink", () => {
  it("tells a short link, which must be followed, from a full one and from words", () => {
    expect(isShortMapsLink("https://maps.app.goo.gl/G5TcwgTuzbJg7i2v5?g_st=ac")).toBe(true);
    expect(isShortMapsLink("https://goo.gl/maps/abc")).toBe(true);
    expect(isShortMapsLink(FULL)).toBe(false);
    expect(isShortMapsLink("not a link at all")).toBe(false);
  });
});

describe("asLink", () => {
  it("takes words starting http:// or https:// as a link, trimmed", () => {
    expect(asLink("  https://example.com/x ")).toBe("https://example.com/x");
    expect(asLink("HTTP://maps.google.com/?q=Nopi")).toBe("HTTP://maps.google.com/?q=Nopi");
  });

  it("takes a Google Maps address without its https://", () => {
    expect(asLink("maps.app.goo.gl/G5TcwgTuzbJg7i2v5")).toBe("https://maps.app.goo.gl/G5TcwgTuzbJg7i2v5");
    expect(asLink("www.google.co.uk/maps/place/Nopi")).toBe("https://www.google.co.uk/maps/place/Nopi");
  });

  it("takes anything else as words to search for", () => {
    expect(asLink("Parliament Square")).toBeNull();
    expect(asLink("example.com/maps")).toBeNull();
    expect(asLink("a/b")).toBeNull();
  });
});
