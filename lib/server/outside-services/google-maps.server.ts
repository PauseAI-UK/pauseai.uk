import "server-only";
import { refusal } from "./outside-failure.server";
import { outsideFetch, type Outside } from "./outside-fetch.server";
import { googleMapsFake } from "@/lib/server/fixtures/fakes/places";

// Google Maps' short links (maps.app.goo.gl), which are only redirects to a
// full link, and say nothing of the place till they're followed. A browser
// can't see where another site's redirect leads, so the server asks.

const GOOGLE_MAPS: Outside = { service: "google-maps", fake: googleMapsFake };

/**
 * Where a link leads: the address its redirect gives, read rather than
 * followed, so the caller decides whether to go on, and nothing is fetched
 * from wherever it leads. Null for a link that leads nowhere, which Google
 * answers 404, as it does a short link mistyped: that's the link's fault, not
 * Google's.
 */
export async function whereLinkLeads(url: string): Promise<string | null> {
  const res = await outsideFetch(GOOGLE_MAPS, url, { redirect: "manual" });
  const location = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && location) return new URL(location, url).href;
  if (res.ok || res.status === 404) return null;
  throw refusal("google-maps", res, { asked: url });
}
