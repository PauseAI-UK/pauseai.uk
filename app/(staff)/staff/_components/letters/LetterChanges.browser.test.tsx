import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import LetterChanges from "./LetterChanges";
import { lettersCopy } from "./copy";

describe("LetterChanges", () => {
  const words = lettersCopy.letterChanges;
  const EMAIL = { from: "Jane", to: "Testy", at: null, subject: "Please back a pause" };
  const draft = "Dear MP,\n\nOne.\n\nPlease act now on this.\n\nTwo.\n\nThree.\n\nJane";
  const sent = "Dear MP,\n\nOne.\n\nPlease act on this. I live here.\n\nTwo.\n\nThree.\n\nJane";

  it("shows only what changed, the paragraphs left alone folded, a click unfolding them", async () => {
    const { container } = await render(<LetterChanges {...EMAIL} sent={sent} draft={draft} />);
    expect([...container.querySelectorAll("ins")].map((e) => e.textContent)).toEqual(["I live here."]);
    expect([...container.querySelectorAll("del")].map((e) => e.textContent)).toEqual(["now "]);
    await expect.element(page.getByText(words.folded(2))).toBeVisible();
    await expect.element(page.getByText("Two.", { exact: false })).not.toBeVisible();
    await page.getByText(words.folded(3)).click();
    await expect.element(page.getByText("Two.\n\nThree.\n\nJane")).toBeVisible();
    await page.getByText(words.folded(3)).click();
    await expect.element(page.getByText("Two.", { exact: false })).not.toBeVisible();
  });

  it("shows the letter as sent, and back, from the subject's line", async () => {
    const { container } = await render(<LetterChanges {...EMAIL} sent={sent} draft={draft} />);
    const subject = page.getByRole("definition").filter({ hasText: EMAIL.subject });
    await subject.getByRole("button", { name: words.asSent }).click();
    expect(container.querySelector("ins")).toBeNull();
    await expect.element(page.getByText(sent)).toBeVisible();
    await page.getByRole("button", { name: words.showChanges }).click();
    await expect.element(page.getByRole("button", { name: words.asSent })).toBeVisible();
    expect(container.querySelector("ins")).not.toBeNull();
    // Unfolded, then as sent and back: folded again.
    await page.getByText(words.folded(2)).click();
    await expect.element(page.getByText("One.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: words.asSent }).click();
    await page.getByRole("button", { name: words.showChanges }).click();
    await expect.element(page.getByText("One.", { exact: false })).not.toBeVisible();
  });

  it("folds a letter sent as drafted whole, and with no draft kept shows the letter alone", async () => {
    await render(<LetterChanges {...EMAIL} sent={draft} draft={draft} />);
    await expect.element(page.getByText(words.folded(6))).toBeVisible();
    const { container } = await render(<LetterChanges {...EMAIL} sent={sent} draft={null} />);
    expect(container.querySelector("article > div")!.textContent).toBe(sent);
    expect(container.querySelector("button")).toBeNull();
  });
});
