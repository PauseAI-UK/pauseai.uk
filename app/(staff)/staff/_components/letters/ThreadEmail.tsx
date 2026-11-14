import type { ReactNode } from "react";
import { staffTime } from "@/lib/staff-time";
import styles from "./ThreadEmail.module.css";
import { lettersCopy } from "./copy";

const copy = lettersCopy.letterThread;

/**
 * One message of a letter's thread as an email shows it: who it's from and
 * to, whom it was copied to if anyone, when, and its subject, with `action`, if any, at the right of the
 * subject's line, over its text.
 */
export default function ThreadEmail({
  from,
  to,
  cc,
  at,
  sent,
  subject,
  action,
  missing = false,
  children,
}: {
  from: ReactNode;
  /** Whom it was to; left out when not known, as for a message rebuilt from an "On … wrote:" line. */
  to: ReactNode;
  cc?: ReactNode;
  at: Date | null;
  /** When it was sent as a quote of it says, in its words, where there's no `at`. */
  sent?: string;
  subject: string;
  action?: ReactNode;
  /** Its text isn't kept, so its body is a slot with a note in it, not words of the letter. */
  missing?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={styles.email} aria-label={subject}>
      <dl className={styles.headers}>
        <dt>{copy.headers.from}</dt>
        <dd>{from}</dd>
        {to && (
          <>
            <dt>{copy.headers.to}</dt>
            <dd>{to}</dd>
          </>
        )}
        {cc && (
          <>
            <dt>{copy.headers.cc}</dt>
            <dd>{cc}</dd>
          </>
        )}
        {(at || sent) && (
          <>
            <dt>{copy.headers.date}</dt>
            <dd>{at ? staffTime(at) : sent}</dd>
          </>
        )}
        <dt>{copy.headers.subject}</dt>
        <dd className={styles.subject}>
          <strong>{subject}</strong>
          {action && <span className={styles.action}>{action}</span>}
        </dd>
      </dl>
      <div className={missing ? `${styles.body} ${styles.missing}` : styles.body}>{children}</div>
    </article>
  );
}
