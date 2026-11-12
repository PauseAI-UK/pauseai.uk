import type { ReactNode } from "react";
import styles from "./Rows.module.css";

/**
 * What goes in a card that lists things (docs/style-guide.md, "Staff
 * pages"): rows, each ruled from the next, their parts lined up from row
 * to row. `label` names the list for a screen reader, where the card's
 * title doesn't.
 */
export default function Rows({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ul className={styles.rows} aria-label={label}>
      {children}
    </ul>
  );
}

/**
 * One row: its main line (`children`), which names the thing and leads to
 * it; under it `second`, a quieter line of what else there is to say; and
 * at its right `end`, something of the row's own, such as a button or how
 * it stands. `lead` comes before them all, for a thing named by its day:
 * its date.
 */
export function Row({
  lead,
  second,
  end,
  children,
}: {
  lead?: ReactNode;
  second?: ReactNode;
  end?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className={styles.row}>
      {lead && <div className={styles.lead}>{lead}</div>}
      <div className={styles.words}>
        <div className={styles.main}>{children}</div>
        {second && <div className={styles.second}>{second}</div>}
      </div>
      {end && <div className={styles.end}>{end}</div>}
    </li>
  );
}
