// Photon's and Google Maps' fakes, for finding a WhatsApp text's place
// (lib/broadcasts/places.server.ts): two places in London Photon knows, and
// one short Google Maps link, which leads to a full link for one of them.

/** The short link the fakes know, as Google Maps' Share button makes one. */
export const SHORT_MAPS_LINK = "https://maps.app.goo.gl/G5TcwgTuzbJg7i2v5";

/** Where it leads: a full link for All Souls' Place, in the form Google writes one. */
export const FULL_MAPS_LINK =
  "https://www.google.com/maps/place/All+Souls'+Place,+London/@51.5177,-0.1437,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d51.5177!4d-0.1437";

/** The places Photon knows, as its features give them: Parliament Square with the part of town, All Souls' Place without. */
const FEATURES = [
  {
    geometry: { type: "Point", coordinates: [-0.1268, 51.5005] },
    properties: {
      name: "Parliament Square",
      locality: "Westminster",
      city: "London",
      postcode: "SW1P 3BD",
      country: "United Kingdom",
      countrycode: "GB",
    },
  },
  {
    geometry: { type: "Point", coordinates: [-0.1437, 51.5177] },
    properties: {
      name: "All Souls' Place",
      city: "London",
      postcode: "W1B 3DA",
      country: "United Kingdom",
      countrycode: "GB",
    },
  },
];

/** How far from a place, in degrees each way, Photon's reverse search finds it. */
const NEAR = 0.002;

/** Words with only their letters and digits, lowercased, so "all souls place" matches "All Souls' Place". */
const plain = (words: string) => words.toLowerCase().replace(/[^a-z0-9]/g, "");

function collection(features: typeof FEATURES): Response {
  return new Response(JSON.stringify({ type: "FeatureCollection", features }), {
    headers: { "Content-Type": "application/json" },
  });
}

/** Photon's answer: a search finds the places whose names hold its words; the reverse search, a place near the point. */
export function photonResponse(pathname: string, params: URLSearchParams): Response | undefined {
  if (pathname === "/api/") {
    const words = plain(params.get("q") ?? "");
    return collection(FEATURES.filter((feature) => words && plain(feature.properties.name).includes(words)));
  }
  if (pathname === "/reverse") {
    const lat = Number(params.get("lat"));
    const lon = Number(params.get("lon"));
    return collection(
      FEATURES.filter(
        ({
          geometry: {
            coordinates: [longitude, latitude],
          },
        }) => Math.abs(latitude - lat) < NEAR && Math.abs(longitude - lon) < NEAR,
      ),
    );
  }
  return undefined;
}

/** A short link's answer: the known one redirects to its full link, as Google's do; any other is Google's 404. */
export function shortLinkResponse(pathname: string): Response {
  return pathname === new URL(SHORT_MAPS_LINK).pathname
    ? new Response(null, { status: 302, headers: { Location: FULL_MAPS_LINK } })
    : new Response("Not found", { status: 404 });
}
