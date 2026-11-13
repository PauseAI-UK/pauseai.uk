import type { ReactNode } from "react";
import styles from "./Numbered.module.css";

/** A numbered section's title, a card's on a page of steps going down it: its number in a dark circle, then its name. */
export default function Numbered({ n, children }: { n: number; children: ReactNode }) {
  return (
    <span className={styles.titled}>
      <span className={styles.number} aria-hidden="true" data-beside="capitals">
        {n}
      </span>
      {children}
    </span>
  );
}
