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

/** A letter editor with the bubble under its links, and, once it's pressed, the words "Editing" for the link bar. */
function Harness({ content }: { content: string }) {
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
    <div style={{ height: "200vh", paddingTop: 40 }}>
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
