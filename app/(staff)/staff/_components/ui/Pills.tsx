"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Pills.module.css";

/**
 * Words as pills that can't be changed here, such as who a mailing is to: the
 * filter bar's chips, without their menus. One too long for its pill is cut
 * with "…", its whole words its tooltip; clicked, it shows them whole, and
 * clicked again, it's cut again.
 */
export default function Pills({ words, label }: { words: string[]; label: string }) {
  return (
    <ul className={styles.pills} aria-label={label}>
      {words.map((word) => (
        <Pill key={word} word={word} />
      ))}
    </ul>
  );
}

function Pill({ word }: { word: string }) {
  const words = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  const [open, setOpen] = useState(false);
  // Whether its words are cut is known once they're drawn.
  useEffect(() => {
    const span = words.current!;
    setCut(span.scrollWidth > span.clientWidth);
  }, [word]);
  const text = (
    <span ref={words} className={styles.words}>
      {word}
    </span>
  );
  return (
    <li className={styles.pill} data-open={open || undefined}>
      {cut ? (
        <button type="button" className={styles.cut} title={word} aria-expanded={open} onClick={() => setOpen(!open)}>
          {text}
        </button>
      ) : (
        text
      )}
    </li>
  );
}
