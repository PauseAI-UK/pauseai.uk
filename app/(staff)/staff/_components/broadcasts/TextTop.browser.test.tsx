import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import type { TextHeader, TextPlace } from "@/lib/broadcasts/text-parts";
import TextTop, { pictureSource, type FindPlaces, type UploadPicture } from "./TextTop";
import { examplePictureId, examplePlace } from "./BroadcastWriter.examples";
import { TextTopExample } from "./TextTop.gallery.client";

const copy = broadcastsCopy.broadcastPages;
const words = copy.placeChooser;
const pictures = copy.pictureChooser;

const other: TextPlace = { name: "Trafalgar Square", address: "London WC2N 5DS", latitude: 51.508, longitude: -0.128 };

async function renderTop({
  header = "location",
  place = null,
  pictureId = null,
  found = [],
  kept = { pictureId: examplePictureId },
  fixed,
  disabled,
}: {
  header?: TextHeader | null;
  place?: TextPlace | null;
  pictureId?: string | null;
  found?: TextPlace[];
  kept?: { pictureId: string } | { refused: "not-picture" | "too-big" };
  fixed?: boolean;
  disabled?: boolean;
} = {}) {
  const onChange = vi.fn();
  const findPlaces = vi.fn<FindPlaces>(async () => found);
  const uploadPicture = vi.fn<UploadPicture>(async () => kept);
  const screen = await render(
    <TextTop
      header={header}
      place={place}
      pictureId={pictureId}
      onChange={onChange}
      findPlaces={findPlaces}
      uploadPicture={uploadPicture}
      fixed={fixed}
      disabled={disabled}
    />,
  );
  return { onChange, findPlaces, uploadPicture, screen };
}

/** A picture's file, of a kind as its name ends. */
const pictureFile = (name = "march.png") =>
  new File(["x"], name, { type: name.endsWith(".png") ? "image/png" : "text/plain" });

/** Chooses `chosen` in the picture box's file picker. */
function chooseFiles(...chosen: File[]) {
  const picker = document.querySelector<HTMLInputElement>("input[type=file]")!;
  const transfer = new DataTransfer();
  for (const file of chosen) transfer.items.add(file);
  picker.files = transfer.files;
  picker.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Drops `dropped` on the picture box. */
function dropFiles(...dropped: File[]) {
  const transfer = new DataTransfer();
  for (const file of dropped) transfer.items.add(file);
  const box = document.querySelector("input[type=file]")!.parentElement!;
  box.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
}

const choosePicture = () => page.getByRole("button", { name: pictures.choose });

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

  it("says what to do with a place's name and address only once one is chosen", async () => {
    const { screen } = await renderTop();
    await expect.element(box()).toBeVisible();
    expect(page.getByText(words.underMap).query()).toBeNull();
    expect(page.getByLabelText(words.name).query()).toBeNull();
    expect(page.getByRole("link", { name: words.checkMap }).query()).toBeNull();
    await screen.rerender(
      <TextTop
        header="location"
        place={examplePlace}
        pictureId={null}
        onChange={() => {}}
        findPlaces={async () => []}
        uploadPicture={async () => undefined}
      />,
    );
    await expect.element(page.getByText(words.underMap)).toBeVisible();
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

describe("TextTop's picture", () => {
  it("makes the top a picture with Picture, with a box to drop one on or choose one, and nothing else yet", async () => {
    const { onChange, screen } = await renderTop({ header: null });
    await kind(copy.textTop.picture).click();
    expect(onChange).toHaveBeenCalledWith({ header: "image" });
    await screen.rerender(
      <TextTop
        header="image"
        place={null}
        pictureId={null}
        onChange={onChange}
        findPlaces={async () => []}
        uploadPicture={async () => undefined}
      />,
    );
    await expect.element(kind(copy.textTop.picture)).toHaveAttribute("aria-checked", "true");
    await expect.element(page.getByText(pictures.drop)).toBeVisible();
    await expect.element(choosePicture()).toBeVisible();
    expect(document.querySelector<HTMLInputElement>("input[type=file]")!.accept).toBe("image/jpeg,image/png");
    expect(page.getByRole("img", { name: pictures.shown }).query()).toBeNull();
    expect(page.getByText(pictures.changeable).query()).toBeNull();
    expect(box().query()).toBeNull();
    expect(page.getByText(copy.textTop.linkPreviewNote).query()).toBeNull();
  });

  it("shows the picture chosen, small, with a × to take it off and no box, and says it can change after approval", async () => {
    await renderTop({ header: "image", pictureId: examplePictureId });
    await expect.element(page.getByRole("img", { name: pictures.shown })).toHaveAttribute("src", examplePictureId);
    // A kept picture is served by the site; an example's, given whole, is its own.
    expect(pictureSource("00000000-0000-4000-8000-000000000001")).toBe(
      "/api/text-pictures/00000000-0000-4000-8000-000000000001",
    );
    expect(pictureSource(examplePictureId)).toBe(examplePictureId);
    await expect.element(page.getByRole("button", { name: pictures.remove })).toBeVisible();
    expect(choosePicture().query()).toBeNull();
    await expect.element(page.getByText(pictures.changeable)).toBeVisible();
  });

  it("takes the picture off with its ×", async () => {
    const { onChange } = await renderTop({ header: "image", pictureId: examplePictureId });
    await page.getByRole("button", { name: pictures.remove }).click();
    expect(onChange).toHaveBeenCalledWith({ pictureId: null });
  });

  it("has no × while it's disabled", async () => {
    await renderTop({ header: "image", pictureId: examplePictureId, disabled: true });
    await expect.element(page.getByRole("img", { name: pictures.shown })).toBeVisible();
    expect(page.getByRole("button", { name: pictures.remove }).query()).toBeNull();
  });

  it("uploads a picture chosen, pending till it's kept, and takes it", async () => {
    let finish = () => {};
    const { onChange, uploadPicture } = await renderTop({ header: "image" });
    uploadPicture.mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve({ pictureId: examplePictureId }))),
    );
    const file = pictureFile();
    chooseFiles(file);
    await expect.element(choosePicture()).toHaveAttribute("aria-busy", "true");
    expect(uploadPicture).toHaveBeenCalledWith(file);
    finish();
    await expect.element(choosePicture()).not.toHaveAttribute("aria-busy");
    expect(onChange).toHaveBeenCalledWith({ pictureId: examplePictureId });
  });

  it("uploads a picture dropped on the box, the first of several", async () => {
    const { onChange, uploadPicture } = await renderTop({ header: "image" });
    const first = pictureFile("first.png");
    dropFiles(first, pictureFile("second.png"));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ pictureId: examplePictureId }));
    expect(uploadPicture).toHaveBeenCalledTimes(1);
    expect(uploadPicture).toHaveBeenCalledWith(first);
  });

  it("uploads nothing for a drop with no file in it", async () => {
    const { uploadPicture } = await renderTop({ header: "image" });
    dropFiles();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(uploadPicture).not.toHaveBeenCalled();
  });

  it("uploads nothing while it's disabled", async () => {
    const { uploadPicture } = await renderTop({ header: "image", disabled: true });
    chooseFiles(pictureFile());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(uploadPicture).not.toHaveBeenCalled();
  });

  it("says why a file isn't a picture WhatsApp takes, or is too big, and clears that with the next one", async () => {
    const { onChange, uploadPicture } = await renderTop({ header: "image", kept: { refused: "not-picture" } });
    chooseFiles(pictureFile("notes.txt"));
    await expect.element(page.getByText(pictures.refusals["not-picture"])).toBeVisible();
    uploadPicture.mockResolvedValueOnce({ refused: "too-big" });
    chooseFiles(pictureFile("huge.png"));
    await expect.element(page.getByText(pictures.refusals["too-big"])).toBeVisible();
    expect(page.getByText(pictures.refusals["not-picture"]).query()).toBeNull();
    uploadPicture.mockResolvedValueOnce({ pictureId: examplePictureId });
    chooseFiles(pictureFile());
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ pictureId: examplePictureId }));
    expect(page.getByText(pictures.refusals["too-big"]).query()).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("takes nothing from a page gone out of date, which says so over the draft", async () => {
    const { onChange, uploadPicture } = await renderTop({ header: "image" });
    uploadPicture.mockResolvedValueOnce(undefined);
    chooseFiles(pictureFile());
    await vi.waitFor(() => expect(uploadPicture).toHaveBeenCalled());
    await expect.element(choosePicture()).not.toHaveAttribute("aria-busy");
    expect(onChange).not.toHaveBeenCalled();
    expect(page.getByText(pictures.refusals["not-picture"]).query()).toBeNull();
  });

  it("keeps a chosen template's picture top, but not its picture, which can still change", async () => {
    const { onChange } = await renderTop({ header: "image", pictureId: null, fixed: true });
    await expect.element(kind(copy.textTop.picture)).toBeDisabled();
    chooseFiles(pictureFile());
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({ pictureId: examplePictureId }));
  });

  it("lets a chosen template's picture come off", async () => {
    const { onChange } = await renderTop({ header: "image", pictureId: examplePictureId, fixed: true });
    await page.getByRole("button", { name: pictures.remove }).click();
    expect(onChange).toHaveBeenCalledWith({ pictureId: null });
  });
});

describe("TextTop's examples in the gallery", () => {
  it("uploads a picture, logging its name, and shows it", async () => {
    await render(<TextTopExample initial={{ header: "image", place: null, pictureId: null }} />);
    chooseFiles(pictureFile("march.png"));
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent('uploadPicture("march.png")');
    await expect.element(page.getByRole("img", { name: pictures.shown })).toBeVisible();
  });

  it("finds places, logging what was looked for, and takes the one chosen", async () => {
    await render(<TextTopExample initial={{ header: null, place: null, pictureId: null }} />);
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
