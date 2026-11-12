import type { ReactNode } from "react";
import styles from "./Shortened.module.css";

/**
 * Words too long for a cell of a table, cut to their start, `short`, then
 * "…" in a small pill, which unfolds the `whole` of them in its place, and
 * folds it again. `children` follow the words either way: a lozenge that
 * belongs after them.
 */
export default function Shortened({ short, whole, children }: { short: string; whole: string; children?: ReactNode }) {
  return (
    <details className={styles.fold}>
      <summary>
        <span className={styles.short}>
          {short} <span className={styles.more}>…</span>
        </span>
        <span className={styles.whole}>{whole}</span> {children}
      </summary>
    </details>
  );
}

/**
 * The start of `text` to show for it, its whole words within `max`
 * characters, or null for one that short already. A first word longer than
 * that is cut where it reaches `max`.
 */
export function cutAtWord(text: string, max: number): string | null {
  if (text.length <= max) return null;
  const end = text.lastIndexOf(" ", max);
  return text.slice(0, end > 0 ? end : max);
}
