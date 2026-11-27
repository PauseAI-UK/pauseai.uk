import type { ReactNode } from "react";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import styles from "./ExternalLink.module.css";

/**
 * A link out of the staff pages, to another site or the public one: it
 * opens in a new tab and sends no referrer, with an arrow after its words
 * that says it leaves. A tooltip says so too, which a screen reader reads
 * as its description. Every link on a staff page that opens a new tab is
 * one (tests/checks/new-tabs.test.ts).
 */
export default function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  // A staff page is never left in a new tab: StaffLink goes to it.
  if (href.startsWith("/staff")) throw new Error(`ExternalLink to a staff page, ${href}: use StaffLink`);
  return (
    <a href={href} target="_blank" rel="noreferrer" className={styles.link} title={staffVocabulary.opensInNewTab}>
      {children}
    </a>
  );
}
