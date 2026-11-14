import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import EraseForm from "./EraseForm";
import { action } from "@/tests/browser/staff";
import { supportersCopy } from "../supporters/copy";
import { erasureCopy } from "@/lib/erasure/copy";

describe("EraseForm, for a supporter with no name", () => {
  it("heads the page with the stand-in", async () => {
    await render(<EraseForm supporter={{ id: 8, name: null }} action={vi.fn()} />);
    await expect
      .element(
        page.getByRole("heading", {
          level: 1,
          name: `${erasureCopy.erase.title}: ${supportersCopy.supporters.noName}`,
        }),
      )
      .toBeVisible();
  });
});

describe("EraseForm", () => {
  it("sends the supporter, the reference and the confirmation, only once the box is ticked, with the way back", async () => {
    const { fn, sent } = action();
    await render(<EraseForm supporter={{ id: 7, name: "Jane Example" }} action={fn} />);
    await expect
      .element(page.getByRole("heading", { level: 1, name: `${erasureCopy.erase.title}: Jane Example` }))
      .toBeVisible();
    const button = page.getByRole("button", { name: erasureCopy.erase.button });
    await expect.element(button).toBeDisabled();
    await expect
      .element(page.getByRole("link", { name: erasureCopy.erase.cancel }))
      .toHaveAttribute("href", "/staff/supporters/7");
    await page.getByRole("textbox", { name: erasureCopy.erase.referenceLabel }).fill("ICO-123");
    await page.getByRole("checkbox", { name: erasureCopy.erase.confirm }).click();
    await expect.element(button).toBeEnabled();
    await button.click();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ id: "7", reference: "ICO-123", confirm: "on" });
  });
});
