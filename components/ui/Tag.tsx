import type { ReactNode } from "react";
import styles from "./Tag.module.css";

/** A tag's colour: one of the status colours, or none for plain, as a status that's normal is. */
export type TagTone = "red" | "amber" | "green" | "blue";

/** A lozenge: a short label beside a name or a heading, or one of a list of them. */
export default function Tag({ tone, children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={tone ? `${styles.tag} ${styles[tone]}` : styles.tag}>{children}</span>;
}
