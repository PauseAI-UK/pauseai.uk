import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import type { TextHeader, TextPlace } from "@/lib/broadcasts/text-parts";
import TextTop, { type FindPlaces } from "./TextTop";
import { examplePlace } from "./BroadcastWriter.examples";
import { TextTopExample } from "./TextTop.gallery.client";

const copy = broadcastsCopy.broadcastPages;
const words = copy.placeChooser;

const other: TextPlace = { name: "Trafalgar Square", address: "London WC2N 5DS", latitude: 51.508, longitude: -0.128 };

async function renderTop({
  header = "location",
  place = null,
  found = [],
  fixed,
  disabled,
}: {
  header?: TextHeader | null;
  place?: TextPlace | null;
  found?: TextPlace[];
  fixed?: boolean;
  disabled?: boolean;
} = {}) {
  const onChange = vi.fn();
  const findPlaces = vi.fn<FindPlaces>(async () => found);
  const screen = await render(
    <TextTop
      header={header}
      place={place}
      onChange={onChange}
      findPlaces={findPlaces}
      fixed={fixed}
      disabled={disabled}
    />,
  );
  return { onChange, findPlaces, screen };
}

const kind = (name: string) => page.getByRole("radio", { name });
const box = () => page.getByLabelText(words.find);
const find = () => page.getByRole("button", { name: words.findButton });

describe("TextTop", () => {
  it("shows the link's card by default, saying where it comes from, and choosing Place makes the top a map", async () => {
    const { onChange } = await renderTop({ header: null });
    await expect.element(kind(copy.textTop.linkPreview)).toHaveAttribute("aria-checked", "true");
    await expect.element(page.getByText(copy.textTop.linkPreviewNote)).toBeVisible();
    expect(box().query()).toBeNull();
    await kind(copy.textTop.place).click();
    expect(onChange).toHaveBeenCalledWith({ header: "location" });
  });

  it("goes back to the link's card from a map", async () => {
    const { onChange } = await renderTop();
    await expect.element(kind(copy.textTop.place)).toHaveAttribute("aria-checked", "true");
    await kind(copy.textTop.linkPreview).click();
    expect(onChange).toHaveBeenCalledWith({ header: null });
  });

  it("keeps a chosen template's kind of top, but not its place, which can still be found and changed", async () => {
    await renderTop({ place: examplePlace, fixed: true });
    await expect.element(kind(copy.textTop.linkPreview)).toBeDisabled();
    await expect.element(kind(copy.textTop.place)).toBeDisabled();
    await expect.element(box()).toBeEnabled();
    await expect.element(page.getByLabelText(words.name)).toBeEnabled();
  });

  it("changes nothing while it's disabled", async () => {
    await renderTop({ place: examplePlace, disabled: true });
    await expect.element(kind(copy.textTop.place)).toBeDisabled();
    await expect.element(box()).toBeDisabled();
    await expect.element(find()).toBeDisabled();
    await expect.element(page.getByLabelText(words.name)).toBeDisabled();
    await expect.element(page.getByLabelText(words.address)).toBeDisabled();
  });

  it("finds nothing till something's typed, then chooses the one place found at once", async () => {
    const { onChange, findPlaces } = await renderTop({ found: [examplePlace] });
    await expect.element(find()).toBeDisabled();
    await box().fill("   ");
    await expect.element(find()).toBeDisabled();
    await userEvent.keyboard("{Enter}");
    expect(findPlaces).not.toHaveBeenCalled();
    await box().fill("  https://maps.app.goo.gl/AbCdEfGh12345 ");
    await find().click();
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ place: examplePlace }));
    expect(findPlaces).toHaveBeenCalledWith("https://maps.app.goo.gl/AbCdEfGh12345");
    expect(page.getByRole("list", { name: words.found }).query()).toBeNull();
  });

  it("finds with Enter, and offers the places found to choose one", async () => {
    const { onChange, findPlaces } = await renderTop({ found: [examplePlace, other] });
    await box().fill("square");
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => expect(findPlaces).toHaveBeenCalledWith("square"));
    const found = page.getByRole("list", { name: words.found });
    await expect.element(found.getByRole("button", { name: /Trafalgar Square/ })).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
    await found.getByRole("button", { name: new RegExp(examplePlace.address) }).click();
    expect(onChange).toHaveBeenCalledWith({ place: examplePlace });
    await expect.element(found).not.toBeInTheDocument();
  });

  it("types other keys into the box without finding", async () => {
    const { findPlaces } = await renderTop({ found: [examplePlace] });
    await box().click();
    await userEvent.keyboard("x");
    await expect.element(box()).toHaveValue("x");
    expect(findPlaces).not.toHaveBeenCalled();
  });

  it("says when no place is found", async () => {
    await renderTop({ found: [] });
    await box().fill("nowhere at all");
    await find().click();
    await expect.element(page.getByText(words.none)).toBeVisible();
    expect(page.getByRole("list", { name: words.found }).query()).toBeNull();
  });

  it("changes a chosen place's name and address, and links to its pin on a map", async () => {
    const { onChange } = await renderTop({ place: examplePlace });
    await expect
      .element(page.getByRole("link", { name: words.checkMap }))
      .toHaveAttribute("href", "https://www.openstreetmap.org/?mlat=51.5005&mlon=-0.1268#map=17/51.5005/-0.1268");
    await page.getByLabelText(words.name).fill("The square");
    expect(onChange).toHaveBeenLastCalledWith({ place: { ...examplePlace, name: "The square" } });
    await page.getByLabelText(words.address).fill("SW1");
    expect(onChange).toHaveBeenLastCalledWith({ place: { ...examplePlace, address: "SW1" } });
    await expect.element(page.getByText(words.changeable)).toBeVisible();
  });
});

describe("TextTop's examples in the gallery", () => {
  it("finds places, logging what was looked for, and takes the one chosen", async () => {
    await render(<TextTopExample initial={{ header: null, place: null }} />);
    await kind(copy.textTop.place).click();
    await box().fill("parliament");
    await find().click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent('findPlaces("parliament")');
    await page.getByRole("button", { name: /Parliament Square Garden/ }).click();
    await expect.element(page.getByLabelText(words.name)).toHaveValue("Parliament Square Garden");
  });
});
