import type { ReactNode } from "react";
import styles from "./SaveState.module.css";

/** Where a save is: going, done, or not done, as it failed, someone else saved first, or the page is too old to save. */
export type SaveStateValue = "saving" | "saved" | "failed" | "conflict" | "outdated";

/**
 * Whether something is saved, as a dot and a word (`children`): saving, grey
 * and pulsing; saved, green; not saved, red. Or `calculating`, amber and
 * pulsing: saved, with what follows from it still being worked out. Put it
 * in a live region (role="status") for a screen reader to hear it change.
 */
export function SaveState({ state, children }: { state: SaveStateValue | "calculating"; children: ReactNode }) {
  return (
    <span className={styles.saveState} data-state={state}>
      <span className={styles.saveDot} aria-hidden="true" />
      {children}
    </span>
  );
}
