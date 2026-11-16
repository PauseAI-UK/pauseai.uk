import type { ReactNode } from "react";
import styles from "./IconText.module.css";

/**
 * A small icon before words, or `after` them, centred on their lowercase
 * letters, as it reads best beside them. It stays in the line of text it's
 * in, so it lines up the same in a paragraph, a table cell or a flex row.
 *
 * `tall`, an icon as tall as the words' letters, such as before a page's
 * title: centred on their lowercase letters, it would sit low under their
 * capitals, so it goes beside them in a flex row, centred on their first
 * line (docs/style-guide.md, "Lining something up with words"). A title
 * that wraps goes on under its words, not under the icon.
 */
export default function IconText({
  icon,
  after = false,
  tall = false,
  children,
}: {
  icon: ReactNode;
  after?: boolean;
  tall?: boolean;
  children: ReactNode;
}) {
  if (tall) {
    return (
      <span className={styles.tall}>
        <span className={styles.tallIcon} data-beside="capitals">
          {icon}
        </span>
        <span>{children}</span>
      </span>
    );
  }
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
