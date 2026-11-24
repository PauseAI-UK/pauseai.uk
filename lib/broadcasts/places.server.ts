import "server-only";
import { serverProblems } from "@/lib/server/copy";
import { orFallback } from "@/lib/server/outside-services/fallback.server";
import { whereLinkLeads } from "@/lib/server/outside-services/google-maps.server";
import { photonAt, searchPhoton } from "@/lib/server/outside-services/photon.server";
import { asLink, isShortMapsLink, type Place, type Point, readMapsLink } from "./places";

// Finding the place for a WhatsApp text's map, from the one box staff fill
// in: a Google Maps link, or words to search for (lib/broadcasts/places.ts).
// Neither Google nor Photon failing stops staff: the link or the search
// finds nothing, and the failure is reported.

/** How many redirects a short link is followed through, as one could lead to another. */
const HOPS = 3;

/** The places that match some words, or none when Photon can't be asked. */
async function search(words: string): Promise<Place[]> {
  return orFallback(serverProblems.photonDown(), [], () => searchPhoton(words));
}

/** The full link a short one leads to, or null when it leads nowhere or Google can't be asked. */
async function followed(link: string): Promise<string | null> {
  return orFallback(serverProblems.mapsLinkUnfollowed(), null, async () => {
    let at: string | null = link;
    for (let hop = 0; at && isShortMapsLink(at) && hop < HOPS; hop++) at = await whereLinkLeads(at);
    return at;
  });
}

/**
 * The place at a point a link gives. Its name is the link's, up to the
 * first comma, as Google adds the town after a street's name, and the town
 * is in the address. A link without a name gets the name of what Photon
 * finds there, else its address's first part. The address is Photon's, or
 * empty when Photon knows none or can't be asked, for staff to fill in.
 */
async function placeAt(point: Point, linkName: string | undefined): Promise<Place> {
  const found = await orFallback(serverProblems.photonDown(), null, () => photonAt(point.latitude, point.longitude));
  const address = found?.address ?? "";
  const name = linkName?.split(",")[0].trim() || found?.name || address.split(",")[0];
  return { name, address, ...point };
}

/**
 * The places staff mean by what they typed in a text's place box. A Google
 * Maps link gives the one place it points at, a short link followed first;
 * one that names a place but gives no point gives the matches for its name;
 * any other link, none. Words give the places that match them.
 */
export async function findPlaces(input: string): Promise<Place[]> {
  const link = asLink(input);
  if (!link) return input.trim() ? search(input.trim()) : [];
  const full = isShortMapsLink(link) ? await followed(link) : link;
  const read = full ? readMapsLink(full) : null;
  if (read?.point) return [await placeAt(read.point, read.name)];
  return read?.name ? search(read.name) : [];
}
