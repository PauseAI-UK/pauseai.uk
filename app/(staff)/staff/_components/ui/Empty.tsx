import type { ReactNode } from "react";
import styles from "./Empty.module.css";

/**
 * That there's nothing, said the same way on every staff page
 * (docs/style-guide.md, "Staff pages"): the page's own words, in grey, at
 * the size of the text around them, where what's missing would start. In a
 * card or on the page it's a line of its own; `inline`, it sits in a line
 * with other things, such as beside a heading or in a table's row.
 */
export default function Empty({ inline = false, children }: { inline?: boolean; children: ReactNode }) {
  const Tag = inline ? "span" : "p";
  return <Tag className={styles.empty}>{children}</Tag>;
}
