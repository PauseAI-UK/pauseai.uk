import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { OutsideFailure } from "./outside-failure.server";
import { mapTile } from "./map-tiles.server";

describe("mapTile", () => {
  it("gives a square of OpenStreetMap's map, asking as its policy says, by name", async () => {
    let asked: Request | undefined;
    server.use(
      http.get("https://tile.openstreetmap.org/16/32744/21792.png", ({ request }) => {
        asked = request;
        return HttpResponse.arrayBuffer(new Uint8Array([137, 80, 78, 71]).buffer, {
          headers: { "Content-Type": "image/png" },
        });
      }),
    );
    expect([...(await mapTile(16, 32744, 21792))]).toEqual([137, 80, 78, 71]);
    expect(asked!.headers.get("user-agent")).toBe("PauseAI UK staff site (https://pauseai.uk)");
  });

  it("gives the fake's plain square in a fixture build's tests", async () => {
    const tile = await mapTile(1, 0, 0);
    expect([...tile.slice(1, 4)]).toEqual([80, 78, 71]);
  });

  it("fails as OpenStreetMap's, for a square it won't give", async () => {
    server.use(http.get("https://tile.openstreetmap.org/*", () => new HttpResponse(null, { status: 403 })));
    const failure = await mapTile(16, 1, 2).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(OutsideFailure);
    expect(failure).toMatchObject({ service: "map-tiles", status: 403 });
  });
});
