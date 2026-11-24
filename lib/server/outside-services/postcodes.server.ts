import "server-only";
import { constituencyName } from "@/lib/politicians/constituencies";
import type { FormResult } from "@/lib/form-result";
import type { Place } from "@/lib/site-events";
import { postcodesFake } from "@/lib/server/fixtures/fakes/postcodes";
import { outsideFetch, type Outside } from "./outside-fetch.server";
import { orFallback } from "./fallback.server";
import { outsideJson, refusal } from "./outside-failure.server";
import { serverProblems } from "@/lib/server/copy";

const POSTCODES: Outside = { service: "postcodes", fake: postcodesFake };

// postcodes.io: the UK's open postcode API, no key needed. It gives the
// constituency's name and its official code; we take the official name for
// the code (lib/politicians/constituencies.ts), since postcodes.io spells some differently.
// And where the postcode is, for suggesting events nearby.

export type ConstituencyResult = FormResult<
  "not-found" | "no-constituency" | "failed",
  { constituency: string; place?: Place }
>;

/** A postcode's constituency in postcodes.io's result: the official name, from its code, else postcodes.io's (lib/politicians/constituencies.ts); null for none. */
function constituencyOf(result: Record<string, unknown> | undefined): string | null {
  const name = result?.parliamentary_constituency;
  if (typeof name !== "string" || !name) return null;
  const code = (result!.codes as Record<string, unknown> | undefined)?.parliamentary_constituency;
  return (typeof code === "string" && constituencyName(code)) || name;
}

export async function constituencyForPostcode(postcode: string): Promise<ConstituencyResult> {
  return orFallback(serverProblems.postcodesDown(), { ok: false, reason: "failed" }, async () => {
    const res = await outsideFetch(POSTCODES, `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    if (res.status === 404) return { ok: false, reason: "not-found" };
    if (!res.ok) return { ok: false, reason: "failed" };
    const data = await outsideJson("postcodes", res);
    const constituency = constituencyOf(data?.result);
    if (!constituency) return { ok: false, reason: "no-constituency" };
    const { latitude, longitude } = data.result;
    const place = typeof latitude === "number" && typeof longitude === "number" ? { latitude, longitude } : undefined;
    return {
      ok: true,
      constituency,
      ...(place && { place }),
    };
  });
}

export type PostcodePlaceResult = FormResult<"not-found" | "failed", { place: Place; name: string }>;

/**
 * Where a postcode is, and its district's name ("Westminster"), for events
 * near it. The first half of one, an outcode ("M1"), will do: postcodes.io
 * gives its middle and the districts it reaches into, and we name the first.
 * Without a district, the name is the postcode as typed.
 */
export async function placeForPostcode(postcode: string): Promise<PostcodePlaceResult> {
  const code = postcode.trim();
  return orFallback(serverProblems.postcodesDown(), { ok: false, reason: "failed" }, async () => {
    const full = await placeAt(`postcodes/${encodeURIComponent(code)}`, code);
    if (full.ok || full.reason === "failed") return full;
    return await placeAt(`outcodes/${encodeURIComponent(code)}`, code);
  });
}

async function placeAt(path: string, code: string): Promise<PostcodePlaceResult> {
  const res = await outsideFetch(POSTCODES, `https://api.postcodes.io/${path}`);
  if (res.status === 404) return { ok: false, reason: "not-found" };
  if (!res.ok) return { ok: false, reason: "failed" };
  const result = (await outsideJson("postcodes", res))?.result;
  const { latitude, longitude } = result ?? {};
  if (typeof latitude !== "number" || typeof longitude !== "number") return { ok: false, reason: "not-found" };
  const district = [result.admin_district].flat()[0];
  return {
    ok: true,
    place: { latitude, longitude },
    name: typeof district === "string" && district ? district : code.toUpperCase(),
  };
}

/** Where a postcode or town is: its point, its name (a council area, or the town), and its nation, if one of ours. */
export type FoundPlace = {
  latitude: number;
  longitude: number;
  place: string;
  country: string | null;
  /** A postcode's constituency, from a bulk lookup; a town has none. */
  constituency?: string | null;
};

/** postcodes.io's nation, as the site names them ("northern-ireland"); null for one outside the four. */
function nation(country: unknown): string | null {
  const names: Record<string, string> = {
    England: "england",
    Scotland: "scotland",
    Wales: "wales",
    "Northern Ireland": "northern-ireland",
  };
  return typeof country === "string" ? (names[country] ?? null) : null;
}

/** How many postcodes postcodes.io looks up at once: more, and it refuses the lot. */
export const POSTCODES_AT_ONCE = 100;

/**
 * Where each of up to POSTCODES_AT_ONCE postcodes is, in one request: a
 * place, or null for one postcodes.io doesn't know. Throws if the request
 * fails, so nothing is recorded as unknown that wasn't.
 */
export async function placesForPostcodes(postcodes: string[]): Promise<Map<string, FoundPlace | null>> {
  const res = await outsideFetch(POSTCODES, "https://api.postcodes.io/postcodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postcodes }),
  });
  if (!res.ok) throw refusal("postcodes", res);
  const results: { query: string; result: Record<string, unknown> | null }[] = (await outsideJson("postcodes", res))
    ?.result;
  return new Map(
    results.map(({ query, result }) => [
      query,
      result && typeof result.latitude === "number" && typeof result.longitude === "number"
        ? {
            latitude: result.latitude,
            longitude: result.longitude,
            place: String(result.admin_district ?? query),
            country: nation(result.country),
            constituency: constituencyOf(result),
          }
        : null,
    ]),
  );
}

/**
 * The first half of a postcode ("SE15"), at postcodes.io's outcodes: its
 * middle and the first district it reaches into, or null for one it doesn't
 * know. It spans constituencies, so it has none. Throws if the request fails.
 */
export async function placeForOutcode(outcode: string): Promise<FoundPlace | null> {
  const res = await outsideFetch(POSTCODES, `https://api.postcodes.io/outcodes/${encodeURIComponent(outcode)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw refusal("postcodes", res);
  const result = (await outsideJson("postcodes", res))?.result;
  if (typeof result?.latitude !== "number" || typeof result?.longitude !== "number") return null;
  return {
    latitude: result.latitude,
    longitude: result.longitude,
    place: String([result.admin_district].flat()[0] ?? outcode),
    country: nation([result.country].flat()[0]),
    constituency: null,
  };
}

/**
 * A town or city by its name, at postcodes.io's places (Ordnance Survey's
 * names): the first city or town of that name, as a village can share it,
 * else the first place of any kind; null for none. Throws if the request
 * fails.
 */
export async function placeNamed(name: string): Promise<FoundPlace | null> {
  const res = await outsideFetch(POSTCODES, `https://api.postcodes.io/places?q=${encodeURIComponent(name)}&limit=10`);
  if (!res.ok) throw refusal("postcodes", res);
  const places: Record<string, unknown>[] = (await outsideJson("postcodes", res))?.result ?? [];
  const best = places.find((p) => p.local_type === "City" || p.local_type === "Town") ?? places[0];
  if (!best || typeof best.latitude !== "number" || typeof best.longitude !== "number") return null;
  return {
    latitude: best.latitude,
    longitude: best.longitude,
    place: String(best.name_1),
    country: nation(best.country),
  };
}

/**
 * What staff typed to find supporters near: a postcode, the first half of
 * one, or a town; null for none of those, or "failed" if postcodes.io
 * couldn't be asked.
 */
export async function placeFor(text: string): Promise<FoundPlace | null | "failed"> {
  const postcode = await placeForPostcode(text);
  if (postcode.ok) return { ...postcode.place, place: postcode.name, country: null };
  if (postcode.reason === "failed") return "failed";
  return orFallback(serverProblems.postcodesDown(), "failed", async () => {
    return await placeNamed(text.trim());
  });
}
