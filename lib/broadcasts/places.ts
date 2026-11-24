// A place on a map, as a WhatsApp text's location header gives it: a point
// and the name and address shown under the map
// (https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components#location-header).
// Staff give one as a Google Maps link or as words to search for
// (lib/broadcasts/places.server.ts). This reads what a link says.
//
// Google doesn't document its links' forms, so the reading is tested on each
// form we've seen. A full link names the place in its path
// (/maps/place/Parliament+Square/) and carries a point in one of several
// ways. A short link (maps.app.goo.gl) carries neither until it's followed.

/** A place: its point, and its name and address as WhatsApp shows them under the map. */
export type Place = { name: string; address: string; latitude: number; longitude: number };

/** A point on earth. */
export type Point = { latitude: number; longitude: number };

/** What a Google Maps link says of the place it points at: either or both may be missing. */
export type MapsLink = { name?: string; point?: Point };

/**
 * Two numbers that could be a point. Written out, not taken from any pair
 * of numbers, as a link is full of numbers that aren't coordinates, such as
 * a zoom level or a place's ID, and one read as a point puts the pin in the sea.
 */
const POINT = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;

/** The place's own point, where Google put the pin, as it writes it into a link's data: `!3d51.50!4d-0.12`. */
const DATA_POINT = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;

/** The point the map opens on: `/@51.50,-0.12,17z`. */
const CAMERA = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;

/** The parameters Google writes a place's name, or a point, into. */
const QUERY_KEYS = ["q", "query", "daddr"];

/** The parameters that are only ever a point. */
const POINT_KEYS = ["ll", "center", "sll"];

/** A link's host, lowercased, or "" for words that aren't a link. */
function hostOf(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname.toLowerCase() : "";
}

/** The hosts of Google's short links, each only a redirect to a full one. */
const SHORT_HOSTS = ["maps.app.goo.gl", "goo.gl"];

/** Whether a link is a short one, which says nothing until it's followed to the full link it leads to. */
export function isShortMapsLink(url: string): boolean {
  return SHORT_HOSTS.includes(hostOf(url));
}

/** Whether a host is Google Maps', on any of Google's country domains (google.co.uk), or a short link's. */
function mapsHost(host: string): boolean {
  return /^(?:www\.|maps\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(host) || SHORT_HOSTS.includes(host);
}

/** The point two numbers name, or none where they aren't one on earth. */
function point(text: string): Point | undefined {
  const found = POINT.exec(text.replace(/^loc:/, "").replace(/\s*,\s*/, ","));
  if (!found) return undefined;
  const latitude = Number(found[1]);
  const longitude = Number(found[2]);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : undefined;
}

/** The first of these parameters that's there and isn't blank. */
function param(url: URL, keys: string[]): string | undefined {
  return keys.map((key) => url.searchParams.get(key)?.trim()).find((value) => value);
}

/** The path's part after /place/ or /search/, which names the place or gives its point. */
function placeSegment(pathname: string): string | undefined {
  const found = /\/(?:place|search)\/([^/]+)/.exec(pathname);
  if (!found) return undefined;
  // Decoded as a form's value is, "+" as a space, which never throws: an
  // escape that isn't UTF-8 becomes U+FFFD, the mark of a path Google didn't
  // write, so nothing in it is a name worth trusting.
  const decoded = new URLSearchParams(`x=${found[1].replaceAll("&", "%26")}`).get("x")!;
  return decoded.includes("�") ? undefined : decoded.trim();
}

/**
 * Where the link says the place is, from the most trustworthy form it has:
 * the data's !3d!4d is where Google put the pin, while @ is only where the
 * map opens, which is close to the place but never the same.
 */
function pointIn(url: URL): Point | undefined {
  const data = DATA_POINT.exec(url.href);
  if (data) return point(`${data[1]},${data[2]}`);
  const named = param(url, POINT_KEYS) ?? param(url, QUERY_KEYS);
  const camera = CAMERA.exec(url.pathname);
  const segment = placeSegment(url.pathname);
  return (
    (named ? point(named) : undefined) ??
    (camera ? point(`${camera[1]},${camera[2]}`) : undefined) ??
    (segment ? point(segment) : undefined)
  );
}

/** What the link calls the place, where that's a name rather than a point. */
function nameIn(url: URL): string | undefined {
  const named = [placeSegment(url.pathname), param(url, QUERY_KEYS)];
  return named.find((name) => name && !point(name));
}

/**
 * What a Google Maps link says of the place it points at, or null for a
 * link that isn't Google Maps', or words that aren't a link. A `?q=` search
 * gives a name and no point; a short link gives neither till it's followed.
 */
export function readMapsLink(url: string): MapsLink | null {
  if (!URL.canParse(url)) return null;
  const parsed = new URL(url);
  if (!mapsHost(parsed.hostname.toLowerCase())) return null;
  const name = nameIn(parsed);
  const at = pointIn(parsed);
  return { ...(name && { name }), ...(at && { point: at }) };
}

/**
 * What staff typed, as a link if it is one: one starting http:// or
 * https://, or a Google Maps address without it (maps.app.goo.gl/…), as
 * it's copied from some apps. Null for words to search for.
 */
export function asLink(input: string): string | null {
  const typed = input.trim();
  if (/^https?:\/\//i.test(typed)) return typed;
  return /^[\w.-]+\//.test(typed) && mapsHost(hostOf(`https://${typed}`)) ? `https://${typed}` : null;
}
