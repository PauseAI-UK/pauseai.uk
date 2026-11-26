import { describe, expect, it } from "vitest";
import { tilesAround } from "./map-tiles";

describe("tilesAround", () => {
  it("gives the three by three tiles round a place, by column and row, each where it goes in their square", () => {
    const around = tilesAround(51.5005, -0.1268);
    expect(around.zoom).toBe(16);
    // Parliament Square is in tile 32744 across and 21794 down at zoom 16.
    expect(around.tiles).toHaveLength(9);
    expect(around.tiles[0]).toEqual({ x: 32743, y: 21793, left: 0, top: 0 });
    expect(around.tiles[4]).toEqual({ x: 32744, y: 21794, left: 256, top: 256 });
    expect(around.tiles[8]).toEqual({ x: 32745, y: 21795, left: 512, top: 512 });
  });

  it("moves their square so the place is at the middle of what shows it, within the middle tile", () => {
    const { left, top } = tilesAround(51.5005, -0.1268);
    expect(left).toBeLessThanOrEqual(-256);
    expect(left).toBeGreaterThan(-512);
    expect(top).toBeLessThanOrEqual(-256);
    expect(top).toBeGreaterThan(-512);
  });

  it("takes another zoom", () => {
    expect(tilesAround(0, 0, 1).tiles[4]).toMatchObject({ x: 1, y: 1 });
  });
});
