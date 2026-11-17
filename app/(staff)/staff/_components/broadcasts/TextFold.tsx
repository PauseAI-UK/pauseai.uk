"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import styles from "./Broadcasts.module.css";

/** Whether some of the words are hidden below the fold. */
const isCut = (words: HTMLElement) => words.scrollHeight > words.clientHeight;

/**
 * A text's words folded as WhatsApp folds a marketing text: cut at five
 * lines, a blank line between paragraphs counting as one, the last ending
 * "…", with Read more under them, which opens the rest. Words that fit
 * show whole, with no Read more.
 */
export default function TextFold({ children }: { children: ReactNode }) {
  const words = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  // When the words change, and when the bubble's width changes their lines.
  useLayoutEffect(() => setCut(isCut(words.current!)), [children]);
  useEffect(() => {
    const shown = words.current!;
    const observer = new ResizeObserver(() => setCut(isCut(shown)));
    observer.observe(shown);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div ref={words} className={open ? styles.words : `${styles.words} ${styles.folded}`}>
        {children}
      </div>
      {cut && (
        <button type="button" className={styles.readMore} onClick={() => setOpen(true)}>
          {broadcastsCopy.broadcastPages.readMore}
        </button>
      )}
    </>
  );
}
