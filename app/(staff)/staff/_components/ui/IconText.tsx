import type { ReactNode } from "react";
import styles from "./IconText.module.css";

/**
 * A small icon before words, or `after` them, centred on their lowercase
 * letters, as it reads best beside them. It stays in the line of text it's
 * in, so it lines up the same in a paragraph, a table cell or a flex row.
 */
export default function IconText({
  icon,
  after = false,
  children,
}: {
  icon: ReactNode;
  after?: boolean;
  children: ReactNode;
}) {
  const shown = (
    <span className={after ? `${styles.icon} ${styles.after}` : styles.icon} data-beside="lowercase">
      {icon}
    </span>
  );
  return (
    <span>
      {!after && shown}
      {children}
      {after && shown}
    </span>
  );
}
