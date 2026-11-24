import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { serverProblems } from "@/lib/server/copy";
import { SHORT_MAPS_LINK } from "@/lib/server/fixtures/places";
import { inRun } from "@/lib/server/run-store.server";
import { findPlaces } from "./places.server";

const SEARCH = "https://photon.komoot.io/api/";
const REVERSE = "https://photon.komoot.io/reverse";

const PARLIAMENT_SQUARE = {
  name: "Parliament Square",
  address: "Westminster, London SW1P 3BD",
  latitude: 51.5005,
  longitude: -0.1268,
};

/** The places found, and the problems reported finding them. */
async function found(input: string) {
  return inRun(async (run) => ({ places: await findPlaces(input), problems: run.problems.map((p) => p.code) }));
}

afterEach(() => vi.restoreAllMocks());

describe("findPlaces from words", () => {
  it("gives Photon's matches", async () => {
    expect(await found("  Parliament Square ")).toEqual({ places: [PARLIAMENT_SQUARE], problems: [] });
  });

  it("gives none for no words, asking no one", async () => {
    expect(await found("   ")).toEqual({ places: [], problems: [] });
  });

  it("gives none when Photon can't be asked, and reports it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get(SEARCH, () => new HttpResponse(null, { status: 500 })));
    expect(await found("Parliament Square")).toEqual({ places: [], problems: [serverProblems.photonDown().code] });
  });
});

describe("findPlaces from a Google Maps link", () => {
  it("follows a short link, naming the place as the link does up to its town, with Photon's address", async () => {
    expect(await found(SHORT_MAPS_LINK)).toEqual({
      places: [{ name: "All Souls' Place", address: "London W1B 3DA", latitude: 51.5177, longitude: -0.1437 }],
      problems: [],
    });
  });

  it("reads a full link without following anything", async () => {
    expect(await found("https://www.google.com/maps/place/Big+Ben/@51.5005,-0.1268,17z")).toEqual({
      places: [{ ...PARLIAMENT_SQUARE, name: "Big Ben" }],
      problems: [],
    });
  });

  it("names a point without a name as Photon names what's there", async () => {
    expect(await found("https://www.google.com/maps/@51.5005,-0.1268,17z")).toEqual({
      places: [PARLIAMENT_SQUARE],
      problems: [],
    });
  });

  it("names it from its address's first part where what's there has no name", async () => {
    server.use(
      http.get(REVERSE, () =>
        HttpResponse.json({
          features: [
            { geometry: { coordinates: [-0.1, 51.5] }, properties: { street: "Southwark Street", city: "London" } },
          ],
        }),
      ),
    );
    expect((await found("https://www.google.com/maps/@51.5,-0.1,17z")).places).toEqual([
      { name: "Southwark Street", address: "Southwark Street, London", latitude: 51.5, longitude: -0.1 },
    ]);
  });

  it("takes Photon's name where the link's is only a town after a comma", async () => {
    expect((await found("https://www.google.com/maps/place/,+London/@51.5005,-0.1268,17z")).places[0].name).toBe(
      "Parliament Square",
    );
  });

  it("leaves the name and address empty where Photon knows nothing at the point, for staff to fill in", async () => {
    expect(await found("https://www.google.com/maps/@10,10,17z")).toEqual({
      places: [{ name: "", address: "", latitude: 10, longitude: 10 }],
      problems: [],
    });
  });

  it("keeps the link's place without an address when Photon can't be asked, and reports it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get(REVERSE, () => HttpResponse.error()));
    expect(await found("https://www.google.com/maps/place/Big+Ben/@51.5005,-0.1268,17z")).toEqual({
      places: [{ name: "Big Ben", address: "", latitude: 51.5005, longitude: -0.1268 }],
      problems: [serverProblems.photonDown().code],
    });
  });

  it("searches for the name of a link that gives no point", async () => {
    expect((await found("https://maps.google.co.uk/?q=Parliament+Square")).places).toEqual([PARLIAMENT_SQUARE]);
  });

  it("gives none for a link that's not Google Maps', or says nothing of a place", async () => {
    expect(await found("https://example.com/maps/place/Parliament+Square")).toEqual({ places: [], problems: [] });
    expect(await found("https://www.google.com/maps")).toEqual({ places: [], problems: [] });
  });

  it("gives none for a short link that leads nowhere", async () => {
    expect(await found("maps.app.goo.gl/unknown")).toEqual({ places: [], problems: [] });
  });

  it("follows a short link that leads to another, but not on and on", async () => {
    let hops = 0;
    server.use(
      http.get("https://maps.app.goo.gl/:id", ({ params }) => {
        hops++;
        const next = params.id === "first" ? "https://maps.app.goo.gl/G5TcwgTuzbJg7i2v5" : "https://goo.gl/again";
        return params.id === "first" || params.id === "loop"
          ? new HttpResponse(null, { status: 302, headers: { Location: next } })
          : undefined;
      }),
      http.get("https://goo.gl/again", () => {
        hops++;
        return new HttpResponse(null, { status: 302, headers: { Location: "https://maps.app.goo.gl/loop" } });
      }),
    );
    expect((await found("https://maps.app.goo.gl/first")).places[0].name).toBe("All Souls' Place");
    expect(hops).toBe(2);
    hops = 0;
    expect(await found("https://maps.app.goo.gl/loop")).toEqual({ places: [], problems: [] });
    expect(hops).toBe(3);
  });

  it("gives none when Google can't be asked, and reports it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get(SHORT_MAPS_LINK, () => new HttpResponse(null, { status: 500 })));
    expect(await found(SHORT_MAPS_LINK)).toEqual({
      places: [],
      problems: [serverProblems.mapsLinkUnfollowed().code],
    });
  });
});
