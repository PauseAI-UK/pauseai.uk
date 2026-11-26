import "server-only";
import { outsideJson, refusal } from "./outside-failure.server";
import { outsideFetch, type Outside } from "./outside-fetch.server";
import { photonFake } from "@/lib/server/fixtures/fakes/places";

// Photon (https://photon.komoot.io), komoot's free geocoder built on
// OpenStreetMap, which needs no key and copes with typos: the places that
// match some words, and the address at a point. Its public server makes no
// promises, so a caller carries on without it (lib/broadcasts/places.server.ts).

const PHOTON: Outside = { service: "photon", fake: photonFake };

/** A place Photon knows: its OpenStreetMap name, its address written as a UK one is, and its point. */
export type PhotonPlace = { name: string; address: string; latitude: number; longitude: number };

/** What Photon knows of a point: the name of what's there, if it has one, and its address. */
export type PhotonPoint = { name?: string; address: string };

/** A feature's properties, as far as we read them (https://github.com/komoot/photon). */
type Properties = {
  name?: string;
  housenumber?: string;
  street?: string;
  locality?: string;
  district?: string;
  city?: string;
  postcode?: string;
  country?: string;
  countrycode?: string;
};

type Feature = { geometry: { coordinates: [number, number] }; properties: Properties };

/** How many matches a search gives. */
const MATCHES = 8;

/**
 * Where searches look: a box round the UK, Northern Ireland and the
 * islands with it, west, south, east, north, so "Victoria Park" finds only
 * ours, as a text's place is somewhere its supporters can go. Within it,
 * they lean towards the middle of Great Britain.
 */
const UK = { bbox: "-8.7,49.8,1.8,60.9", lat: "54", lon: "-2.5", zoom: "6" };

/**
 * A feature's address as a UK one is written: its street, with its number,
 * the part of town, then the town and postcode, and the country only if
 * it's not ours. Empty where Photon gives none of these.
 */
function addressOf(p: Properties): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const town = [p.city, p.postcode].filter(Boolean).join(" ");
  const country = p.countrycode === "GB" ? undefined : p.country;
  return [street, p.locality ?? p.district, town, country].filter(Boolean).join(", ");
}

/**
 * Photon's features, from its answer, or a failure for one that isn't ok.
 * Its public server is often busy for a moment, so a 503 is asked again,
 * twice, a little later each time; but not when it asks for longer than a
 * few seconds, as someone is waiting on the page, and Netlify cuts a request
 * off at 30, so the caller carries on without it.
 */
async function features(url: string): Promise<Feature[]> {
  const res = await outsideFetch(PHOTON, url, {
    headers: { accept: "application/json" },
    retries: 2,
    mostWait: 4,
  });
  if (!res.ok) throw refusal("photon", res, { asked: new URL(url).pathname });
  return ((await outsideJson("photon", res))?.features ?? []) as Feature[];
}

/**
 * The places that match some words, best first, those without a name left
 * out, as there's nothing to call them, and each name and address given once,
 * as OpenStreetMap can have one place as several features.
 */
export async function searchPhoton(words: string): Promise<PhotonPlace[]> {
  const query = new URLSearchParams({ q: words, limit: String(MATCHES), lang: "en", ...UK });
  const found = await features(`https://photon.komoot.io/api/?${query}`);
  const places = found.flatMap(({ geometry, properties }) =>
    properties.name
      ? [
          {
            name: properties.name,
            address: addressOf(properties),
            latitude: geometry.coordinates[1],
            longitude: geometry.coordinates[0],
          },
        ]
      : [],
  );
  return places.filter(
    (place, i) => places.findIndex((other) => other.name === place.name && other.address === place.address) === i,
  );
}

/** What's at a point, as Photon's reverse search finds it, or null where it knows nothing there. */
export async function photonAt(latitude: number, longitude: number): Promise<PhotonPoint | null> {
  const query = new URLSearchParams({ lat: String(latitude), lon: String(longitude), limit: "1", lang: "en" });
  const [feature] = await features(`https://photon.komoot.io/reverse?${query}`);
  if (!feature) return null;
  const { name } = feature.properties;
  return { ...(name && { name }), address: addressOf(feature.properties) };
}
