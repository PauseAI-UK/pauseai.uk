import type { ReactNode } from "react";
import styles from "./SaveState.module.css";

/** Where a save is: going, done, or not done, as it failed or someone else saved first. */
export type SaveStateValue = "saving" | "saved" | "failed" | "conflict";

/**
 * Whether something is saved, as a dot and a word (`children`): saving, grey
 * and pulsing; saved, green; not saved, red. Put it in a live region
 * (role="status") for a screen reader to hear it change.
 */
export function SaveState({ state, children }: { state: SaveStateValue; children: ReactNode }) {
  return (
    <span className={styles.saveState} data-state={state}>
      <span className={styles.saveDot} aria-hidden="true" />
      {children}
    </span>
  );
}
