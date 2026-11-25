import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { OutsideFailure } from "./outside-failure.server";
import { photonAt, searchPhoton } from "./photon.server";

const SEARCH = "https://photon.komoot.io/api/";
const REVERSE = "https://photon.komoot.io/reverse";

/** A feature as Photon gives one, at a point in London. */
const feature = (properties: object) => ({ geometry: { coordinates: [-0.1, 51.5] }, properties });

describe("searchPhoton", () => {
  it("gives the places matching the words, each with its address written as a UK one is", async () => {
    expect(await searchPhoton("Parliament Square")).toEqual([
      { name: "Parliament Square", address: "Westminster, London SW1P 3BD", latitude: 51.5005, longitude: -0.1268 },
    ]);
  });

  it("asks for a few matches in English, leaning towards the UK", async () => {
    let asked: URL | undefined;
    server.use(
      http.get(SEARCH, ({ request }) => {
        asked = new URL(request.url);
        return HttpResponse.json({ features: [] });
      }),
    );
    expect(await searchPhoton("All Souls")).toEqual([]);
    expect(Object.fromEntries(asked!.searchParams)).toEqual({
      q: "All Souls",
      limit: "8",
      lang: "en",
      bbox: "-8.7,49.8,1.8,60.9",
      lat: "54",
      lon: "-2.5",
      zoom: "6",
    });
  });

  it("writes the number with the street, a district where there's no locality, and the country if it's not ours", async () => {
    server.use(
      http.get(SEARCH, () =>
        HttpResponse.json({
          features: [
            feature({
              name: "Padella",
              housenumber: "6",
              street: "Southwark Street",
              district: "Borough",
              city: "London",
              postcode: "SE1 1TQ",
              country: "United Kingdom",
              countrycode: "GB",
            }),
            feature({
              name: "Bundestag",
              street: "Platz der Republik",
              city: "Berlin",
              country: "Germany",
              countrycode: "DE",
            }),
            feature({ name: "Somewhere" }),
          ],
        }),
      ),
    );
    expect((await searchPhoton("x")).map((place) => place.address)).toEqual([
      "6 Southwark Street, Borough, London SE1 1TQ",
      "Platz der Republik, Berlin, Germany",
      "",
    ]);
  });

  it("leaves out a place with no name, and gives a place OpenStreetMap has twice once", async () => {
    const square = { name: "Parliament Square", city: "London" };
    server.use(
      http.get(SEARCH, () =>
        HttpResponse.json({
          features: [
            feature({ city: "London" }),
            feature(square),
            feature(square),
            feature({ ...square, city: "Leeds" }),
          ],
        }),
      ),
    );
    expect((await searchPhoton("x")).map((place) => place.address)).toEqual(["London", "Leeds"]);
  });

  it("gives nothing for an answer without features", async () => {
    server.use(http.get(SEARCH, () => HttpResponse.json({})));
    expect(await searchPhoton("x")).toEqual([]);
    server.use(http.get(SEARCH, () => HttpResponse.json(null)));
    expect(await searchPhoton("x")).toEqual([]);
  });

  it("throws Photon's failure for an answer that isn't ok", async () => {
    server.use(http.get(SEARCH, () => new HttpResponse("Bad gateway", { status: 502 })));
    const failure = await searchPhoton("x").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(OutsideFailure);
    expect(failure).toMatchObject({ service: "photon", kind: "refused", status: 502 });
    expect(String(failure)).toContain("Photon answered 502 for /api/");
  });
});

describe("photonAt", () => {
  it("gives the name of what's at a point and its address", async () => {
    expect(await photonAt(51.5005, -0.1268)).toEqual({
      name: "Parliament Square",
      address: "Westminster, London SW1P 3BD",
    });
  });

  it("asks for the one thing nearest the point", async () => {
    let asked: URL | undefined;
    server.use(
      http.get(REVERSE, ({ request }) => {
        asked = new URL(request.url);
        return HttpResponse.json({ features: [] });
      }),
    );
    expect(await photonAt(51.5, -0.1)).toBeNull();
    expect(Object.fromEntries(asked!.searchParams)).toEqual({ lat: "51.5", lon: "-0.1", limit: "1", lang: "en" });
  });

  it("gives an address without a name where what's there has none", async () => {
    server.use(
      http.get(REVERSE, () =>
        HttpResponse.json({ features: [feature({ housenumber: "6", street: "Southwark Street", city: "London" })] }),
      ),
    );
    expect(await photonAt(51.5, -0.1)).toEqual({ address: "6 Southwark Street, London" });
  });

  it("throws Photon's failure for an answer that isn't ok", async () => {
    server.use(http.get(REVERSE, () => new HttpResponse(null, { status: 429 })));
    await expect(photonAt(51.5, -0.1)).rejects.toMatchObject({ service: "photon", kind: "rate-limited" });
  });
});
