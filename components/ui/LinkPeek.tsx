"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "./Button";
import type { LinkWords } from "./LinkBar";
import styles from "./LinkPeek.module.css";
import { useFollowScroll } from "./useFollowScroll";

/** How long a link's bubble stays after the mouse leaves the link, to be reached. */
const LEAVE_DELAY = 300;

/** The gap between a link and its bubble, in pixels. */
const GAP = 4;

/** The link element at `pos` in the editor's page. */
function linkAt(editor: Editor, pos: number): HTMLAnchorElement | null {
  const { node } = editor.view.domAtPos(pos);
  return (node instanceof Element ? node : node.parentElement!).closest("a");
}

/**
 * Under a link in a letter editor, or over it at the foot of the window,
 * while the mouse is over it or the cursor is in it: where it goes.
 * Pressing it selects the link and opens the link bar (`onEdit`) to change
 * it. It's in the page's top layer, so the editor's edge doesn't cut it
 * off, and it follows the link as the page scrolls.
 */
export default function LinkPeek({ editor, words, onEdit }: { editor: Editor; words: LinkWords; onEdit: () => void }) {
  const [hovered, setHovered] = useState<HTMLAnchorElement | null>(null);
  const leaving = useRef<ReturnType<typeof setTimeout>>(undefined);
  const atCursor = useEditorState({
    editor,
    selector: ({ editor }) => (editor.isFocused && editor.isActive("link") ? editor.state.selection.head : null),
  });

  const leave = useCallback(() => {
    clearTimeout(leaving.current);
    leaving.current = setTimeout(() => setHovered(null), LEAVE_DELAY);
  }, []);
  const stay = () => clearTimeout(leaving.current);

  useEffect(() => {
    const page = editor.view.dom;
    const over = (event: MouseEvent) => {
      const link = (event.target as Element).closest("a");
      if (!link) return;
      clearTimeout(leaving.current);
      setHovered(link);
    };
    const out = (event: MouseEvent) => {
      if ((event.target as Element).closest("a")) leave();
    };
    // A change can redraw the link, leaving the one hovered gone from the page.
    const changed = () => setHovered(null);
    page.addEventListener("mouseover", over);
    page.addEventListener("mouseout", out);
    editor.on("update", changed);
    return () => {
      clearTimeout(leaving.current);
      page.removeEventListener("mouseover", over);
      page.removeEventListener("mouseout", out);
      editor.off("update", changed);
    };
  }, [editor, leave]);

  const link = hovered ?? (atCursor === null ? null : linkAt(editor, atCursor));
  useFollowScroll(link !== null);

  // Placed once it's drawn, where the link is then: under it, or over it when the window has no room below.
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const peek = box.current;
    if (!peek || !link) return;
    if (!peek.matches(":popover-open")) peek.showPopover();
    const at = link.getBoundingClientRect();
    const below = at.bottom + GAP + peek.offsetHeight <= window.innerHeight;
    peek.style.top = `${below ? at.bottom + GAP : at.top - GAP - peek.offsetHeight}px`;
    peek.style.left = `${at.left}px`;
  });

  if (!link) return null;
  return (
    <div ref={box} popover="manual" className={styles.peek} onMouseEnter={stay} onMouseLeave={leave}>
      <Button
        type="button"
        variant="ghost"
        size="small"
        fit
        title={words.edit}
        // So the letter keeps its cursor.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          const from = editor.view.posAtDOM(link, 0);
          editor
            .chain()
            .focus()
            .setTextSelection({ from, to: from + link.textContent!.length })
            .run();
          setHovered(null);
          onEdit();
        }}
      >
        {link.getAttribute("href")}
      </Button>
    </div>
  );
}
