import type { Fake } from "../fake";

// OpenStreetMap's map tiles: every one the same plain square, the colour
// of land, as the storyboard's frames mustn't change with the map.

const TILE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAA1BMVEXo5N5b8nX5AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAH0lEQVRo3u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAvg0hAAABfxmcpwAAAABJRU5ErkJggg==",
  "base64",
);

export const mapTilesFake: Fake = ({ hostname }) =>
  hostname === "tile.openstreetmap.org"
    ? new Response(new Uint8Array(TILE), { headers: { "Content-Type": "image/png" } })
    : undefined;
