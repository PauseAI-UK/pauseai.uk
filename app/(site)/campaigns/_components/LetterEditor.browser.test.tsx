import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { letterEditorCopy as words } from "@/lib/content/letter-editor";
import type { Block, LetterDoc, Paragraph } from "@/lib/letters/format";
import LetterEditor from "./LetterEditor";

const p = (words: string): Paragraph => ({ type: "paragraph", content: [{ type: "text", text: words }] });
const list = (...items: string[]): Block => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [p(item)] })),
});
const quote = (...content: Block[]): Block => ({ type: "blockquote", content });

async function renderEditor(content: Block[] = [p("Dear MP")]) {
  const onChange = vi.fn<(doc: LetterDoc) => void>();
  await render(
    <>
      <p id="label">Letter</p>
      <p id="hint">Hint</p>
      <LetterEditor initial={{ type: "doc", content }} onChange={onChange} labelledBy="label" describedBy="hint" />
    </>,
  );
  return { onChange, last: () => onChange.mock.lastCall![0] };
}

const letter = () => page.getByRole("textbox", { name: "Letter" });
const quoteButton = () => page.getByRole("button", { name: words.quote });

/** Puts the cursor at the start of a line, or its end. */
async function cursorAt(line: string, end = false) {
  await letter().getByText(line, { exact: true }).click();
  await expect.element(letter()).toHaveFocus();
  await expect
    .poll(async () => {
      await userEvent.keyboard(end ? "{End}" : "{Home}");
      const selection = document.getSelection();
      return selection?.anchorNode?.textContent === line ? selection.anchorOffset : -1;
    })
    .toBe(end ? line.length : 0);
}

describe("LetterEditor", () => {
  it("links the text selected from Link, changes it from Ctrl+K, and quotes it", async () => {
    const { last } = await renderEditor();
    await letter().click();
    await userEvent.keyboard("{Control>}a{/Control}");
    await page.getByRole("button", { name: words.link }).click();
    await userEvent.keyboard("pauseai.uk{Enter}");
    // Link again shuts the bar, as does the button pressed twice.
    await page.getByRole("button", { name: words.link }).click();
    await expect.element(page.getByRole("textbox", { name: words.linkBar.address })).toBeVisible();
    await page.getByRole("button", { name: words.link }).click();
    await expect.element(page.getByRole("textbox", { name: words.linkBar.address })).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: words.link })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.stringify(last())).toContain('"href":"https://pauseai.uk/"');
    await userEvent.keyboard("{Control>}k{/Control}");
    await page.getByRole("textbox", { name: words.linkBar.address }).fill("pauseai.uk/join");
    await page.getByRole("button", { name: words.linkBar.save }).click();
    expect(JSON.stringify(last())).toContain('"href":"https://pauseai.uk/join"');
    // Other keys with Ctrl are the editor's.
    await userEvent.keyboard("{Control>}i{/Control}");
    await expect.element(page.getByRole("textbox", { name: words.linkBar.address })).not.toBeInTheDocument();
    await page.getByRole("button", { name: words.quote }).click();
    await expect.element(page.getByRole("button", { name: words.quote })).toHaveAttribute("aria-pressed", "true");
    expect(last().content[0].type).toBe("blockquote");
  });

  it("quotes a whole list from any bullet in it, and unquotes it whole, leaving the rest of the quote", async () => {
    const { last } = await renderEditor([p("Before"), list("One", "Two"), p("After")]);
    await cursorAt("Two");
    await quoteButton().click();
    expect(last().content).toEqual([p("Before"), quote(list("One", "Two")), p("After")]);
    await expect.element(quoteButton()).toHaveAttribute("aria-pressed", "true");
    // Quoting the line before quotes it alone: two quotes that touch stay two.
    await cursorAt("Before");
    await quoteButton().click();
    expect(last().content).toEqual([quote(p("Before")), quote(list("One", "Two")), p("After")]);
    await cursorAt("One");
    await quoteButton().click();
    expect(last().content).toEqual([quote(p("Before")), list("One", "Two"), p("After")]);
    await expect.element(quoteButton()).toHaveAttribute("aria-pressed", "false");
  });

  it("unquotes everything selected, with Ctrl+A too, and only the middle of a quote from there", async () => {
    const { last } = await renderEditor([
      quote(p("One"), list("Two")),
      p("Out"),
      quote(p("Three"), p("Four"), p("Five")),
    ]);
    await cursorAt("Out");
    await userEvent.keyboard("{Control>}a{/Control}");
    await expect.element(quoteButton()).toHaveAttribute("aria-pressed", "true");
    await quoteButton().click();
    expect(last().content).toEqual([p("One"), list("Two"), p("Out"), p("Three"), p("Four"), p("Five")]);
    // All of it, quoted again, is one quote.
    await userEvent.keyboard("{Control>}a{/Control}");
    await quoteButton().click();
    expect(last().content).toEqual([quote(p("One"), list("Two"), p("Out"), p("Three"), p("Four"), p("Five"))]);
    await cursorAt("Four");
    await quoteButton().click();
    expect(last().content).toEqual([quote(p("One"), list("Two"), p("Out"), p("Three")), p("Four"), quote(p("Five"))]);
  });

  it("joins two lists that touch into one: deleting the line between them, or making it a bullet", async () => {
    const { last } = await renderEditor([list("One"), p("Between"), list("Two")]);
    await cursorAt("Between");
    await page.getByRole("button", { name: words.bulletList }).click();
    expect(last().content).toEqual([list("One", "Between", "Two")]);
    await page.getByRole("button", { name: words.bulletList }).click();
    expect(last().content).toEqual([list("One"), p("Between"), list("Two")]);
    await cursorAt("Between", true);
    await userEvent.keyboard("{Shift>}{Home}{/Shift}{Backspace}{Backspace}");
    expect(last().content).toEqual([list("One", "Two")]);
  });

  it("joins every two lists that touch at the next change, but not two quotes", async () => {
    const { last } = await renderEditor([
      list("One"),
      list("Two"),
      list("Three"),
      p("Mid"),
      quote(p("Four")),
      quote(p("Five")),
    ]);
    await cursorAt("Mid", true);
    await userEvent.keyboard("!");
    expect(last().content).toEqual([list("One", "Two", "Three"), p("Mid!"), quote(p("Four")), quote(p("Five"))]);
  });

  it("shows where a link goes under it, and opens the link bar from there", async () => {
    await renderEditor([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Join", marks: [{ type: "link", attrs: { href: "https://pauseai.uk/join" } }] },
        ],
      },
    ]);
    await letter().getByText("Join").hover();
    await page.getByRole("button", { name: "https://pauseai.uk/join" }).click();
    await expect
      .element(page.getByRole("textbox", { name: words.linkBar.address }))
      .toHaveValue("https://pauseai.uk/join");
  });
});
