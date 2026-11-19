import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { letterExtensions } from "@/lib/letters/extensions";
import LinkPeek from "./LinkPeek";

const WORDS = {
  address: "Address",
  save: "Save",
  remove: "Remove",
  cancel: "Cancel",
  invalid: "Not an address",
  edit: "Change it",
};
const HREF = "https://pauseai.uk/join";

let current: Editor;

/**
 * A letter editor, `above` pixels down the page, with the bubble under its
 * links, and, once it's pressed, the words "Editing" for the link bar.
 */
function Harness({ content, above = 40 }: { content: string; above?: number }) {
  const editor = useEditor({
    extensions: letterExtensions,
    content,
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-label": "Letter" } },
    onCreate: ({ editor }) => void (current = editor),
  });
  const [editing, setEditing] = useState(false);
  if (!editor) return null;
  return (
    <div style={{ minHeight: "200vh", paddingTop: above }}>
      {editing ? <p>Editing</p> : <LinkPeek editor={editor} words={WORDS} onEdit={() => setEditing(true)} />}
      <EditorContent editor={editor} />
      <button type="button">Elsewhere</button>
    </div>
  );
}

const letter = () => page.getByRole("textbox", { name: "Letter" });
const peek = () => page.getByRole("button", { name: HREF });

describe("LinkPeek", () => {
  it("shows where a link goes while the mouse is over it, long enough to reach it, and none for the words around it", async () => {
    await render(<Harness content={`<p><a href="${HREF}">Join us</a></p><p>Today</p>`} />);
    await letter().getByText("Join us").hover();
    await expect.element(peek()).toBeVisible();
    await expect.element(peek()).toHaveAttribute("title", WORDS.edit);
    // Under the link, in line with its start.
    const link = letter().getByRole("link").element().getBoundingClientRect();
    const box = peek().element().getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(link.bottom);
    expect(Math.abs(box.left - link.left)).toBeLessThan(2);
    await peek().hover();
    await expect.element(peek()).toBeVisible();
    await page.getByRole("button", { name: "Elsewhere" }).hover();
    await expect.element(peek()).not.toBeInTheDocument();
    await letter().getByText("Today").hover();
    await expect.element(peek()).not.toBeInTheDocument();
  });

  it("shows it while the cursor's in the link, follows it as the page scrolls, and goes when the letter changes", async () => {
    await render(<Harness content={`<p><a href="${HREF}">Join us</a></p><p>Today</p>`} />);
    await letter().getByText("Join us").click();
    await expect.element(peek()).toBeVisible();
    const before = peek().element().getBoundingClientRect().top;
    window.scrollBy(0, 20);
    await expect.poll(() => peek().element().getBoundingClientRect().top).toBeCloseTo(before - 20, 0);
    window.scrollTo(0, 0);
    // Out of the letter, it goes.
    await page.getByRole("button", { name: "Elsewhere" }).click();
    await expect.element(peek()).not.toBeInTheDocument();
    // Hovered, then typed over, the link may be drawn anew: it goes till the mouse comes back.
    await letter().getByText("Today").click();
    await letter().getByText("Join us").hover();
    await expect.element(peek()).toBeVisible();
    await userEvent.keyboard("!");
    await expect.element(peek()).not.toBeInTheDocument();
  });

  it("shows it with the cursor between two parts of a link, such as after a bold word in it", async () => {
    await render(<Harness content={`<p>Go <a href="${HREF}"><strong>Join</strong> us</a></p>`} />);
    await expect.element(letter()).toBeVisible();
    // After "Join", the page has the cursor in the link itself, not in a word's text.
    current.chain().focus().setTextSelection(8).run();
    expect(current.view.domAtPos(8).node.nodeName).toBe("A");
    await expect.element(peek()).toBeVisible();
  });

  it("shows it over a link at the foot of the window, where there's no room under it", async () => {
    await render(<Harness content={`<p>Top</p><p><a href="${HREF}">Join us</a></p>`} above={window.innerHeight} />);
    await letter().getByText("Join us").click();
    await expect.element(peek()).toBeVisible();
    // Scrolled till the link's line is just above the window's foot, the bubble moves over it.
    const at = letter().getByRole("link").element().getBoundingClientRect();
    // At once: the page's own smooth scroll would carry the link past the
    // bubble before the bubble had moved.
    window.scrollBy({ top: at.bottom - window.innerHeight + 8, behavior: "instant" });
    // From the bubble's foot to the link's top: the 4px gap once it's over it.
    const gap = () =>
      letter().getByRole("link").element().getBoundingClientRect().top -
      peek().element().getBoundingClientRect().bottom;
    await expect.poll(() => gap() >= 0 && gap() < 6).toBe(true);
    expect(peek().element().getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    window.scrollTo(0, 0);
  });

  it("selects the whole link when pressed, keeping the letter's focus, and says to change it", async () => {
    await render(<Harness content={`<p><a href="${HREF}">Join us</a></p><p>Today</p>`} />);
    await letter().getByText("Join us").hover();
    await peek().click();
    await expect.element(page.getByText("Editing")).toBeVisible();
    await expect.element(letter()).toHaveFocus();
    const { from, to } = current.state.selection;
    expect(current.state.doc.textBetween(from, to)).toBe("Join us");
  });
});
