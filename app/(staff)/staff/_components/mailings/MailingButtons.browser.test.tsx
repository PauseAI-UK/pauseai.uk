import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { DeleteDraft, StopMailing } from "./MailingButtons";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.mailingPages;

describe("DeleteDraft and StopMailing", () => {
  it("delete when pressed twice, and stop at once, each the mailing named", async () => {
    const forms: FormData[] = [];
    const action = vi.fn(async (form: FormData) => void forms.push(form));
    await render(
      <>
        <DeleteDraft id={5} action={action} />
        <StopMailing id={6} label="Stop" action={action} />
      </>,
    );
    await page.getByRole("button", { name: copy.deleteDraft }).click();
    await expect.element(page.getByRole("button", { name: staffVocabulary.deleteIt })).toHaveFocus();
    await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
    await page.getByRole("button", { name: "Stop" }).click();
    await expect.poll(() => forms.map((form) => form.get("id"))).toEqual(["5", "6"]);
  });

  it("turns back if the second press doesn't come, or focus goes elsewhere", async () => {
    const action = vi.fn();
    await render(
      <>
        <DeleteDraft id={5} action={action} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await page.getByRole("button", { name: copy.deleteDraft }).click();
    await page.getByRole("button", { name: "Elsewhere" }).click();
    await expect.element(page.getByRole("button", { name: copy.deleteDraft })).toBeVisible();
    vi.useFakeTimers();
    try {
      await page.getByRole("button", { name: copy.deleteDraft }).click();
      await expect.element(page.getByRole("button", { name: staffVocabulary.deleteIt })).toBeVisible();
      await vi.advanceTimersByTimeAsync(5000);
    } finally {
      vi.useRealTimers();
    }
    await expect.element(page.getByRole("button", { name: copy.deleteDraft })).toBeVisible();
    expect(action).not.toHaveBeenCalled();
  });

  it("stays red and pending while it deletes, though the focus leaves it and the time runs out", async () => {
    let finish = () => {};
    const action = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    await render(
      <>
        <DeleteDraft id={5} action={action} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await page.getByRole("button", { name: copy.deleteDraft }).click();
    await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
    const pressed = page.getByRole("button", { name: staffVocabulary.deleteIt });
    await expect.element(pressed).toHaveAttribute("aria-busy", "true");
    await page.getByRole("button", { name: "Elsewhere" }).click();
    vi.useFakeTimers();
    try {
      await vi.advanceTimersByTimeAsync(5000);
    } finally {
      vi.useRealTimers();
    }
    await expect.element(pressed).toHaveAttribute("aria-busy", "true");
    finish();
    await expect.element(page.getByRole("button", { name: copy.deleteDraft })).toBeVisible();
  });
});
