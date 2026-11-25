// Where a place falls on OpenStreetMap's map tiles: the squares, 256
// pixels each, that number the world at each zoom from its top left
// (https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames), and the
// three by three of them around a place, laid so the place is at the
// middle of whatever shows them.

/** A tile's width and height, in pixels. */
export const TILE_PIXELS = 256;

/** The zoom a place's map is at: its streets and their names. */
export const PLACE_ZOOM = 16;

/** The point on the map at `zoom`, in tiles from its top left, of a latitude and longitude. */
export function tilePoint(latitude: number, longitude: number, zoom: number): { x: number; y: number } {
  const tiles = 2 ** zoom;
  const radians = (latitude * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * tiles,
    y: ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * tiles,
  };
}

/**
 * The three by three tiles around a place, by column and row, each with
 * where it goes in their square of 768 pixels; and where that square goes,
 * from the middle of what shows it, in pixels, so the place is there.
 */
export function tilesAround(latitude: number, longitude: number, zoom = PLACE_ZOOM) {
  const point = tilePoint(latitude, longitude, zoom);
  const first = { x: Math.floor(point.x) - 1, y: Math.floor(point.y) - 1 };
  const tiles = [0, 1, 2].flatMap((row) =>
    [0, 1, 2].map((column) => ({
      x: first.x + column,
      y: first.y + row,
      left: column * TILE_PIXELS,
      top: row * TILE_PIXELS,
    })),
  );
  return {
    zoom,
    tiles,
    left: -Math.round((point.x - first.x) * TILE_PIXELS),
    top: -Math.round((point.y - first.y) * TILE_PIXELS),
  };
}
