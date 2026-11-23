import type { ReactNode } from "react";
import { bubbleTrigger } from "@/components/ui/bubble-trigger";
import styles from "./HelpButton.module.css";

/**
 * The small grey round button beside something on a staff page, with a "?"
 * or an "i" in it, that opens a bubble of a few words on it. Its class, for
 * a Bubble to draw it with (its `trigger`), with `className` for its place
 * in the layout, never its look.
 */
export function helpButtonClass(className?: string): string {
  return [styles.help, className].filter(Boolean).join(" ");
}

/**
 * The button itself, for a bubble drawn elsewhere on the page (a BubbleBox
 * whose id is `bubble`), named `name` for a screen reader.
 */
export default function HelpButton({ bubble, name, children }: { bubble: string; name: string; children: ReactNode }) {
  return (
    <button type="button" className={styles.help} aria-label={name} {...bubbleTrigger(bubble)}>
      {children}
    </button>
  );
}
