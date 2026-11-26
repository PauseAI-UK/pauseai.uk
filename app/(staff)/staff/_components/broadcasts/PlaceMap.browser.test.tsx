import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import PlaceMap, { realMapsContext } from "./PlaceMap";
import { examplePlace } from "./BroadcastWriter.examples";

const words = broadcastsCopy.broadcastPages.placeChooser;

describe("PlaceMap", () => {
  it("draws a map, unless the writer says to show OpenStreetMap's, under a link to the place on Google Maps", async () => {
    const { container } = await render(<PlaceMap place={examplePlace} />);
    await expect
      .element(page.getByRole("link", { name: words.checkMap }))
      .toHaveAttribute("href", "https://www.google.com/maps?q=51.5005,-0.1268");
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(page.getByText("© OpenStreetMap").query()).toBeNull();
  });

  it("shows OpenStreetMap's squares round the place from the site's route, with its credit", async () => {
    const { container } = await render(
      <realMapsContext.Provider value={true}>
        <PlaceMap place={examplePlace} />
      </realMapsContext.Provider>,
    );
    await expect.element(page.getByText("© OpenStreetMap")).toBeVisible();
    const tiles = [...container.querySelectorAll("img")].map((tile) => tile.getAttribute("src"));
    expect(tiles).toHaveLength(9);
    expect(tiles[4]).toBe("/staff/map-tiles/16/32744/21794");
  });
});
