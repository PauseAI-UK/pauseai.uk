import type { ReactNode } from "react";
import styles from "./Tag.module.css";

/** A tag's colour: plain, or one of the status colours; grey is plain, for a status that's normal. */
export type TagTone = "red" | "amber" | "green" | "blue" | "grey";

/** A lozenge: a short label beside a name or a heading, or one of a list of them. */
export default function Tag({ tone, children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={tone ? `${styles.tag} ${styles[tone]}` : styles.tag}>{children}</span>;
}
