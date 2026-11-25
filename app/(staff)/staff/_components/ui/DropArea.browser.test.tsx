import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import DropArea from "./DropArea";
import { DropAreaExample } from "./DropArea.gallery.client";

const files = (...names: string[]) => {
  const transfer = new DataTransfer();
  for (const name of names) transfer.items.add(new File(["x"], name, { type: "text/plain" }));
  return transfer;
};

async function renderArea(props: Partial<Parameters<typeof DropArea>[0]> = {}) {
  const onFiles = vi.fn<(files: File[]) => void>();
  const { container } = await render(
    <DropArea hint="Drag files here" choose="Choose files" onFiles={onFiles} {...props} />,
  );
  const box = page.getByText("Drag files here").element().parentElement!;
  const picker = container.querySelector<HTMLInputElement>("input[type=file]")!;
  return { onFiles, box, picker };
}

const choose = () => page.getByRole("button", { name: "Choose files" });

describe("DropArea", () => {
  it("says what to drop, which its button is described by, and opens the file picker from it", async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    await renderArea();
    await expect.element(choose()).toHaveAccessibleDescription("Drag files here");
    await choose().click();
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it("takes one file of any kind unless told otherwise", async () => {
    const { picker } = await renderArea();
    expect(picker.multiple).toBe(false);
    expect(picker.hasAttribute("accept")).toBe(false);
  });

  it("takes several files, of the kinds it's told", async () => {
    const { picker } = await renderArea({ multiple: true, accept: "image/jpeg,image/png" });
    expect(picker.multiple).toBe(true);
    expect(picker.accept).toBe("image/jpeg,image/png");
  });

  it("lights up while a file is over it, and goes out when it leaves or is dropped", async () => {
    const { onFiles, box } = await renderArea();
    const over = new DragEvent("dragover", { dataTransfer: files("a.txt"), bubbles: true, cancelable: true });
    box.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    await expect.poll(() => box.hasAttribute("data-over")).toBe(true);
    box.dispatchEvent(new DragEvent("dragleave", { bubbles: true }));
    await expect.poll(() => box.hasAttribute("data-over")).toBe(false);
    box.dispatchEvent(new DragEvent("dragover", { dataTransfer: files("a.txt"), bubbles: true, cancelable: true }));
    await expect.poll(() => box.hasAttribute("data-over")).toBe(true);
    const drop = new DragEvent("drop", { dataTransfer: files("a.txt", "b.txt"), bubbles: true, cancelable: true });
    box.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    await expect.poll(() => box.hasAttribute("data-over")).toBe(false);
    expect(onFiles.mock.calls[0][0].map((file) => file.name)).toEqual(["a.txt", "b.txt"]);
  });

  it("gives the files chosen, and empties the picker, so the same one can be chosen again", async () => {
    const { onFiles, picker } = await renderArea();
    picker.files = files("a.txt").files;
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    await expect.poll(() => onFiles.mock.calls.length).toBe(1);
    expect(onFiles.mock.calls[0][0].map((file) => file.name)).toEqual(["a.txt"]);
    expect(picker.value).toBe("");
  });

  it("shows its button pending while what was given is on its way", async () => {
    await renderArea({ pending: true });
    await expect.element(choose()).toHaveAttribute("aria-busy", "true");
  });
});

describe("DropArea's examples in the gallery", () => {
  it("logs the names of the files dropped", async () => {
    await render(<DropAreaExample />);
    const box = page.getByText("Drag files here").element().parentElement!;
    box.dispatchEvent(
      new DragEvent("drop", { dataTransfer: files("a.txt", "b.txt"), bubbles: true, cancelable: true }),
    );
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent('onFiles(["a.txt","b.txt"])');
  });
});
