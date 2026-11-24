import { json, type Fake } from "../fake";

// postcodes.io: the fixture's postcodes, outcodes and towns.

// The constituencies postcodes.io gives, by name and official code, of the
// postcodes whose MPs are in the fixture politicians: Westminster's, and
// Jane Fixture's in Manchester.
const POSTCODES: Record<string, { name: string; code: string }> = {
  SW1A1AA: { name: "Cities of London and Westminster", code: "E14001172" },
  M11AE: { name: "Manchester Central", code: "E14001352" },
};
// And one outcode, the first half of a postcode, in Manchester.
const OUTCODES: Record<string, { latitude: number; longitude: number; admin_district: string[] }> = {
  M1: { latitude: 53.4794, longitude: -2.2353, admin_district: ["Manchester"] },
};

// Where postcodes.io places the fixture's postcodes and towns: a council area or town, its point, its nation.
const PLACES: Record<string, { admin_district: string; latitude: number; longitude: number; country: string }> = {
  BS11AA: { admin_district: "Bristol, City of", latitude: 51.4545, longitude: -2.5879, country: "England" },
  E16AN: { admin_district: "Tower Hamlets", latitude: 51.5205, longitude: -0.0726, country: "England" },
  E151AA: { admin_district: "Newham", latitude: 51.5413, longitude: -0.0039, country: "England" },
  EC1A1BB: { admin_district: "City of London", latitude: 51.5202, longitude: -0.0978, country: "England" },
  G11AA: { admin_district: "Glasgow City", latitude: 55.8609, longitude: -4.249, country: "Scotland" },
  HU11AA: { admin_district: "Kingston upon Hull, City of", latitude: 53.7443, longitude: -0.3326, country: "England" },
  LE11AA: { admin_district: "Leicester", latitude: 52.6345, longitude: -1.13, country: "England" },
  LS11AA: { admin_district: "Leeds", latitude: 53.797, longitude: -1.5492, country: "England" },
  LS27EY: { admin_district: "Leeds", latitude: 53.8079, longitude: -1.5566, country: "England" },
  M11AE: { admin_district: "Manchester", latitude: 53.4794, longitude: -2.2353, country: "England" },
  M41HQ: { admin_district: "Manchester", latitude: 53.484, longitude: -2.237, country: "England" },
  M202RN: { admin_district: "Manchester", latitude: 53.4317, longitude: -2.2303, country: "England" },
  NR11AA: { admin_district: "Norwich", latitude: 52.6286, longitude: 1.2925, country: "England" },
  OX11AA: { admin_district: "Oxford", latitude: 51.752, longitude: -1.2577, country: "England" },
  SE17PB: { admin_district: "Lambeth", latitude: 51.5007, longitude: -0.1167, country: "England" },
  SK41AA: { admin_district: "Stockport", latitude: 53.4106, longitude: -2.1575, country: "England" },
  YO17HH: { admin_district: "York", latitude: 53.9617, longitude: -1.0817, country: "England" },
  SW1A1AA: { admin_district: "Westminster", latitude: 51.501009, longitude: -0.141588, country: "England" },
};
const TOWNS: Record<
  string,
  { name_1: string; local_type: string; latitude: number; longitude: number; country: string }
> = {
  manchester: { name_1: "Manchester", local_type: "City", latitude: 53.4794, longitude: -2.2453, country: "England" },
  london: { name_1: "London", local_type: "City", latitude: 51.5072, longitude: -0.1276, country: "England" },
  bristol: { name_1: "Bristol", local_type: "City", latitude: 51.4545, longitude: -2.5879, country: "England" },
  cardiff: { name_1: "Cardiff", local_type: "City", latitude: 51.4816, longitude: -3.1791, country: "Wales" },
  oxford: { name_1: "Oxford", local_type: "City", latitude: 51.752, longitude: -1.2577, country: "England" },
  leeds: { name_1: "Leeds", local_type: "City", latitude: 53.7997, longitude: -1.5492, country: "England" },
  glasgow: { name_1: "Glasgow", local_type: "City", latitude: 55.8642, longitude: -4.2518, country: "Scotland" },
  leicester: { name_1: "Leicester", local_type: "City", latitude: 52.6369, longitude: -1.1398, country: "England" },
};

export const postcodesFake: Fake = ({ hostname, pathname, searchParams }, init) => {
  if (hostname === "api.postcodes.io" && pathname === "/postcodes" && init?.method === "POST") {
    // A bulk lookup: each postcode with its place, or null.
    const { postcodes } = JSON.parse(String(init.body)) as { postcodes: string[] };
    return json({
      status: 200,
      result: postcodes.map((query) => {
        const key = query.replace(/\s+/g, "").toUpperCase();
        const place = PLACES[key];
        const constituency = POSTCODES[key] && {
          parliamentary_constituency: POSTCODES[key].name,
          codes: { parliamentary_constituency: POSTCODES[key].code },
        };
        return { query, result: place ? { postcode: query, ...place, ...constituency } : null };
      }),
    });
  }
  if (hostname === "api.postcodes.io" && pathname === "/places") {
    const town = TOWNS[String(searchParams.get("q")).trim().toLowerCase()];
    return json({ status: 200, result: town ? [town] : [] });
  }
  if (hostname === "api.postcodes.io" && pathname.startsWith("/postcodes/")) {
    // A postcode the fixture places, at its own point and in its own district, with its constituency where we know it.
    const postcode = decodeURIComponent(pathname.slice("/postcodes/".length)).replace(/\s+/g, "").toUpperCase();
    const place = PLACES[postcode];
    const constituency = POSTCODES[postcode];
    return place
      ? json({
          status: 200,
          result: {
            postcode,
            ...place,
            ...(constituency && {
              parliamentary_constituency: constituency.name,
              codes: { parliamentary_constituency: constituency.code },
            }),
          },
        })
      : new Response(JSON.stringify({ status: 404, error: "Postcode not found" }), { status: 404 });
  }
  if (hostname === "api.postcodes.io" && pathname.startsWith("/outcodes/")) {
    const outcode = decodeURIComponent(pathname.slice("/outcodes/".length)).trim().toUpperCase();
    const result = OUTCODES[outcode];
    return result
      ? json({ status: 200, result: { outcode, ...result } })
      : new Response(JSON.stringify({ status: 404, error: "Outcode not found" }), { status: 404 });
  }
  return undefined;
};
