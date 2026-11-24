import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { refused } from "@/lib/form-result";
import { DeleteTwice } from "./DeleteTwice";
import { DeleteTwiceExample } from "./DeleteTwice.gallery.client";
import { staffVocabulary } from "@/lib/staff-vocabulary";

describe("DeleteTwice", () => {
  it("sends any more fields it's given with the form", async () => {
    const action = vi.fn<(form: FormData) => Promise<{ ok: true }>>(async () => ({ ok: true }));
    await render(
      <DeleteTwice name="id" value="1" fields={{ list: "events" }} label="Delete" says={{}} action={action} />,
    );
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
    await expect.poll(() => action.mock.calls.length).toBe(1);
    const sent = action.mock.calls[0][0];
    expect(sent.get("id")).toBe("1");
    expect(sent.get("list")).toBe("events");
  });

  it("can't be armed when disabled", async () => {
    const action = vi.fn(async () => ({ ok: true as const }));
    await render(<DeleteTwice name="slug" value="x" label="Delete ask" disabled says={{}} action={action} />);
    await expect.element(page.getByRole("button", { name: "Delete ask" })).toBeDisabled();
  });

  it("says why a delete was refused, under itself, and can be pressed again", async () => {
    const action = vi.fn(async () => refused("in-use"));
    await render(
      <DeleteTwice name="slug" value="x" label="Delete ask" says={{ "in-use": "It's in use." }} action={action} />,
    );
    await page.getByRole("button", { name: "Delete ask" }).click();
    await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent("It's in use.");
    await expect.element(page.getByRole("button", { name: "Delete ask" })).toBeEnabled();
  });

  it("has an example in the gallery that deletes, one that can't be pressed, and one that's refused", async () => {
    await render(<DeleteTwiceExample />);
    const deletes = page.getByRole("button", { name: "Delete ask" });
    await expect.element(deletes.nth(1)).toBeDisabled();
    await deletes.nth(0).click();
    await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }))
      .toHaveTextContent('delete({"slug":"winter-reception-dec-2026"})');
    await deletes.nth(2).click();
    await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Politicians have answered this ask, so it can't be deleted.");
  });
});
