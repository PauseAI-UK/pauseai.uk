"use client";

import { useEffect, useRef, useState } from "react";
import type { FilterPill } from "@/lib/staff-list-filters";
import IconText from "./IconText";
import NotIcon from "./NotIcon";
import styles from "./Pills.module.css";

/**
 * Pills that can't be changed here, such as who a mailing is to, as the
 * filter bar's chips look, without their menus: those that find in the
 * accent; those that leave out (`not`) white, their edge dashed, a circle
 * struck through before their words. One too long for its pill is cut with
 * "…", its whole words its tooltip; clicked, it shows them whole, and
 * clicked again, it's cut again.
 */
export default function Pills({ pills, label }: { pills: FilterPill[]; label: string }) {
  return (
    <ul className={styles.pills} aria-label={label}>
      {pills.map((pill) => (
        <Pill key={pill.words} word={pill.words} not={pill.not} />
      ))}
    </ul>
  );
}

function Pill({ word, not }: { word: string; not: boolean }) {
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
      {/* The icon on the words' first line, however many they wrap to once opened. */}
      {not ? <IconText icon={<NotIcon />}>{word}</IconText> : word}
    </span>
  );
  return (
    <li className={styles.pill} data-open={open || undefined} data-not={not || undefined}>
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
