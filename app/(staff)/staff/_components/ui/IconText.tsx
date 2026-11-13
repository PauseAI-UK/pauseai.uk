import type { ReactNode } from "react";
import styles from "./IconText.module.css";

/**
 * A small icon before words, centred on their lowercase letters, as it reads
 * best beside them. It stays in the line of text it's in, so it lines up the
 * same in a paragraph, a table cell or a flex row.
 */
export default function IconText({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span>
      <span className={styles.icon} data-beside="lowercase">
        {icon}
      </span>
      {children}
    </span>
  );
}
