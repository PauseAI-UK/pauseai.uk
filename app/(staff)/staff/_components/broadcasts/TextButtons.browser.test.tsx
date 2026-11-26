import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import {
  MOST_BUTTON_CHARACTERS,
  MOST_LINK_BUTTONS,
  MOST_TEXT_BUTTONS,
  type TextButton,
} from "@/lib/broadcasts/text-parts";
import TextButtons from "./TextButtons";
import { TextButtonsExample } from "./TextButtons.gallery.client";

const copy = broadcastsCopy.broadcastPages.replyButtons;

const replies = (...texts: string[]): TextButton[] => texts.map((text) => ({ text }));
const link = (text: string, url = "https://pauseai.uk/march"): TextButton => ({ text, url });
const addReply = () => page.getByRole("button", { name: copy.addReply });
const addLink = () => page.getByRole("button", { name: copy.addLink });
const boxes = () => page.getByLabelText(copy.words);
const addresses = () => page.getByLabelText(copy.address);
const kinds = () => [...document.querySelectorAll("tbody tr")].map((row) => row.firstElementChild!.textContent);

describe("TextButtons", () => {
  it("has none at first, no table, only + Reply button and + Link button", async () => {
    const onChange = vi.fn();
    await render(<TextButtons buttons={[]} onChange={onChange} />);
    expect(page.getByRole("table").query()).toBeNull();
    expect(page.getByText(copy.heading).query()).toBeNull();
    await addReply().click();
    expect(onChange).toHaveBeenLastCalledWith([{ text: "" }]);
    await addLink().click();
    expect(onChange).toHaveBeenLastCalledWith([{ text: "", url: "" }]);
  });

  it("puts each button in a row of a table under its heading, with no column headings: its kind, its words, a link's address, and Remove", async () => {
    await render(<TextButtons buttons={[...replies("Yes"), link("Details")]} onChange={() => {}} />);
    await expect.element(page.getByRole("table", { name: copy.heading })).toBeVisible();
    // No column headings: each box says what goes in it.
    expect(page.getByRole("columnheader").all()).toHaveLength(0);
    await expect.element(boxes().first()).toHaveAttribute("placeholder", copy.words);
    await expect.element(addresses()).toHaveAttribute("placeholder", copy.address);
    expect(kinds()).toEqual([copy.reply, copy.link]);
    expect(boxes().all()).toHaveLength(2);
    expect(addresses().all()).toHaveLength(1);
    await expect.element(addresses()).toHaveValue("https://pauseai.uk/march");
    await expect.element(addresses()).toHaveAttribute("type", "url");
    expect(page.getByRole("button", { name: copy.remove }).all()).toHaveLength(2);
  });

  it("changes a button's words, as long as WhatsApp takes, and removes one, keeping the rest", async () => {
    const onChange = vi.fn();
    await render(<TextButtons buttons={replies("Yes", "No")} onChange={onChange} />);
    await expect.element(boxes().nth(1)).toHaveAttribute("maxlength", String(MOST_BUTTON_CHARACTERS));
    await boxes().nth(1).fill("Maybe");
    expect(onChange).toHaveBeenLastCalledWith(replies("Yes", "Maybe"));
    await page.getByRole("button", { name: copy.remove }).first().click();
    expect(onChange).toHaveBeenLastCalledWith(replies("No"));
  });

  it("changes a link button's words and address, keeping each", async () => {
    const onChange = vi.fn();
    await render(<TextButtons buttons={[link("Details")]} onChange={onChange} />);
    await addresses().fill("https://pauseai.uk/join");
    expect(onChange).toHaveBeenLastCalledWith([link("Details", "https://pauseai.uk/join")]);
    await boxes().fill("Join");
    expect(onChange).toHaveBeenLastCalledWith([link("Join")]);
  });

  it("adds only reply buttons once there's a reply, three at most", async () => {
    const onChange = vi.fn();
    const { rerender } = await render(<TextButtons buttons={replies("Yes")} onChange={onChange} />);
    expect(addLink().query()).toBeNull();
    await addReply().click();
    expect(onChange).toHaveBeenLastCalledWith([...replies("Yes"), { text: "" }]);
    const most = Array.from({ length: MOST_TEXT_BUTTONS }, (_, i) => `Button ${i + 1}`);
    await rerender(<TextButtons buttons={replies(...most)} onChange={onChange} />);
    await expect.element(addReply()).toBeDisabled();
    expect(addLink().query()).toBeNull();
  });

  it("adds only link buttons once there's a link, two at most", async () => {
    const onChange = vi.fn();
    const { rerender } = await render(<TextButtons buttons={[link("Details")]} onChange={onChange} />);
    expect(addReply().query()).toBeNull();
    await addLink().click();
    expect(onChange).toHaveBeenLastCalledWith([link("Details"), { text: "", url: "" }]);
    const links = Array.from({ length: MOST_LINK_BUTTONS }, (_, i) => link(`Link ${i + 1}`));
    await rerender(<TextButtons buttons={links} onChange={onChange} />);
    await expect.element(addLink()).toBeDisabled();
    expect(addReply().query()).toBeNull();
  });

  it("adds neither kind to reply and link buttons together, which WhatsApp won't send", async () => {
    await render(<TextButtons buttons={[...replies("Yes"), link("Details")]} onChange={() => {}} />);
    expect(addReply().query()).toBeNull();
    expect(addLink().query()).toBeNull();
  });

  it("shows a chosen template's buttons as they are, and nothing at all for none", async () => {
    const { rerender, container } = await render(
      <TextButtons buttons={[...replies("Yes"), link("Details")]} onChange={() => {}} fixed />,
    );
    await expect.element(boxes().first()).toBeDisabled();
    await expect.element(boxes().first()).toHaveValue("Yes");
    await expect.element(addresses()).toBeDisabled();
    expect(addReply().query()).toBeNull();
    expect(addLink().query()).toBeNull();
    expect(page.getByRole("button", { name: copy.remove }).query()).toBeNull();
    await rerender(<TextButtons buttons={[]} onChange={() => {}} fixed />);
    expect(container.textContent).toBe("");
  });
});

describe("TextButtons' examples in the gallery", () => {
  it("adds a reply button, or a link button, and shows their words and address", async () => {
    const { unmount } = await render(<TextButtonsExample initial={[]} />);
    await addReply().click();
    await boxes().fill("I'm coming");
    await expect.element(page.getByText('Value: [{"text":"I\'m coming"}]')).toBeVisible();
    await unmount();
    await render(<TextButtonsExample initial={[]} />);
    await addLink().click();
    await boxes().fill("Details");
    await addresses().fill("https://pauseai.uk/march");
    await expect.element(page.getByText('Value: [{"text":"Details","url":"https://pauseai.uk/march"}]')).toBeVisible();
  });
});
