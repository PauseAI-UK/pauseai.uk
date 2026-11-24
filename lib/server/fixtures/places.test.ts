import { describe, expect, it } from "vitest";
import { fixtureResponse } from "./outside-services";
import { FULL_MAPS_LINK, SHORT_MAPS_LINK } from "./places";

const names = async (res: Response | undefined) =>
  ((await res!.json()) as { features: { properties: { name: string } }[] }).features.map((f) => f.properties.name);

describe("Photon's fake", () => {
  it("finds the places whose names hold the words, whatever their case and punctuation", async () => {
    expect(await names(fixtureResponse("https://photon.komoot.io/api/?q=all+souls+place"))).toEqual([
      "All Souls' Place",
    ]);
    expect(await names(fixtureResponse("https://photon.komoot.io/api/?q=Parliament"))).toEqual(["Parliament Square"]);
    expect(await names(fixtureResponse("https://photon.komoot.io/api/?q=Nowhere"))).toEqual([]);
  });

  it("finds nothing for no words", async () => {
    expect(await names(fixtureResponse("https://photon.komoot.io/api/?q="))).toEqual([]);
    expect(await names(fixtureResponse("https://photon.komoot.io/api/"))).toEqual([]);
  });

  it("finds a place near a point in its reverse search, and nothing far from one", async () => {
    expect(await names(fixtureResponse("https://photon.komoot.io/reverse?lat=51.5177&lon=-0.1437"))).toEqual([
      "All Souls' Place",
    ]);
    expect(await names(fixtureResponse("https://photon.komoot.io/reverse?lat=51.5177&lon=-0.2"))).toEqual([]);
    expect(await names(fixtureResponse("https://photon.komoot.io/reverse?lat=52&lon=-0.1437"))).toEqual([]);
  });

  it("has nothing for Photon's other paths", () => {
    expect(fixtureResponse("https://photon.komoot.io/status")).toBeUndefined();
  });
});

describe("Google's short links' fake", () => {
  it("redirects the one it knows to its full link, and 404s the rest", () => {
    const known = fixtureResponse(SHORT_MAPS_LINK)!;
    expect(known.status).toBe(302);
    expect(known.headers.get("location")).toBe(FULL_MAPS_LINK);
    expect(fixtureResponse("https://maps.app.goo.gl/unknown")!.status).toBe(404);
  });
});
