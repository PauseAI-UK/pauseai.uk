import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { MOST_BUTTON_CHARACTERS, MOST_BUTTONS, type TextButton } from "@/lib/broadcasts/text-parts";
import TextButtons from "./TextButtons";
import { TextButtonsExample } from "./TextButtons.gallery.client";

const copy = broadcastsCopy.broadcastPages.replyButtons;

const buttons = (...texts: string[]): TextButton[] => texts.map((text) => ({ text }));
const add = () => page.getByRole("button", { name: copy.add });
const boxes = () => page.getByLabelText(copy.words);

describe("TextButtons", () => {
  it("has none at first, only + Reply button, and no notes", async () => {
    const onChange = vi.fn();
    await render(<TextButtons buttons={[]} onChange={onChange} />);
    await expect.element(page.getByText(copy.heading)).toBeVisible();
    expect(boxes().all()).toHaveLength(0);
    expect(page.getByText(copy.tapNote).query()).toBeNull();
    await add().click();
    expect(onChange).toHaveBeenCalledWith([{ text: "" }]);
  });

  it("changes a button's words, as long as WhatsApp takes, and removes one, keeping the rest", async () => {
    const onChange = vi.fn();
    await render(<TextButtons buttons={buttons("Yes", "No")} onChange={onChange} />);
    await expect.element(boxes().nth(1)).toHaveAttribute("maxlength", String(MOST_BUTTON_CHARACTERS));
    await boxes().nth(1).fill("Maybe");
    expect(onChange).toHaveBeenLastCalledWith(buttons("Yes", "Maybe"));
    await page.getByRole("button", { name: copy.remove }).first().click();
    expect(onChange).toHaveBeenLastCalledWith(buttons("No"));
    // Says a tap is a reply, but not yet that a computer can't show them.
    await expect.element(page.getByText(copy.tapNote)).toBeVisible();
    expect(page.getByText(copy.manyNote).query()).toBeNull();
  });

  it("says a computer sends people to their phone for four or more, and takes no more than WhatsApp does", async () => {
    const { rerender } = await render(<TextButtons buttons={buttons("A", "B", "C", "D")} onChange={() => {}} />);
    await expect.element(page.getByText(copy.manyNote)).toBeVisible();
    await expect.element(add()).toBeEnabled();
    const most = Array.from({ length: MOST_BUTTONS }, (_, i) => `Button ${i + 1}`);
    await rerender(<TextButtons buttons={buttons(...most)} onChange={() => {}} />);
    await expect.element(add()).toBeDisabled();
  });

  it("shows a chosen template's buttons as they are, and nothing at all for none", async () => {
    const { rerender, container } = await render(<TextButtons buttons={buttons("Yes")} onChange={() => {}} fixed />);
    await expect.element(boxes()).toBeDisabled();
    await expect.element(boxes()).toHaveValue("Yes");
    expect(add().query()).toBeNull();
    expect(page.getByRole("button", { name: copy.remove }).query()).toBeNull();
    await rerender(<TextButtons buttons={[]} onChange={() => {}} fixed />);
    expect(container.textContent).toBe("");
  });
});

describe("TextButtons' examples in the gallery", () => {
  it("adds a button, and shows its words", async () => {
    await render(<TextButtonsExample initial={[]} />);
    await add().click();
    await boxes().fill("I'm coming");
    await expect.element(page.getByText('Value: [{"text":"I\'m coming"}]')).toBeVisible();
  });
});
