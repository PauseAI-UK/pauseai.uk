import { requireStaff } from "@/lib/accounts/auth.server";
import { MOST_ZOOM, mapTile } from "@/lib/server/outside-services/map-tiles.server";

// A square of OpenStreetMap's map, for a text's place in the broadcast
// writer (PlaceMap): fetched for staff only, so the site is no one else's
// way to OpenStreetMap, and kept a week in the browser, as its policy asks.

type Params = { params: Promise<{ zoom: string; x: string; y: string }> };

/** A whole number from 0 below `end`, from an address's part; else undefined. */
function within(part: string, end: number): number | undefined {
  const n = /^\d{1,7}$/.test(part) ? Number(part) : NaN;
  return n < end ? n : undefined;
}

export async function GET(_request: Request, { params }: Params): Promise<Response> {
  await requireStaff();
  const parts = await params;
  const zoom = within(parts.zoom, MOST_ZOOM + 1);
  const x = zoom === undefined ? undefined : within(parts.x, 2 ** zoom);
  const y = zoom === undefined ? undefined : within(parts.y.replace(/\.png$/, ""), 2 ** zoom);
  if (zoom === undefined || x === undefined || y === undefined) return new Response(null, { status: 404 });
  return new Response(await mapTile(zoom, x, y), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=604800" },
  });
}
