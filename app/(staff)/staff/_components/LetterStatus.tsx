import { staffCopy } from "@/lib/content/staff-interface";
import { letterState } from "@/lib/mailings/copy-states";
import type { SkipReason } from "@/lib/mailings/records";
import { CopyStatus } from "./mailings/CopyStatus";
import styles from "./LetterStatus.module.css";

/** A letter's status, in words. */
export const statusOf = (status: string) => staffCopy.letters.status[status] ?? status;

/**
 * Where a letter to a politician stands, as one tag (letterState), the same
 * in a mailing's or a campaign's list as on the letter's own page. `sentBy`
 * says what refused one that failed.
 */
export default function LetterStatus(letter: {
  status: string;
  skipReason?: SkipReason | null;
  answered: boolean;
  replied: boolean;
  autoReplied?: boolean;
  sentBy?: string | null;
}) {
  return (
    <span className={styles.tags}>
      <CopyStatus copyOf={letterState(letter)} />
    </span>
  );
}
