import type { ReactNode } from "react";
import styles from "./BriefingInset.module.css";

/**
 * A story or a quote set apart inside a briefing's box, in a dashed frame
 * of the box's colour (--tone).
 */
export default function BriefingInset({ children }: { children: ReactNode }) {
  return <div className={styles.inset}>{children}</div>;
}
