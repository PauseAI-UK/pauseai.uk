import "server-only";
import { refusal } from "./outside-failure.server";
import { outsideFetch, type Outside } from "./outside-fetch.server";
import { mapTilesFake } from "@/lib/server/fixtures/fakes/map-tiles";

// OpenStreetMap's map, cut into squares of 256 pixels at each zoom, for a
// text's place in the broadcast writer. Its tile servers take light use
// like this, named as its policy asks, and nothing in bulk
// (https://operations.osmfoundation.org/policies/tiles/).

const MAP_TILES: Outside = { service: "map-tiles", fake: mapTilesFake };

/** The most a tile's zoom can be: a building's width across it. */
export const MOST_ZOOM = 19;

/** A tile's square of the map, a PNG, by its zoom and its column and row at that zoom. */
export async function mapTile(zoom: number, x: number, y: number): Promise<Uint8Array<ArrayBuffer>> {
  const url = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
  const res = await outsideFetch(MAP_TILES, url, {
    headers: { "user-agent": "PauseAI UK staff site (https://pauseai.uk)", referer: "https://pauseai.uk/" },
  });
  if (!res.ok) throw refusal("map-tiles", res, { asked: url });
  return new Uint8Array(await res.arrayBuffer());
}
